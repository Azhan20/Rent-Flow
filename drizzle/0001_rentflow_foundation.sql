-- Additive foundation. Legacy tables are intentionally untouched.
CREATE TABLE rf_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text NOT NULL UNIQUE,
  email text NOT NULL,
  display_name text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED','PENDING_DELETION')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rf_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  currency text NOT NULL DEFAULT 'USD',
  timezone text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rf_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rf_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES rf_users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('ORG_OWNER','ORG_ADMIN','MANAGER','OPERATIONS','READ_ONLY')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INVITED','SUSPENDED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rf_memberships_org_user_uq UNIQUE (organization_id, user_id)
);
CREATE INDEX rf_memberships_user_idx ON rf_memberships(user_id);

CREATE TABLE rf_equipment_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rf_organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rf_categories_org_id_uq UNIQUE (organization_id, id),
  CONSTRAINT rf_categories_org_slug_uq UNIQUE (organization_id, slug)
);

CREATE TABLE rf_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rf_organizations(id) ON DELETE RESTRICT,
  category_id uuid,
  sku text NOT NULL,
  name text NOT NULL,
  description text,
  daily_rate numeric(12,2) NOT NULL,
  weekly_rate numeric(12,2) NOT NULL,
  monthly_rate numeric(12,2) NOT NULL,
  deposit_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_units integer NOT NULL DEFAULT 1,
  specifications jsonb NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rf_equipment_org_id_uq UNIQUE (organization_id, id),
  CONSTRAINT rf_equipment_org_sku_uq UNIQUE (organization_id, sku),
  CONSTRAINT rf_equipment_category_tenant_fk FOREIGN KEY (organization_id, category_id) REFERENCES rf_equipment_categories(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT rf_equipment_rates_ck CHECK (daily_rate >= 0 AND weekly_rate >= 0 AND monthly_rate >= 0 AND deposit_amount >= 0),
  CONSTRAINT rf_equipment_units_ck CHECK (total_units > 0)
);
CREATE INDEX rf_equipment_org_name_idx ON rf_equipment(organization_id, name);

CREATE TABLE rf_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rf_organizations(id) ON DELETE RESTRICT,
  name text NOT NULL,
  company_name text,
  email text NOT NULL,
  phone text,
  billing_address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rf_customers_org_id_uq UNIQUE (organization_id, id)
);
CREATE INDEX rf_customers_org_email_idx ON rf_customers(organization_id, email);

CREATE TABLE rf_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rf_organizations(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL,
  booking_number text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'REQUEST' CHECK (status IN ('QUOTE','REQUEST','PENDING_APPROVAL','CONFIRMED','CHECKED_OUT','RETURNED','CLOSED','CANCELLED','OVERDUE')),
  subtotal numeric(12,2) NOT NULL,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  delivery_fee numeric(12,2) NOT NULL DEFAULT 0,
  deposit_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rf_bookings_org_id_uq UNIQUE (organization_id, id),
  CONSTRAINT rf_bookings_org_number_uq UNIQUE (organization_id, booking_number),
  CONSTRAINT rf_bookings_customer_tenant_fk FOREIGN KEY (organization_id, customer_id) REFERENCES rf_customers(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT rf_bookings_dates_ck CHECK (end_at > start_at),
  CONSTRAINT rf_bookings_amounts_ck CHECK (subtotal >= 0 AND tax_amount >= 0 AND delivery_fee >= 0 AND deposit_amount >= 0)
);
CREATE INDEX rf_bookings_org_dates_idx ON rf_bookings(organization_id, start_at, end_at);

CREATE TABLE rf_booking_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  equipment_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  rate_applied numeric(12,2) NOT NULL CHECK (rate_applied >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rf_booking_items_booking_tenant_fk FOREIGN KEY (organization_id, booking_id) REFERENCES rf_bookings(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT rf_booking_items_equipment_tenant_fk FOREIGN KEY (organization_id, equipment_id) REFERENCES rf_equipment(organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE rf_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES rf_organizations(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL,
  booking_id uuid,
  invoice_number text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SENT','PARTIALLY_PAID','PAID','OVERDUE','VOID','REFUNDED')),
  subtotal numeric(12,2) NOT NULL,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_due numeric(12,2) NOT NULL,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rf_invoices_org_id_uq UNIQUE (organization_id, id),
  CONSTRAINT rf_invoices_org_number_uq UNIQUE (organization_id, invoice_number),
  CONSTRAINT rf_invoices_customer_tenant_fk FOREIGN KEY (organization_id, customer_id) REFERENCES rf_customers(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT rf_invoices_booking_tenant_fk FOREIGN KEY (organization_id, booking_id) REFERENCES rf_bookings(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT rf_invoices_status_ck CHECK (status IN ('DRAFT','SENT','PARTIALLY_PAID','PAID','OVERDUE','VOID','REFUNDED')),
  CONSTRAINT rf_invoices_amounts_ck CHECK (subtotal >= 0 AND tax_amount >= 0 AND total_due >= 0)
);

CREATE TABLE rf_customer_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('CASH','BANK_TRANSFER','CHECK','CARD_TERMINAL','OTHER')),
  reference text,
  recorded_by_user_id uuid REFERENCES rf_users(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rf_customer_payments_invoice_tenant_fk FOREIGN KEY (organization_id, invoice_id) REFERENCES rf_invoices(organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE rf_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES rf_organizations(id) ON DELETE RESTRICT,
  plan_code text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','PAST_DUE','CANCELLED','EXPIRED')),
  provider text,
  provider_reference text,
  current_period_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rf_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES rf_organizations(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES rf_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  subject_type text,
  subject_id text,
  request_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rf_audit_org_created_idx ON rf_audit_logs(organization_id, created_at);

