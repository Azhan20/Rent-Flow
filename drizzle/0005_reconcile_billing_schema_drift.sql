-- Forward-only reconciliation for the TEST schema drift observed after the
-- journaled 0002/0003 revisions. This migration deliberately does not rename
-- semantically correct existing billing foreign keys.

DO $preflight$
DECLARE
  subscriptions_oid oid;
  status_constraint_oid oid;
  status_definition text;
  payment_column_type text;
  payment_column_not_null boolean;
  payment_column_default text;
  trial_constraint_definition text;
  normalized_definition text;
BEGIN
  subscriptions_oid := to_regclass('public.rf_account_subscriptions');
  IF subscriptions_oid IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    WHERE c.oid = subscriptions_oid AND c.relkind IN ('r', 'p')
  ) THEN
    RAISE EXCEPTION 'Expected public.rf_account_subscriptions table; refusing billing repair';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = subscriptions_oid AND a.attname = 'id'
      AND a.atttypid = 'uuid'::regtype AND a.attnotnull AND a.attnum > 0 AND NOT a.attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = subscriptions_oid AND a.attname = 'status'
      AND a.atttypid = 'text'::regtype AND a.attnotnull AND a.attnum > 0 AND NOT a.attisdropped
  ) THEN
    RAISE EXCEPTION 'Unexpected rf_account_subscriptions key/status columns; refusing billing repair';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint con
    WHERE con.conrelid = subscriptions_oid
      AND con.contype = 'c'
      AND position('status' IN lower(pg_catalog.pg_get_constraintdef(con.oid, true))) > 0
      AND con.conname NOT IN (
        'rf_account_subscriptions_status_ck',
        'rf_account_subscriptions_trial_payment_method_ck'
      )
  ) THEN
    RAISE EXCEPTION 'Unexpected additional status-related CHECK constraint; refusing billing repair';
  END IF;

  SELECT con.oid, pg_catalog.pg_get_constraintdef(con.oid, true)
    INTO status_constraint_oid, status_definition
    FROM pg_catalog.pg_constraint con
    WHERE con.conrelid = subscriptions_oid
      AND con.conname = 'rf_account_subscriptions_status_ck'
      AND con.contype = 'c';
  IF NOT FOUND OR NOT (SELECT con.convalidated FROM pg_catalog.pg_constraint con WHERE con.oid = status_constraint_oid) THEN
    RAISE EXCEPTION 'Expected validated rf_account_subscriptions_status_ck; refusing billing repair';
  END IF;

  normalized_definition := lower(regexp_replace(status_definition, '[[:space:]]+', '', 'g'));
  IF normalized_definition NOT IN (
    'check(status=any(array[''pending''::text,''trialing''::text,''active''::text,''past_due''::text,''cancelled''::text,''expired''::text]))',
    'check(status=any(array[''pending''::text,''trialing''::text,''active''::text,''past_due''::text,''cancelled''::text,''suspended''::text,''expired''::text]))'
  ) THEN
    RAISE EXCEPTION 'Unexpected rf_account_subscriptions_status_ck definition; refusing billing repair';
  END IF;

  IF normalized_definition <> 'check(status=any(array[''pending''::text,''trialing''::text,''active''::text,''past_due''::text,''cancelled''::text,''suspended''::text,''expired''::text]))'
    AND EXISTS (
      SELECT 1 FROM pg_catalog.pg_depend d
      WHERE d.refclassid = 'pg_catalog.pg_constraint'::regclass
        AND d.refobjid = status_constraint_oid
        AND d.deptype NOT IN ('i', 'a')
    ) THEN
    RAISE EXCEPTION 'Unexpected dependent object references subscription status constraint; refusing replacement';
  END IF;

  SELECT pg_catalog.format_type(a.atttypid, a.atttypmod), a.attnotnull,
         pg_catalog.pg_get_expr(d.adbin, d.adrelid)
    INTO payment_column_type, payment_column_not_null, payment_column_default
    FROM pg_catalog.pg_attribute a
    LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = subscriptions_oid AND a.attname = 'payment_method_verified_at'
      AND a.attnum > 0 AND NOT a.attisdropped;
  IF FOUND AND (payment_column_type <> 'timestamp with time zone'
    OR payment_column_not_null OR payment_column_default IS NOT NULL) THEN
    RAISE EXCEPTION 'Unexpected payment_method_verified_at definition; refusing billing repair';
  END IF;

  SELECT pg_catalog.pg_get_constraintdef(con.oid, true)
    INTO trial_constraint_definition
    FROM pg_catalog.pg_constraint con
    WHERE con.conrelid = subscriptions_oid
      AND con.conname = 'rf_account_subscriptions_trial_payment_method_ck'
      AND con.contype = 'c';
  IF FOUND AND (NOT (SELECT con.convalidated FROM pg_catalog.pg_constraint con
                     WHERE con.conrelid = subscriptions_oid
                       AND con.conname = 'rf_account_subscriptions_trial_payment_method_ck')
    OR lower(regexp_replace(trial_constraint_definition, '[[:space:]]+', '', 'g'))
      <> 'check(status<>''trialing''::textorpayment_method_verified_atisnotnull)') THEN
    RAISE EXCEPTION 'Unexpected rf_account_subscriptions_trial_payment_method_ck; refusing billing repair';
  END IF;
END;
$preflight$;

DO $repair_subscription_columns$
DECLARE
  subscriptions_oid oid := to_regclass('public.rf_account_subscriptions');
  status_definition text;
  status_constraint_oid oid;
  normalized_definition text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = subscriptions_oid AND a.attname = 'payment_method_verified_at'
      AND a.attnum > 0 AND NOT a.attisdropped
  ) THEN
    EXECUTE 'ALTER TABLE public.rf_account_subscriptions ADD COLUMN payment_method_verified_at timestamptz';
  END IF;

  SELECT con.oid, pg_catalog.pg_get_constraintdef(con.oid, true)
    INTO status_constraint_oid, status_definition
    FROM pg_catalog.pg_constraint con
    WHERE con.conrelid = subscriptions_oid
      AND con.conname = 'rf_account_subscriptions_status_ck'
      AND con.contype = 'c';
  normalized_definition := lower(regexp_replace(status_definition, '[[:space:]]+', '', 'g'));
  IF normalized_definition = 'check(status=any(array[''pending''::text,''trialing''::text,''active''::text,''past_due''::text,''cancelled''::text,''expired''::text]))' THEN
    EXECUTE 'ALTER TABLE public.rf_account_subscriptions DROP CONSTRAINT rf_account_subscriptions_status_ck';
    EXECUTE $ddl$
      ALTER TABLE public.rf_account_subscriptions
      ADD CONSTRAINT rf_account_subscriptions_status_ck
      CHECK (status IN ('PENDING','TRIALING','ACTIVE','PAST_DUE','CANCELLED','SUSPENDED','EXPIRED'))
    $ddl$;
  ELSIF normalized_definition <> 'check(status=any(array[''pending''::text,''trialing''::text,''active''::text,''past_due''::text,''cancelled''::text,''suspended''::text,''expired''::text]))' THEN
    RAISE EXCEPTION 'Subscription status check changed after preflight; refusing billing repair';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint con
    WHERE con.conrelid = subscriptions_oid
      AND con.conname = 'rf_account_subscriptions_trial_payment_method_ck'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.rf_account_subscriptions
      WHERE status = 'TRIALING' AND payment_method_verified_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Existing trial subscription lacks verified payment evidence; refusing billing repair';
    END IF;
    EXECUTE $ddl$
      ALTER TABLE public.rf_account_subscriptions
      ADD CONSTRAINT rf_account_subscriptions_trial_payment_method_ck
      CHECK (status <> 'TRIALING' OR payment_method_verified_at IS NOT NULL)
    $ddl$;
  END IF;
END;
$repair_subscription_columns$;

CREATE TABLE IF NOT EXISTS public.rf_account_subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_subscription_id uuid NOT NULL
    CONSTRAINT rf_account_subscription_events_subscription_id_rf_account_subscriptions_id_fk
    REFERENCES public.rf_account_subscriptions(id) ON DELETE RESTRICT,
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
  CONSTRAINT rf_account_subscription_events_provider_ck
    CHECK (payment_provider IN ('PADDLE')),
  CONSTRAINT rf_account_subscription_events_event_type_ck
    CHECK (length(trim(event_type)) > 0),
  CONSTRAINT rf_account_subscription_events_provider_event_id_ck
    CHECK (provider_event_id IS NULL OR length(trim(provider_event_id)) > 0),
  CONSTRAINT rf_account_subscription_events_previous_status_ck
    CHECK (previous_status IS NULL OR previous_status IN ('PENDING','TRIALING','ACTIVE','PAST_DUE','CANCELLED','SUSPENDED','EXPIRED')),
  CONSTRAINT rf_account_subscription_events_status_ck
    CHECK (status IN ('PENDING','TRIALING','ACTIVE','PAST_DUE','CANCELLED','SUSPENDED','EXPIRED')),
  CONSTRAINT rf_account_subscription_events_previous_period_ck
    CHECK (
      (previous_period_starts_at IS NULL AND previous_period_ends_at IS NULL)
      OR (previous_period_starts_at IS NOT NULL AND previous_period_ends_at > previous_period_starts_at)
    ),
  CONSTRAINT rf_account_subscription_events_period_ck
    CHECK (
      (period_starts_at IS NULL AND period_ends_at IS NULL)
      OR (period_starts_at IS NOT NULL AND period_ends_at > period_starts_at)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS rf_account_subscription_events_provider_event_uq
  ON public.rf_account_subscription_events(payment_provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rf_account_subscription_events_subscription_occurred_idx
  ON public.rf_account_subscription_events(account_subscription_id, occurred_at);

DO $repair_event_function$
DECLARE
  function_oid oid;
  expected_source constant text := 'BEGIN RAISE EXCEPTION ''account subscription lifecycle events are append-only'' USING ERRCODE = ''55000''; END;';
BEGIN
  SELECT p.oid
    INTO function_oid
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'rf_reject_account_subscription_event_mutation'
      AND p.pronargs = 0;
  IF NOT FOUND THEN
    EXECUTE $ddl$
      CREATE FUNCTION public.rf_reject_account_subscription_event_mutation()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      BEGIN
        RAISE EXCEPTION 'account subscription lifecycle events are append-only'
          USING ERRCODE = '55000';
      END;
      $function$
    $ddl$;
    SELECT p.oid
      INTO function_oid
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'rf_reject_account_subscription_event_mutation'
        AND p.pronargs = 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid = function_oid
      AND p.prorettype = 'trigger'::regtype
      AND p.prolang = (SELECT l.oid FROM pg_catalog.pg_language l WHERE l.lanname = 'plpgsql')
      AND NOT p.prosecdef
      AND p.provolatile = 'v'
      AND NOT p.proisstrict
      AND NOT p.proleakproof
      AND p.proparallel = 'u'
      AND p.proconfig IS NULL
      AND p.prokind = 'f'
      AND lower(regexp_replace(p.prosrc, '[[:space:]]+', '', 'g'))
        = lower(regexp_replace(expected_source, '[[:space:]]+', '', 'g'))
  ) THEN
    RAISE EXCEPTION 'Unexpected append-only trigger function definition or attributes; refusing billing repair';
  END IF;
END;
$repair_event_function$;

DO $repair_event_trigger$
DECLARE
  events_oid oid := to_regclass('public.rf_account_subscription_events');
  trigger_oid oid;
  trigger_count integer;
  trigger_definition text;
  expected_function oid := 'public.rf_reject_account_subscription_event_mutation()'::regprocedure;
  expected_trigger_definition constant text := 'CREATE TRIGGER rf_account_subscription_events_append_only BEFORE UPDATE OR DELETE ON public.rf_account_subscription_events FOR EACH ROW EXECUTE FUNCTION public.rf_reject_account_subscription_event_mutation()';
BEGIN
  SELECT count(*) INTO trigger_count
    FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = events_oid AND NOT t.tgisinternal;
  IF trigger_count = 0 THEN
    EXECUTE $ddl$
      CREATE TRIGGER rf_account_subscription_events_append_only
      BEFORE UPDATE OR DELETE ON public.rf_account_subscription_events
      FOR EACH ROW EXECUTE FUNCTION public.rf_reject_account_subscription_event_mutation()
    $ddl$;
  END IF;

  SELECT count(*) INTO trigger_count
    FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = events_oid AND NOT t.tgisinternal;
  IF trigger_count <> 1 THEN
    RAISE EXCEPTION 'Unexpected additional lifecycle-event trigger; refusing billing repair';
  END IF;

  SELECT t.oid, pg_catalog.pg_get_triggerdef(t.oid, true)
    INTO trigger_oid, trigger_definition
    FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = events_oid
      AND t.tgname = 'rf_account_subscription_events_append_only'
      AND NOT t.tgisinternal;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE t.oid = trigger_oid AND t.tgrelid = events_oid
      AND t.tgfoid = expected_function AND t.tgtype = 27 AND t.tgenabled = 'O'
      AND NOT t.tgisinternal AND t.tgconstraint = 0
      AND lower(regexp_replace(
        regexp_replace(trigger_definition,
          'public\.(rf_account_subscription_events|rf_reject_account_subscription_event_mutation)', '\1', 'g'),
        '[[:space:]]+', '', 'g'))
        = lower(regexp_replace(
          regexp_replace(expected_trigger_definition,
            'public\.(rf_account_subscription_events|rf_reject_account_subscription_event_mutation)', '\1', 'g'),
          '[[:space:]]+', '', 'g'))
  ) THEN
    RAISE EXCEPTION 'Unexpected, disabled, or incorrectly defined lifecycle append-only trigger; refusing billing repair';
  END IF;
END;
$repair_event_trigger$;

DO $postflight$
DECLARE
  events_oid oid := to_regclass('public.rf_account_subscription_events');
  subscriptions_oid oid := to_regclass('public.rf_account_subscriptions');
  constraint_count integer;
  index_count integer;
BEGIN
  IF events_oid IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid = events_oid AND c.relkind = 'r'
  ) THEN
    RAISE EXCEPTION 'Lifecycle event table is absent or not an ordinary table';
  END IF;

  IF (SELECT count(*) FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = events_oid AND a.attnum > 0 AND NOT a.attisdropped) <> 13
    OR EXISTS (
      SELECT 1
      FROM (VALUES
        ('id','uuid',true,'gen_random_uuid()'),
        ('account_subscription_id','uuid',true,NULL),
        ('payment_provider','text',true,'''PADDLE''::text'),
        ('provider_event_id','text',false,NULL),
        ('event_type','text',true,NULL),
        ('occurred_at','timestamp with time zone',true,NULL),
        ('previous_status','text',false,NULL),
        ('status','text',true,NULL),
        ('previous_period_starts_at','timestamp with time zone',false,NULL),
        ('previous_period_ends_at','timestamp with time zone',false,NULL),
        ('period_starts_at','timestamp with time zone',false,NULL),
        ('period_ends_at','timestamp with time zone',false,NULL),
        ('created_at','timestamp with time zone',true,'now()')
      ) AS expected(name, data_type, not_null, default_expr)
      LEFT JOIN pg_catalog.pg_attribute a
        ON a.attrelid = events_oid AND a.attname = expected.name
          AND a.attnum > 0 AND NOT a.attisdropped
      LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attname IS NULL
        OR pg_catalog.format_type(a.atttypid, a.atttypmod) <> expected.data_type
        OR a.attnotnull <> expected.not_null
        OR lower(regexp_replace(coalesce(pg_catalog.pg_get_expr(d.adbin,d.adrelid),''), '[[:space:]]+', '', 'g'))
          <> lower(regexp_replace(coalesce(expected.default_expr,''), '[[:space:]]+', '', 'g'))
    ) THEN
    RAISE EXCEPTION 'Lifecycle event table columns differ from the Drizzle schema';
  END IF;

  SELECT count(*) INTO constraint_count FROM pg_catalog.pg_constraint con
    WHERE con.conrelid = events_oid;
  IF constraint_count <> 9 OR EXISTS (
    SELECT 1 FROM (VALUES
      ('rf_account_subscription_events_pkey','p','primary key (id)'),
      ('rf_account_subscription_events_provider_ck','c','check (payment_provider = ''paddle''::text)'),
      ('rf_account_subscription_events_event_type_ck','c','check (length(trim(both from event_type)) > 0)'),
      ('rf_account_subscription_events_provider_event_id_ck','c','check (provider_event_id is null or length(trim(both from provider_event_id)) > 0)'),
      ('rf_account_subscription_events_previous_status_ck','c','check (previous_status is null or previous_status = any (array[''pending''::text, ''trialing''::text, ''active''::text, ''past_due''::text, ''cancelled''::text, ''suspended''::text, ''expired''::text]))'),
      ('rf_account_subscription_events_status_ck','c','check (status = any (array[''pending''::text, ''trialing''::text, ''active''::text, ''past_due''::text, ''cancelled''::text, ''suspended''::text, ''expired''::text]))'),
      ('rf_account_subscription_events_previous_period_ck','c','check (previous_period_starts_at is null and previous_period_ends_at is null or previous_period_starts_at is not null and previous_period_ends_at > previous_period_starts_at)'),
      ('rf_account_subscription_events_period_ck','c','check (period_starts_at is null and period_ends_at is null or period_starts_at is not null and period_ends_at > period_starts_at)')
    ) AS expected(name, type, definition)
    LEFT JOIN pg_catalog.pg_constraint con
      ON con.conrelid = events_oid AND con.conname = expected.name
    WHERE con.oid IS NULL OR con.contype::text <> expected.type OR NOT con.convalidated
      OR lower(regexp_replace(pg_catalog.pg_get_constraintdef(con.oid,true), '[[:space:]]+', '', 'g'))
        <> lower(regexp_replace(expected.definition, '[[:space:]]+', '', 'g'))
  ) THEN
    RAISE EXCEPTION 'Lifecycle event table constraints differ from the Drizzle schema';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_attribute local_column
      ON local_column.attrelid = events_oid
      AND local_column.attname = 'account_subscription_id'
      AND local_column.attnum > 0 AND NOT local_column.attisdropped
    JOIN pg_catalog.pg_attribute referenced_column
      ON referenced_column.attrelid = subscriptions_oid
      AND referenced_column.attname = 'id'
      AND referenced_column.attnum > 0 AND NOT referenced_column.attisdropped
    WHERE con.conrelid = events_oid
      AND con.conname = 'rf_account_subscription_events_subscription_id_rf_account_subscriptions_id_fk'
      AND con.contype = 'f' AND con.convalidated
      AND con.confrelid = 'public.rf_account_subscriptions'::regclass
      AND con.conkey = ARRAY[local_column.attnum]::smallint[]
      AND con.confkey = ARRAY[referenced_column.attnum]::smallint[]
      AND con.confdeltype = 'r'
  ) THEN
    RAISE EXCEPTION 'Lifecycle event subscription foreign key differs from the Drizzle schema';
  END IF;

  SELECT count(*) INTO index_count FROM pg_catalog.pg_index i WHERE i.indrelid = events_oid;
  IF index_count <> 3 OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class ix ON ix.oid = i.indexrelid
    WHERE i.indrelid = events_oid AND ix.relname = 'rf_account_subscription_events_provider_event_uq'
      AND i.indisunique AND i.indisvalid AND i.indisready
      AND lower(regexp_replace(pg_catalog.pg_get_indexdef(i.indexrelid), '[[:space:]]+', '', 'g'))
        = 'createuniqueindexrf_account_subscription_events_provider_event_uqonpublic.rf_account_subscription_eventsusingbtree(payment_provider,provider_event_id)where(provider_event_idisnotnull)'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class ix ON ix.oid = i.indexrelid
    WHERE i.indrelid = events_oid AND ix.relname = 'rf_account_subscription_events_subscription_occurred_idx'
      AND NOT i.indisunique AND i.indisvalid AND i.indisready
      AND lower(regexp_replace(pg_catalog.pg_get_indexdef(i.indexrelid), '[[:space:]]+', '', 'g'))
        = 'createindexrf_account_subscription_events_subscription_occurred_idxonpublic.rf_account_subscription_eventsusingbtree(account_subscription_id,occurred_at)'
  ) THEN
    RAISE EXCEPTION 'Lifecycle event indexes differ from the Drizzle schema';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = subscriptions_oid AND a.attname = 'payment_method_verified_at'
      AND a.atttypid = 'timestamp with time zone'::regtype AND NOT a.attnotnull AND a.attnum > 0 AND NOT a.attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint con
    WHERE con.conrelid = subscriptions_oid
      AND con.conname = 'rf_account_subscriptions_status_ck'
      AND con.contype = 'c' AND con.convalidated
      AND lower(regexp_replace(pg_catalog.pg_get_constraintdef(con.oid,true), '[[:space:]]+', '', 'g'))
        = 'check(status=any(array[''pending''::text,''trialing''::text,''active''::text,''past_due''::text,''cancelled''::text,''suspended''::text,''expired''::text]))'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint con
    WHERE con.conrelid = subscriptions_oid
      AND con.conname = 'rf_account_subscriptions_trial_payment_method_ck'
      AND con.contype = 'c' AND con.convalidated
      AND lower(regexp_replace(pg_catalog.pg_get_constraintdef(con.oid,true), '[[:space:]]+', '', 'g'))
        = 'check(status<>''trialing''::textorpayment_method_verified_atisnotnull)'
  ) THEN
    RAISE EXCEPTION 'Account subscription billing verification constraints differ from the Drizzle schema';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint con
    WHERE con.conrelid = subscriptions_oid
      AND con.contype = 'c'
      AND position('status' IN lower(pg_catalog.pg_get_constraintdef(con.oid, true))) > 0
      AND con.conname NOT IN (
        'rf_account_subscriptions_status_ck',
        'rf_account_subscriptions_trial_payment_method_ck'
      )
  ) THEN
    RAISE EXCEPTION 'Unexpected additional status-related CHECK constraint remains after billing repair';
  END IF;
END;
$postflight$;
