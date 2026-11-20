import { sql } from 'drizzle-orm';
import {
  boolean, check, foreignKey, index, integer, jsonb, numeric, pgTable, text,
  timestamp, unique, uuid,
} from 'drizzle-orm/pg-core';

const id = (name = 'id') => uuid(name).defaultRandom().primaryKey();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

// Drizzle is the only runtime ORM. The rf_ namespace lets the additive v2
// migration coexist with the unverified legacy tables without dropping data.
export const users = pgTable('rf_users', {
  id: id(),
  firebaseUid: text('firebase_uid').notNull().unique('rf_users_firebase_uid_key'),
  email: text('email').notNull(),
  displayName: text('display_name'),
  status: text('status').notNull().default('ACTIVE'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [check('rf_users_status_ck', sql`${t.status} in ('ACTIVE','DISABLED','PENDING_DELETION')`)]);

export const organizations = pgTable('rf_organizations', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  currency: text('currency').notNull().default('USD'),
  timezone: text('timezone').notNull(),
  status: text('status').notNull().default('ACTIVE'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [unique('rf_organizations_slug_key').on(t.slug), check('rf_organizations_status_ck', sql`${t.status} in ('ACTIVE','SUSPENDED','CLOSED')`)]);

export const memberships = pgTable('rf_memberships', {
  id: id(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  status: text('status').notNull().default('ACTIVE'),
  createdAt: createdAt(),
}, (t) => [
  unique('rf_memberships_org_user_uq').on(t.organizationId, t.userId),
  index('rf_memberships_user_idx').on(t.userId),
  check('rf_memberships_role_ck', sql`${t.role} in ('ORG_OWNER','ORG_ADMIN','MANAGER','OPERATIONS','READ_ONLY')`),
  check('rf_memberships_status_ck', sql`${t.status} in ('ACTIVE','INVITED','SUSPENDED')`),
]);

export const categories = pgTable('rf_equipment_categories', {
  id: id(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  createdAt: createdAt(),
}, (t) => [
  unique('rf_categories_org_id_uq').on(t.organizationId, t.id),
  unique('rf_categories_org_slug_uq').on(t.organizationId, t.slug),
]);

export const equipment = pgTable('rf_equipment', {
  id: id(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  categoryId: uuid('category_id'),
  sku: text('sku').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  dailyRate: numeric('daily_rate', { precision: 12, scale: 2 }).notNull(),
  weeklyRate: numeric('weekly_rate', { precision: 12, scale: 2 }).notNull(),
  monthlyRate: numeric('monthly_rate', { precision: 12, scale: 2 }).notNull(),
  depositAmount: numeric('deposit_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  totalUnits: integer('total_units').notNull().default(1),
  specifications: jsonb('specifications').notNull().default({}),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  unique('rf_equipment_org_id_uq').on(t.organizationId, t.id),
  foreignKey({ columns: [t.organizationId, t.categoryId], foreignColumns: [categories.organizationId, categories.id], name: 'rf_equipment_category_tenant_fk' }).onDelete('restrict'),
  unique('rf_equipment_org_sku_uq').on(t.organizationId, t.sku),
  index('rf_equipment_org_name_idx').on(t.organizationId, t.name),
  check('rf_equipment_rates_ck', sql`${t.dailyRate} >= 0 and ${t.weeklyRate} >= 0 and ${t.monthlyRate} >= 0 and ${t.depositAmount} >= 0`),
  check('rf_equipment_units_ck', sql`${t.totalUnits} > 0`),
]);

export const customers = pgTable('rf_customers', {
  id: id(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  companyName: text('company_name'),
  email: text('email').notNull(),
  phone: text('phone'),
  billingAddress: text('billing_address'),
  notes: text('notes'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  unique('rf_customers_org_id_uq').on(t.organizationId, t.id),
  index('rf_customers_org_email_idx').on(t.organizationId, t.email),
]);

export const bookings = pgTable('rf_bookings', {
  id: id(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  customerId: uuid('customer_id').notNull(),
  bookingNumber: text('booking_number').notNull(),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('REQUEST'),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  deliveryFee: numeric('delivery_fee', { precision: 12, scale: 2 }).notNull().default('0'),
  depositAmount: numeric('deposit_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  unique('rf_bookings_org_id_uq').on(t.organizationId, t.id),
  unique('rf_bookings_org_number_uq').on(t.organizationId, t.bookingNumber),
  index('rf_bookings_org_dates_idx').on(t.organizationId, t.startAt, t.endAt),
  foreignKey({ columns: [t.organizationId, t.customerId], foreignColumns: [customers.organizationId, customers.id], name: 'rf_bookings_customer_tenant_fk' }).onDelete('restrict'),
  check('rf_bookings_dates_ck', sql`${t.endAt} > ${t.startAt}`),
  check('rf_bookings_status_ck', sql`${t.status} in ('QUOTE','REQUEST','PENDING_APPROVAL','CONFIRMED','CHECKED_OUT','RETURNED','CLOSED','CANCELLED','OVERDUE')`),
  check('rf_bookings_amounts_ck', sql`${t.subtotal} >= 0 and ${t.taxAmount} >= 0 and ${t.deliveryFee} >= 0 and ${t.depositAmount} >= 0`),
]);

export const bookingItems = pgTable('rf_booking_items', {
  id: id(),
  organizationId: uuid('organization_id').notNull(),
  bookingId: uuid('booking_id').notNull(),
  equipmentId: uuid('equipment_id').notNull(),
  quantity: integer('quantity').notNull().default(1),
  rateApplied: numeric('rate_applied', { precision: 12, scale: 2 }).notNull(),
  createdAt: createdAt(),
}, (t) => [
  foreignKey({ columns: [t.organizationId, t.bookingId], foreignColumns: [bookings.organizationId, bookings.id], name: 'rf_booking_items_booking_tenant_fk' }).onDelete('cascade'),
  foreignKey({ columns: [t.organizationId, t.equipmentId], foreignColumns: [equipment.organizationId, equipment.id], name: 'rf_booking_items_equipment_tenant_fk' }).onDelete('restrict'),
  check('rf_booking_items_quantity_ck', sql`${t.quantity} > 0`),
  check('rf_booking_items_rate_ck', sql`${t.rateApplied} >= 0`),
]);

export const invoices = pgTable('rf_invoices', {
  id: id(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  customerId: uuid('customer_id').notNull(),
  bookingId: uuid('booking_id'),
  invoiceNumber: text('invoice_number').notNull(),
  status: text('status').notNull().default('DRAFT'),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  totalDue: numeric('total_due', { precision: 12, scale: 2 }).notNull(),
  dueAt: timestamp('due_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  unique('rf_invoices_org_id_uq').on(t.organizationId, t.id),
  unique('rf_invoices_org_number_uq').on(t.organizationId, t.invoiceNumber),
  foreignKey({ columns: [t.organizationId, t.customerId], foreignColumns: [customers.organizationId, customers.id], name: 'rf_invoices_customer_tenant_fk' }).onDelete('restrict'),
  foreignKey({ columns: [t.organizationId, t.bookingId], foreignColumns: [bookings.organizationId, bookings.id], name: 'rf_invoices_booking_tenant_fk' }).onDelete('restrict'),
  check('rf_invoices_status_ck', sql`${t.status} in ('DRAFT','SENT','PARTIALLY_PAID','PAID','OVERDUE','VOID','REFUNDED')`),
  check('rf_invoices_amounts_ck', sql`${t.subtotal} >= 0 and ${t.taxAmount} >= 0 and ${t.totalDue} >= 0`),
]);

// Rental-customer payment records are separate from RentFlow SaaS billing.
export const customerPayments = pgTable('rf_customer_payments', {
  id: id(),
  organizationId: uuid('organization_id').notNull(),
  invoiceId: uuid('invoice_id').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  method: text('method').notNull(),
  reference: text('reference'),
  recordedByUserId: uuid('recorded_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  recordedAt: createdAt(),
}, (t) => [
  foreignKey({ columns: [t.organizationId, t.invoiceId], foreignColumns: [invoices.organizationId, invoices.id], name: 'rf_customer_payments_invoice_tenant_fk' }).onDelete('restrict'),
  check('rf_customer_payments_amount_ck', sql`${t.amount} > 0`),
  check('rf_customer_payments_method_ck', sql`${t.method} in ('CASH','BANK_TRANSFER','CHECK','CARD_TERMINAL','OTHER')`),
]);

export const subscriptions = pgTable('rf_subscriptions', {
  id: id(),
  organizationId: uuid('organization_id').notNull().unique('rf_subscriptions_organization_id_key').references(() => organizations.id, { onDelete: 'restrict' }),
  planCode: text('plan_code').notNull(),
  status: text('status').notNull().default('PENDING'),
  provider: text('provider'),
  providerReference: text('provider_reference'),
  currentPeriodEndsAt: timestamp('current_period_ends_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [check('rf_subscriptions_status_ck', sql`${t.status} in ('PENDING','ACTIVE','PAST_DUE','CANCELLED','EXPIRED')`)]);

export const auditLogs = pgTable('rf_audit_logs', {
  id: id(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'restrict' }),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  subjectType: text('subject_type'),
  subjectId: text('subject_id'),
  requestId: text('request_id'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: createdAt(),
}, (t) => [index('rf_audit_org_created_idx').on(t.organizationId, t.createdAt)]);
