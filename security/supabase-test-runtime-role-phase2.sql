-- Phase 2 grants for the reviewed active Express routes.
-- Apply only through the guarded Supabase testing runner.
-- Runtime role has no login and is not a migration or ownership role.
CREATE ROLE rentflow_runtime
  NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

-- The application logs in as a separate non-owner role and inherits only the
-- runtime group privileges. It cannot SET ROLE or administer membership.
CREATE ROLE rentflow_runtime_login
  LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT rentflow_runtime TO rentflow_runtime_login
  WITH INHERIT TRUE, SET FALSE, ADMIN FALSE;

-- Identity reads and organization authorization use only these user columns.
GRANT SELECT (firebase_uid, id, email, display_name, status)
  ON TABLE public.rf_users TO rentflow_runtime;
GRANT INSERT (firebase_uid, email, display_name)
  ON TABLE public.rf_users TO rentflow_runtime;
GRANT UPDATE (email, display_name, updated_at)
  ON TABLE public.rf_users TO rentflow_runtime;

-- Organization creation uses a projected RETURNING list; active reads use
-- these organization fields and status for membership authorization.
GRANT SELECT (id, name, slug, currency, timezone, status)
  ON TABLE public.rf_organizations TO rentflow_runtime;
GRANT INSERT (name, slug, currency, timezone)
  ON TABLE public.rf_organizations TO rentflow_runtime;

-- Membership checks filter/join on these columns and return the role.
GRANT SELECT (organization_id, user_id, status, role)
  ON TABLE public.rf_memberships TO rentflow_runtime;
GRANT INSERT (organization_id, user_id, role, status)
  ON TABLE public.rf_memberships TO rentflow_runtime;

-- Active equipment and customer routes return complete rows. Equipment
-- creation also returns the complete created row.
GRANT SELECT ON TABLE public.rf_equipment TO rentflow_runtime;
GRANT INSERT (organization_id, sku, name, description, category_id, daily_rate, weekly_rate, monthly_rate, deposit_amount, total_units, specifications)
  ON TABLE public.rf_equipment TO rentflow_runtime;
GRANT SELECT ON TABLE public.rf_customers TO rentflow_runtime;
GRANT INSERT (organization_id, name, email, company_name, phone, billing_address, notes)
  ON TABLE public.rf_customers TO rentflow_runtime;

-- Booking list/create routes return complete booking and item rows.
GRANT SELECT ON TABLE public.rf_bookings TO rentflow_runtime;
GRANT INSERT (organization_id, customer_id, booking_number, start_at, end_at, status, subtotal, tax_amount, delivery_fee, deposit_amount)
  ON TABLE public.rf_bookings TO rentflow_runtime;
GRANT SELECT ON TABLE public.rf_booking_items TO rentflow_runtime;
GRANT INSERT (organization_id, booking_id, equipment_id, quantity, rate_applied)
  ON TABLE public.rf_booking_items TO rentflow_runtime;

-- Active routes write audit records but never read or update them.
GRANT INSERT (organization_id, actor_user_id, action, subject_type, subject_id, request_id, metadata)
  ON TABLE public.rf_audit_logs TO rentflow_runtime;

-- No sequence grants are required: application identifiers use UUID defaults.
-- Booking availability uses built-in pg_catalog advisory-lock functions;
-- their effective EXECUTE access is verified by the runner, not granted here.
