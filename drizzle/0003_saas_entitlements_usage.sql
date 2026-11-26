-- Additive Stage 2 SaaS catalog snapshots, account usage metering and audit.
-- Depends on the still-unexecuted 0002_account_level_billing.sql draft.
-- This file is a draft only. Never run against an environment before review.

ALTER TABLE rf_account_subscriptions
  ADD COLUMN catalog_version text NOT NULL DEFAULT 'v1',
  ADD COLUMN price_identifier text,
  ADD COLUMN price_amount_cents integer,
  ADD COLUMN payment_method_verified_at timestamptz,
  ADD COLUMN entitlement_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT rf_account_subscriptions_plan_identifier_ck
    CHECK (plan_identifier IN ('STARTER','PRO','BUSINESS','ENTERPRISE')),
  ADD CONSTRAINT rf_account_subscriptions_catalog_version_ck
    CHECK (length(trim(catalog_version)) > 0),
  ADD CONSTRAINT rf_account_subscriptions_price_identifier_ck
    CHECK (price_identifier IS NULL OR length(trim(price_identifier)) > 0),
  ADD CONSTRAINT rf_account_subscriptions_price_amount_cents_ck
    CHECK (price_amount_cents IS NULL OR price_amount_cents >= 0),
  ADD CONSTRAINT rf_account_subscriptions_trial_payment_method_ck
    CHECK (status <> 'TRIALING' OR payment_method_verified_at IS NOT NULL),
  ADD CONSTRAINT rf_account_subscriptions_entitlement_snapshot_ck
    CHECK (jsonb_typeof(entitlement_snapshot) = 'object');

CREATE TABLE rf_billing_usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id uuid NOT NULL CONSTRAINT rf_billing_usage_counters_billing_account_id_rf_billing_accounts_id_fk REFERENCES rf_billing_accounts(id) ON DELETE RESTRICT,
  feature_id text NOT NULL,
  period_starts_at timestamptz NOT NULL,
  period_ends_at timestamptz NOT NULL,
  used_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rf_billing_usage_counters_period_uq UNIQUE (billing_account_id, feature_id, period_starts_at),
  CONSTRAINT rf_billing_usage_counters_period_ck CHECK (period_ends_at > period_starts_at),
  CONSTRAINT rf_billing_usage_counters_used_count_ck CHECK (used_count >= 0)
);
CREATE INDEX rf_billing_usage_counters_account_period_idx
  ON rf_billing_usage_counters(billing_account_id, period_starts_at);

CREATE TABLE rf_billing_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id uuid NOT NULL CONSTRAINT rf_billing_usage_events_billing_account_id_rf_billing_accounts_id_fk REFERENCES rf_billing_accounts(id) ON DELETE RESTRICT,
  organization_id uuid CONSTRAINT rf_billing_usage_events_organization_id_rf_organizations_id_fk REFERENCES rf_organizations(id) ON DELETE RESTRICT,
  feature_id text NOT NULL,
  event_type text NOT NULL,
  idempotency_key text NOT NULL,
  period_starts_at timestamptz,
  period_ends_at timestamptz,
  quantity integer NOT NULL DEFAULT 1,
  source_record_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rf_billing_usage_events_idempotency_uq UNIQUE (billing_account_id, feature_id, idempotency_key),
  CONSTRAINT rf_billing_usage_events_account_organization_fk
    FOREIGN KEY (billing_account_id, organization_id)
    REFERENCES rf_billing_account_organizations(billing_account_id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT rf_billing_usage_events_quantity_ck CHECK (quantity > 0),
  CONSTRAINT rf_billing_usage_events_period_ck CHECK (
    (period_starts_at IS NULL AND period_ends_at IS NULL)
    OR (period_starts_at IS NOT NULL AND period_ends_at > period_starts_at)
  )
);
CREATE INDEX rf_billing_usage_events_organization_idx
  ON rf_billing_usage_events(organization_id);
CREATE INDEX rf_billing_usage_events_account_created_idx
  ON rf_billing_usage_events(billing_account_id, created_at);

CREATE TABLE rf_billing_account_entitlement_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id uuid NOT NULL CONSTRAINT rf_billing_account_entitlement_overrides_billing_account_id_rf_billing_accounts_id_fk REFERENCES rf_billing_accounts(id) ON DELETE RESTRICT,
  feature_id text NOT NULL,
  catalog_version text NOT NULL,
  value jsonb NOT NULL,
  reason text NOT NULL,
  created_by_user_id uuid CONSTRAINT rf_billing_account_entitlement_overrides_created_by_user_id_rf_users_id_fk REFERENCES rf_users(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rf_billing_account_entitlement_overrides_reason_ck CHECK (length(trim(reason)) > 0),
  CONSTRAINT rf_billing_account_entitlement_overrides_dates_ck CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE UNIQUE INDEX rf_billing_account_entitlement_overrides_current_uq
  ON rf_billing_account_entitlement_overrides(billing_account_id, feature_id) WHERE ends_at IS NULL;
CREATE INDEX rf_billing_account_entitlement_overrides_account_idx
  ON rf_billing_account_entitlement_overrides(billing_account_id, feature_id, starts_at);
CREATE INDEX rf_billing_account_entitlement_overrides_created_by_user_idx
  ON rf_billing_account_entitlement_overrides(created_by_user_id);

-- Drizzle does not model temporal exclusion constraints. This trigger serializes
-- override writes on the owning account row, rejects overlapping half-open
-- intervals, and makes override history immutable except for closing an open
-- interval once. It is an additive database guard, not an authorization grant.
CREATE FUNCTION rf_guard_billing_entitlement_override_period()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.billing_account_id IS DISTINCT FROM OLD.billing_account_id
      OR NEW.feature_id IS DISTINCT FROM OLD.feature_id
      OR NEW.catalog_version IS DISTINCT FROM OLD.catalog_version
      OR NEW.value IS DISTINCT FROM OLD.value
      OR NEW.reason IS DISTINCT FROM OLD.reason
      OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
      OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR (OLD.ends_at IS NOT NULL AND NEW.ends_at IS DISTINCT FROM OLD.ends_at)
      OR (OLD.ends_at IS NULL AND NEW.ends_at IS NULL) THEN
      RAISE EXCEPTION 'billing entitlement overrides are append-only; only an open interval may be closed';
    END IF;
  END IF;

  -- Updating the account row creates a serialization point even at stronger
  -- transaction isolation levels; the subsequent overlap query sees the
  -- preceding committed override or aborts on a concurrent account update.
  UPDATE rf_billing_accounts
    SET updated_at = clock_timestamp()
    WHERE id = NEW.billing_account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'billing account for entitlement override was not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM rf_billing_account_entitlement_overrides existing
    WHERE existing.billing_account_id = NEW.billing_account_id
      AND existing.feature_id = NEW.feature_id
      AND existing.id IS DISTINCT FROM NEW.id
      AND tstzrange(existing.starts_at, COALESCE(existing.ends_at, 'infinity'::timestamptz), '[)')
        && tstzrange(NEW.starts_at, COALESCE(NEW.ends_at, 'infinity'::timestamptz), '[)')
  ) THEN
    RAISE EXCEPTION 'overlapping billing entitlement override period';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER rf_billing_entitlement_override_period_guard
  BEFORE INSERT OR UPDATE ON rf_billing_account_entitlement_overrides
  FOR EACH ROW EXECUTE FUNCTION rf_guard_billing_entitlement_override_period();

CREATE TABLE rf_account_subscription_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_subscription_id uuid NOT NULL CONSTRAINT rf_account_subscription_changes_account_subscription_id_rf_account_subscriptions_id_fk REFERENCES rf_account_subscriptions(id) ON DELETE RESTRICT,
  actor_user_id uuid CONSTRAINT rf_account_subscription_changes_actor_user_id_rf_users_id_fk REFERENCES rf_users(id) ON DELETE SET NULL,
  change_type text NOT NULL,
  previous_plan_identifier text,
  new_plan_identifier text,
  previous_catalog_version text,
  new_catalog_version text,
  previous_billing_interval text,
  new_billing_interval text,
  previous_price_amount_cents integer,
  new_price_amount_cents integer,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  safe_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT rf_account_subscription_changes_type_ck CHECK (change_type IN ('CREATED','PLAN_CHANGED','UPGRADED','DOWNGRADED','CANCELLATION_REQUESTED','CANCELLATION_CONFIRMED','RENEWED')),
  CONSTRAINT rf_account_subscription_changes_previous_price_ck CHECK (previous_price_amount_cents IS NULL OR previous_price_amount_cents >= 0),
  CONSTRAINT rf_account_subscription_changes_new_price_ck CHECK (new_price_amount_cents IS NULL OR new_price_amount_cents >= 0)
);
CREATE INDEX rf_account_subscription_changes_subscription_idx
  ON rf_account_subscription_changes(account_subscription_id, occurred_at);
CREATE INDEX rf_account_subscription_changes_actor_user_idx
  ON rf_account_subscription_changes(actor_user_id);
