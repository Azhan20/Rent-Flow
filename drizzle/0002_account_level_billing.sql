-- Additive account-level SaaS billing foundation.
-- rf_subscriptions is intentionally unchanged; it may contain existing
-- organization-level subscription records that must be preserved.

CREATE TABLE rf_billing_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL CONSTRAINT rf_billing_accounts_owner_user_id_rf_users_id_fk REFERENCES rf_users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'SETUP',
  paddle_customer_id text,
  trial_eligibility text NOT NULL DEFAULT 'UNASSESSED',
  trial_eligibility_checked_at timestamptz,
  trial_eligibility_policy_version text,
  trial_consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rf_billing_accounts_owner_user_id_key UNIQUE (owner_user_id),
  CONSTRAINT rf_billing_accounts_status_ck CHECK (status IN ('SETUP','TRIALING','ACTIVE','PAST_DUE','CANCELLED','SUSPENDED','EXPIRED')),
  CONSTRAINT rf_billing_accounts_trial_eligibility_ck CHECK (trial_eligibility IN ('UNASSESSED','ELIGIBLE','INELIGIBLE'))
);
CREATE UNIQUE INDEX rf_billing_accounts_paddle_customer_id_uq
  ON rf_billing_accounts(paddle_customer_id) WHERE paddle_customer_id IS NOT NULL;

CREATE TABLE rf_billing_account_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id uuid NOT NULL CONSTRAINT rf_billing_account_organizations_billing_account_id_rf_billing_accounts_id_fk REFERENCES rf_billing_accounts(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL CONSTRAINT rf_billing_account_organizations_organization_id_rf_organizations_id_fk REFERENCES rf_organizations(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rf_billing_account_organizations_organization_id_key UNIQUE (organization_id),
  CONSTRAINT rf_billing_account_organizations_account_org_uq UNIQUE (billing_account_id, organization_id)
);
CREATE TABLE rf_account_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id uuid NOT NULL CONSTRAINT rf_account_subscriptions_billing_account_id_rf_billing_accounts_id_fk REFERENCES rf_billing_accounts(id) ON DELETE RESTRICT,
  is_current boolean NOT NULL DEFAULT false,
  payment_provider text NOT NULL DEFAULT 'PADDLE',
  provider_customer_id text,
  provider_subscription_id text,
  plan_identifier text NOT NULL,
  billing_interval text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancellation_requested_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rf_account_subscriptions_provider_ck CHECK (payment_provider IN ('PADDLE')),
  CONSTRAINT rf_account_subscriptions_interval_ck CHECK (billing_interval IN ('MONTHLY','YEARLY')),
  CONSTRAINT rf_account_subscriptions_status_ck CHECK (status IN ('PENDING','TRIALING','ACTIVE','PAST_DUE','CANCELLED','SUSPENDED','EXPIRED')),
  CONSTRAINT rf_account_subscriptions_trial_dates_ck CHECK (
    (trial_started_at IS NULL AND trial_ends_at IS NULL)
    OR (trial_started_at IS NOT NULL AND trial_ends_at = trial_started_at + interval '336 hours')
  ),
  CONSTRAINT rf_account_subscriptions_period_dates_ck CHECK (
    (current_period_starts_at IS NULL AND current_period_ends_at IS NULL)
    OR (current_period_starts_at IS NOT NULL AND current_period_ends_at > current_period_starts_at)
  )
);
CREATE UNIQUE INDEX rf_account_subscriptions_one_current_per_account_uq
  ON rf_account_subscriptions(billing_account_id) WHERE is_current = true;
CREATE UNIQUE INDEX rf_account_subscriptions_provider_subscription_uq
  ON rf_account_subscriptions(payment_provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;
CREATE INDEX rf_account_subscriptions_account_created_idx
  ON rf_account_subscriptions(billing_account_id, created_at);

-- Normalized status and billing-period snapshots are retained per accepted
-- lifecycle event. The mutable subscription row remains the current-state
-- projection, selected by is_current and its partial unique index.
CREATE TABLE rf_account_subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_subscription_id uuid NOT NULL CONSTRAINT rf_account_subscription_events_subscription_id_rf_account_subscriptions_id_fk REFERENCES rf_account_subscriptions(id) ON DELETE RESTRICT,
  payment_provider text NOT NULL DEFAULT 'PADDLE',
  provider_event_id text,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  previous_status text,
  status text NOT NULL,
  previous_period_starts_at timestamptz,
  previous_period_ends_at timestamptz,
  period_starts_at timestamptz,
  period_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rf_account_subscription_events_provider_ck CHECK (payment_provider IN ('PADDLE')),
  CONSTRAINT rf_account_subscription_events_event_type_ck CHECK (length(trim(event_type)) > 0),
  CONSTRAINT rf_account_subscription_events_provider_event_id_ck CHECK (provider_event_id IS NULL OR length(trim(provider_event_id)) > 0),
  CONSTRAINT rf_account_subscription_events_previous_status_ck CHECK (previous_status IS NULL OR previous_status IN ('PENDING','TRIALING','ACTIVE','PAST_DUE','CANCELLED','SUSPENDED','EXPIRED')),
  CONSTRAINT rf_account_subscription_events_status_ck CHECK (status IN ('PENDING','TRIALING','ACTIVE','PAST_DUE','CANCELLED','SUSPENDED','EXPIRED')),
  CONSTRAINT rf_account_subscription_events_previous_period_ck CHECK (
    (previous_period_starts_at IS NULL AND previous_period_ends_at IS NULL)
    OR (previous_period_starts_at IS NOT NULL AND previous_period_ends_at > previous_period_starts_at)
  ),
  CONSTRAINT rf_account_subscription_events_period_ck CHECK (
    (period_starts_at IS NULL AND period_ends_at IS NULL)
    OR (period_starts_at IS NOT NULL AND period_ends_at > period_starts_at)
  )
);
CREATE UNIQUE INDEX rf_account_subscription_events_provider_event_uq
  ON rf_account_subscription_events(payment_provider, provider_event_id) WHERE provider_event_id IS NOT NULL;
CREATE INDEX rf_account_subscription_events_subscription_occurred_idx
  ON rf_account_subscription_events(account_subscription_id, occurred_at);

CREATE FUNCTION rf_reject_account_subscription_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'account subscription lifecycle events are append-only'
    USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER rf_account_subscription_events_append_only
  BEFORE UPDATE OR DELETE ON rf_account_subscription_events
  FOR EACH ROW EXECUTE FUNCTION rf_reject_account_subscription_event_mutation();

CREATE TABLE rf_billing_trial_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id uuid NOT NULL CONSTRAINT rf_billing_trial_history_billing_account_id_rf_billing_accounts_id_fk REFERENCES rf_billing_accounts(id) ON DELETE RESTRICT,
  eligibility_decision text NOT NULL,
  decision_reason_code text,
  safe_decision_details text,
  policy_version text NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  trial_status text NOT NULL,
  CONSTRAINT rf_billing_trial_history_decision_ck CHECK (eligibility_decision IN ('ELIGIBLE','REJECTED')),
  CONSTRAINT rf_billing_trial_history_status_ck CHECK (trial_status IN ('NOT_STARTED','STARTED','CONVERTED','EXPIRED')),
  CONSTRAINT rf_billing_trial_history_trial_dates_ck CHECK (
    (trial_started_at IS NULL AND trial_ends_at IS NULL AND trial_status = 'NOT_STARTED')
    OR (trial_started_at IS NOT NULL AND trial_ends_at = trial_started_at + interval '336 hours' AND trial_status <> 'NOT_STARTED')
  ),
  CONSTRAINT rf_billing_trial_history_rejection_reason_ck CHECK (
    eligibility_decision <> 'REJECTED' OR decision_reason_code IS NOT NULL
  ),
  CONSTRAINT rf_billing_trial_history_rejected_unstarted_ck CHECK (
    eligibility_decision <> 'REJECTED' OR (trial_started_at IS NULL AND trial_status = 'NOT_STARTED')
  )
);
CREATE INDEX rf_billing_trial_history_account_evaluated_idx
  ON rf_billing_trial_history(billing_account_id, evaluated_at);
CREATE UNIQUE INDEX rf_billing_trial_history_single_consumed_trial_uq
  ON rf_billing_trial_history(billing_account_id) WHERE trial_started_at IS NOT NULL;

CREATE TABLE rf_billing_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_provider text NOT NULL DEFAULT 'PADDLE',
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  processing_status text NOT NULL DEFAULT 'RECEIVED',
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  safe_error_details text,
  retry_count integer NOT NULL DEFAULT 0,
  CONSTRAINT rf_billing_webhook_events_provider_ck CHECK (payment_provider IN ('PADDLE')),
  CONSTRAINT rf_billing_webhook_events_status_ck CHECK (processing_status IN ('RECEIVED','PROCESSING','PROCESSED','FAILED','IGNORED')),
  CONSTRAINT rf_billing_webhook_events_retry_count_ck CHECK (retry_count >= 0),
  CONSTRAINT rf_billing_webhook_events_error_length_ck CHECK (safe_error_details IS NULL OR length(safe_error_details) <= 1000),
  CONSTRAINT rf_billing_webhook_events_provider_event_uq UNIQUE (payment_provider, provider_event_id)
);
CREATE INDEX rf_billing_webhook_events_status_received_idx
  ON rf_billing_webhook_events(processing_status, received_at);
