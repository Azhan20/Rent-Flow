-- Reconcile the automatically named invoice status CHECK from the applied
-- 0001 foundation with the stable name used by the Drizzle schema.
-- This is metadata-only: it does not drop or weaken the existing CHECK.
DO $migration$
DECLARE
  has_original_name boolean;
  has_schema_name boolean;
  original_type "char";
  schema_type "char";
  original_definition text;
  schema_definition text;
  original_validated boolean;
  schema_validated boolean;
  expected_definition constant text := 'CHECK ((status = ANY (ARRAY[''DRAFT''::text, ''SENT''::text, ''PARTIALLY_PAID''::text, ''PAID''::text, ''OVERDUE''::text, ''VOID''::text, ''REFUNDED''::text])))';
BEGIN
  SELECT contype, pg_get_constraintdef(oid), convalidated
    INTO original_type, original_definition, original_validated
    FROM pg_constraint
    WHERE conrelid = 'rf_invoices'::regclass
      AND conname = 'rf_invoices_status_check';
  has_original_name := FOUND;

  SELECT contype, pg_get_constraintdef(oid), convalidated
    INTO schema_type, schema_definition, schema_validated
    FROM pg_constraint
    WHERE conrelid = 'rf_invoices'::regclass
      AND conname = 'rf_invoices_status_ck';
  has_schema_name := FOUND;

  IF has_original_name AND (original_type <> 'c' OR NOT original_validated
    OR regexp_replace(original_definition, '[[:space:]]+', '', 'g')
      <> regexp_replace(expected_definition, '[[:space:]]+', '', 'g')) THEN
    RAISE EXCEPTION 'Unexpected or unvalidated rf_invoices_status_check; refusing reconciliation';
  END IF;
  IF has_schema_name AND (schema_type <> 'c' OR NOT schema_validated
    OR regexp_replace(schema_definition, '[[:space:]]+', '', 'g')
      <> regexp_replace(expected_definition, '[[:space:]]+', '', 'g')) THEN
    RAISE EXCEPTION 'Unexpected or unvalidated rf_invoices_status_ck; refusing reconciliation';
  END IF;

  IF has_original_name AND has_schema_name THEN
    IF regexp_replace(original_definition, '[[:space:]]+', '', 'g')
      <> regexp_replace(schema_definition, '[[:space:]]+', '', 'g') THEN
      RAISE EXCEPTION 'Invoice status CHECK definitions differ; refusing reconciliation';
    END IF;
    -- Remove only the duplicate auto-named check; keep the validated,
    -- canonical Drizzle-named check in place.
    ALTER TABLE rf_invoices DROP CONSTRAINT rf_invoices_status_check;
  ELSIF has_original_name AND NOT has_schema_name THEN
    ALTER TABLE rf_invoices
      RENAME CONSTRAINT rf_invoices_status_check TO rf_invoices_status_ck;
  ELSIF has_schema_name AND NOT has_original_name THEN
    -- Permit a database where the canonical name is already present.
    NULL;
  ELSE
    RAISE EXCEPTION 'Neither expected invoice status CHECK exists; refusing reconciliation';
  END IF;
END;
$migration$;
