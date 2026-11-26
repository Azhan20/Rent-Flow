import { sql } from 'drizzle-orm';
import {
  boolean, check, foreignKey, index, integer, jsonb, numeric, pgTable, text,
  timestamp, unique, uniqueIndex, uuid,
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

// Account-level SaaS billing is kept separate from rf_subscriptions, which
// remains the legacy organization-level subscription structure.
export const billingAccounts = pgTable('rf_billing_accounts', {
  id: id(),
  ownerUserId: uuid('owner_user_id').notNull().unique('rf_billing_accounts_owner_user_id_key'),
  status: text('status').notNull().default('SETUP'),
  paddleCustomerId: text('paddle_customer_id'),
  trialEligibility: text('trial_eligibility').notNull().default('UNASSESSED'),
  trialEligibilityCheckedAt: timestamp('trial_eligibility_checked_at', { withTimezone: true }),
  trialEligibilityPolicyVersion: text('trial_eligibility_policy_version'),
  trialConsumedAt: timestamp('trial_consumed_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  foreignKey({ columns: [t.ownerUserId], foreignColumns: [users.id], name: 'rf_billing_accounts_owner_user_id_rf_users_id_fk' }).onDelete('restrict'),
  check('rf_billing_accounts_status_ck', sql`${t.status} in ('SETUP','TRIALING','ACTIVE','PAST_DUE','CANCELLED','SUSPENDED','EXPIRED')`),
  check('rf_billing_accounts_trial_eligibility_ck', sql`${t.trialEligibility} in ('UNASSESSED','ELIGIBLE','INELIGIBLE')`),
  uniqueIndex('rf_billing_accounts_paddle_customer_id_uq').on(t.paddleCustomerId).where(sql`${t.paddleCustomerId} is not null`),
]);

export const billingAccountOrganizations = pgTable('rf_billing_account_organizations', {
  id: id(),
  billingAccountId: uuid('billing_account_id').notNull(),
  organizationId: uuid('organization_id').notNull().unique('rf_billing_account_organizations_organization_id_key'),
  createdAt: createdAt(),
}, (t) => [
  foreignKey({ columns: [t.billingAccountId], foreignColumns: [billingAccounts.id], name: 'rf_billing_account_organizations_billing_account_id_rf_billing_accounts_id_fk' }).onDelete('restrict'),
  foreignKey({ columns: [t.organizationId], foreignColumns: [organizations.id], name: 'rf_billing_account_organizations_organization_id_rf_organizations_id_fk' }).onDelete('restrict'),
  unique('rf_billing_account_organizations_account_org_uq').on(t.billingAccountId, t.organizationId),
]);

export const accountSubscriptions = pgTable('rf_account_subscriptions', {
  id: id(),
  billingAccountId: uuid('billing_account_id').notNull(),
  isCurrent: boolean('is_current').notNull().default(false),
  paymentProvider: text('payment_provider').notNull().default('PADDLE'),
  providerCustomerId: text('provider_customer_id'),
  providerSubscriptionId: text('provider_subscription_id'),
  planIdentifier: text('plan_identifier').notNull(),
  catalogVersion: text('catalog_version').notNull().default('v1'),
  priceIdentifier: text('price_identifier'),
  priceAmountCents: integer('price_amount_cents'),
  entitlementSnapshot: jsonb('entitlement_snapshot').notNull().default({}),
  billingInterval: text('billing_interval').notNull(),
  status: text('status').notNull().default('PENDING'),
  paymentMethodVerifiedAt: timestamp('payment_method_verified_at', { withTimezone: true }),
  trialStartedAt: timestamp('trial_started_at', { withTimezone: true }),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  currentPeriodStartsAt: timestamp('current_period_starts_at', { withTimezone: true }),
  currentPeriodEndsAt: timestamp('current_period_ends_at', { withTimezone: true }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  cancellationRequestedAt: timestamp('cancellation_requested_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  foreignKey({ columns: [t.billingAccountId], foreignColumns: [billingAccounts.id], name: 'rf_account_subscriptions_billing_account_id_rf_billing_accounts_id_fk' }).onDelete('restrict'),
  check('rf_account_subscriptions_plan_identifier_ck', sql`${t.planIdentifier} in ('STARTER','PRO','BUSINESS','ENTERPRISE')`),
  check('rf_account_subscriptions_catalog_version_ck', sql`length(trim(${t.catalogVersion})) > 0`),
  check('rf_account_subscriptions_price_identifier_ck', sql`${t.priceIdentifier} is null or length(trim(${t.priceIdentifier})) > 0`),
  check('rf_account_subscriptions_price_amount_cents_ck', sql`${t.priceAmountCents} is null or ${t.priceAmountCents} >= 0`),
  check('rf_account_subscriptions_entitlement_snapshot_ck', sql`jsonb_typeof(${t.entitlementSnapshot}) = 'object'`),
  check('rf_account_subscriptions_provider_ck', sql`${t.paymentProvider} in ('PADDLE')`),
  check('rf_account_subscriptions_interval_ck', sql`${t.billingInterval} in ('MONTHLY','YEARLY')`),
  check('rf_account_subscriptions_status_ck', sql`${t.status} in ('PENDING','TRIALING','ACTIVE','PAST_DUE','CANCELLED','SUSPENDED','EXPIRED')`),
  check('rf_account_subscriptions_trial_payment_method_ck', sql`${t.status} <> 'TRIALING' or ${t.paymentMethodVerifiedAt} is not null`),
  check('rf_account_subscriptions_trial_dates_ck', sql`(${t.trialStartedAt} is null and ${t.trialEndsAt} is null) or (${t.trialStartedAt} is not null and ${t.trialEndsAt} = ${t.trialStartedAt} + interval '336 hours')`),
  check('rf_account_subscriptions_period_dates_ck', sql`(${t.currentPeriodStartsAt} is null and ${t.currentPeriodEndsAt} is null) or (${t.currentPeriodStartsAt} is not null and ${t.currentPeriodEndsAt} > ${t.currentPeriodStartsAt})`),
  uniqueIndex('rf_account_subscriptions_one_current_per_account_uq').on(t.billingAccountId).where(sql`${t.isCurrent} = true`),
  uniqueIndex('rf_account_subscriptions_provider_subscription_uq').on(t.paymentProvider, t.providerSubscriptionId).where(sql`${t.providerSubscriptionId} is not null`),
  index('rf_account_subscriptions_account_created_idx').on(t.billingAccountId, t.createdAt),
]);

// Current subscription rows are mutable projections. Every accepted lifecycle
// transition also has an append-only, normalized event snapshot so period and
// status history is retained without storing provider payloads or secrets.
export const accountSubscriptionEvents = pgTable('rf_account_subscription_events', {
  id: id(),
  accountSubscriptionId: uuid('account_subscription_id').notNull(),
  paymentProvider: text('payment_provider').notNull().default('PADDLE'),
  providerEventId: text('provider_event_id'),
  eventType: text('event_type').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  previousStatus: text('previous_status'),
  status: text('status').notNull(),
  previousPeriodStartsAt: timestamp('previous_period_starts_at', { withTimezone: true }),
  previousPeriodEndsAt: timestamp('previous_period_ends_at', { withTimezone: true }),
  periodStartsAt: timestamp('period_starts_at', { withTimezone: true }),
  periodEndsAt: timestamp('period_ends_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  foreignKey({ columns: [t.accountSubscriptionId], foreignColumns: [accountSubscriptions.id], name: 'rf_account_subscription_events_subscription_id_rf_account_subscriptions_id_fk' }).onDelete('restrict'),
  check('rf_account_subscription_events_provider_ck', sql`${t.paymentProvider} in ('PADDLE')`),
  check('rf_account_subscription_events_event_type_ck', sql`length(trim(${t.eventType})) > 0`),
  check('rf_account_subscription_events_provider_event_id_ck', sql`${t.providerEventId} is null or length(trim(${t.providerEventId})) > 0`),
  check('rf_account_subscription_events_previous_status_ck', sql`${t.previousStatus} is null or ${t.previousStatus} in ('PENDING','TRIALING','ACTIVE','PAST_DUE','CANCELLED','SUSPENDED','EXPIRED')`),
  check('rf_account_subscription_events_status_ck', sql`${t.status} in ('PENDING','TRIALING','ACTIVE','PAST_DUE','CANCELLED','SUSPENDED','EXPIRED')`),
  check('rf_account_subscription_events_previous_period_ck', sql`(${t.previousPeriodStartsAt} is null and ${t.previousPeriodEndsAt} is null) or (${t.previousPeriodStartsAt} is not null and ${t.previousPeriodEndsAt} > ${t.previousPeriodStartsAt})`),
  check('rf_account_subscription_events_period_ck', sql`(${t.periodStartsAt} is null and ${t.periodEndsAt} is null) or (${t.periodStartsAt} is not null and ${t.periodEndsAt} > ${t.periodStartsAt})`),
  uniqueIndex('rf_account_subscription_events_provider_event_uq').on(t.paymentProvider, t.providerEventId).where(sql`${t.providerEventId} is not null`),
  index('rf_account_subscription_events_subscription_occurred_idx').on(t.accountSubscriptionId, t.occurredAt),
]);

// Account-level usage and immutable audit records. These tables are additive
// and are not used by active routes until their migration is reviewed/applied.
export const billingUsageCounters = pgTable('rf_billing_usage_counters', {
  id: id(),
  billingAccountId: uuid('billing_account_id').notNull(),
  featureId: text('feature_id').notNull(),
  periodStartsAt: timestamp('period_starts_at', { withTimezone: true }).notNull(),
  periodEndsAt: timestamp('period_ends_at', { withTimezone: true }).notNull(),
  usedCount: integer('used_count').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  foreignKey({ columns: [t.billingAccountId], foreignColumns: [billingAccounts.id], name: 'rf_billing_usage_counters_billing_account_id_rf_billing_accounts_id_fk' }).onDelete('restrict'),
  unique('rf_billing_usage_counters_period_uq').on(t.billingAccountId, t.featureId, t.periodStartsAt),
  check('rf_billing_usage_counters_period_ck', sql`${t.periodEndsAt} > ${t.periodStartsAt}`),
  check('rf_billing_usage_counters_used_count_ck', sql`${t.usedCount} >= 0`),
  index('rf_billing_usage_counters_account_period_idx').on(t.billingAccountId, t.periodStartsAt),
]);

export const billingUsageEvents = pgTable('rf_billing_usage_events', {
  id: id(),
  billingAccountId: uuid('billing_account_id').notNull(),
  organizationId: uuid('organization_id'),
  featureId: text('feature_id').notNull(),
  eventType: text('event_type').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  periodStartsAt: timestamp('period_starts_at', { withTimezone: true }),
  periodEndsAt: timestamp('period_ends_at', { withTimezone: true }),
  quantity: integer('quantity').notNull().default(1),
  sourceRecordId: text('source_record_id'),
  createdAt: createdAt(),
}, (t) => [
  unique('rf_billing_usage_events_idempotency_uq').on(t.billingAccountId, t.featureId, t.idempotencyKey),
  foreignKey({ columns: [t.billingAccountId], foreignColumns: [billingAccounts.id], name: 'rf_billing_usage_events_billing_account_id_rf_billing_accounts_id_fk' }).onDelete('restrict'),
  foreignKey({ columns: [t.organizationId], foreignColumns: [organizations.id], name: 'rf_billing_usage_events_organization_id_rf_organizations_id_fk' }).onDelete('restrict'),
  foreignKey({
    columns: [t.billingAccountId, t.organizationId],
    foreignColumns: [billingAccountOrganizations.billingAccountId, billingAccountOrganizations.organizationId],
    name: 'rf_billing_usage_events_account_organization_fk',
  }).onDelete('restrict'),
  check('rf_billing_usage_events_quantity_ck', sql`${t.quantity} > 0`),
  check('rf_billing_usage_events_period_ck', sql`(${t.periodStartsAt} is null and ${t.periodEndsAt} is null) or (${t.periodStartsAt} is not null and ${t.periodEndsAt} > ${t.periodStartsAt})`),
  index('rf_billing_usage_events_organization_idx').on(t.organizationId),
  index('rf_billing_usage_events_account_created_idx').on(t.billingAccountId, t.createdAt),
]);

export const billingAccountEntitlementOverrides = pgTable('rf_billing_account_entitlement_overrides', {
  id: id(),
  billingAccountId: uuid('billing_account_id').notNull(),
  featureId: text('feature_id').notNull(),
  catalogVersion: text('catalog_version').notNull(),
  value: jsonb('value').notNull(),
  reason: text('reason').notNull(),
  createdByUserId: uuid('created_by_user_id'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  foreignKey({ columns: [t.billingAccountId], foreignColumns: [billingAccounts.id], name: 'rf_billing_account_entitlement_overrides_billing_account_id_rf_billing_accounts_id_fk' }).onDelete('restrict'),
  foreignKey({ columns: [t.createdByUserId], foreignColumns: [users.id], name: 'rf_billing_account_entitlement_overrides_created_by_user_id_rf_users_id_fk' }).onDelete('set null'),
  uniqueIndex('rf_billing_account_entitlement_overrides_current_uq').on(t.billingAccountId, t.featureId).where(sql`${t.endsAt} is null`),
  check('rf_billing_account_entitlement_overrides_reason_ck', sql`length(trim(${t.reason})) > 0`),
  check('rf_billing_account_entitlement_overrides_dates_ck', sql`${t.endsAt} is null or ${t.endsAt} > ${t.startsAt}`),
  index('rf_billing_account_entitlement_overrides_account_idx').on(t.billingAccountId, t.featureId, t.startsAt),
  index('rf_billing_account_entitlement_overrides_created_by_user_idx').on(t.createdByUserId),
]);

export const accountSubscriptionChanges = pgTable('rf_account_subscription_changes', {
  id: id(),
  accountSubscriptionId: uuid('account_subscription_id').notNull(),
  actorUserId: uuid('actor_user_id'),
  changeType: text('change_type').notNull(),
  previousPlanIdentifier: text('previous_plan_identifier'),
  newPlanIdentifier: text('new_plan_identifier'),
  previousCatalogVersion: text('previous_catalog_version'),
  newCatalogVersion: text('new_catalog_version'),
  previousBillingInterval: text('previous_billing_interval'),
  newBillingInterval: text('new_billing_interval'),
  previousPriceAmountCents: integer('previous_price_amount_cents'),
  newPriceAmountCents: integer('new_price_amount_cents'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  safeDetails: jsonb('safe_details').notNull().default({}),
}, (t) => [
  foreignKey({ columns: [t.accountSubscriptionId], foreignColumns: [accountSubscriptions.id], name: 'rf_account_subscription_changes_account_subscription_id_rf_account_subscriptions_id_fk' }).onDelete('restrict'),
  foreignKey({ columns: [t.actorUserId], foreignColumns: [users.id], name: 'rf_account_subscription_changes_actor_user_id_rf_users_id_fk' }).onDelete('set null'),
  check('rf_account_subscription_changes_type_ck', sql`${t.changeType} in ('CREATED','PLAN_CHANGED','UPGRADED','DOWNGRADED','CANCELLATION_REQUESTED','CANCELLATION_CONFIRMED','RENEWED')`),
  check('rf_account_subscription_changes_previous_price_ck', sql`${t.previousPriceAmountCents} is null or ${t.previousPriceAmountCents} >= 0`),
  check('rf_account_subscription_changes_new_price_ck', sql`${t.newPriceAmountCents} is null or ${t.newPriceAmountCents} >= 0`),
  index('rf_account_subscription_changes_subscription_idx').on(t.accountSubscriptionId, t.occurredAt),
  index('rf_account_subscription_changes_actor_user_idx').on(t.actorUserId),
]);

export const billingTrialHistory = pgTable('rf_billing_trial_history', {
  id: id(),
  billingAccountId: uuid('billing_account_id').notNull(),
  eligibilityDecision: text('eligibility_decision').notNull(),
  decisionReasonCode: text('decision_reason_code'),
  safeDecisionDetails: text('safe_decision_details'),
  policyVersion: text('policy_version').notNull(),
  evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).notNull().defaultNow(),
  trialStartedAt: timestamp('trial_started_at', { withTimezone: true }),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  trialStatus: text('trial_status').notNull(),
}, (t) => [
  foreignKey({ columns: [t.billingAccountId], foreignColumns: [billingAccounts.id], name: 'rf_billing_trial_history_billing_account_id_rf_billing_accounts_id_fk' }).onDelete('restrict'),
  check('rf_billing_trial_history_decision_ck', sql`${t.eligibilityDecision} in ('ELIGIBLE','REJECTED')`),
  check('rf_billing_trial_history_status_ck', sql`${t.trialStatus} in ('NOT_STARTED','STARTED','CONVERTED','EXPIRED')`),
  check('rf_billing_trial_history_trial_dates_ck', sql`(${t.trialStartedAt} is null and ${t.trialEndsAt} is null and ${t.trialStatus} = 'NOT_STARTED') or (${t.trialStartedAt} is not null and ${t.trialEndsAt} = ${t.trialStartedAt} + interval '336 hours' and ${t.trialStatus} <> 'NOT_STARTED')`),
  check('rf_billing_trial_history_rejection_reason_ck', sql`${t.eligibilityDecision} <> 'REJECTED' or ${t.decisionReasonCode} is not null`),
  check('rf_billing_trial_history_rejected_unstarted_ck', sql`${t.eligibilityDecision} <> 'REJECTED' or (${t.trialStartedAt} is null and ${t.trialStatus} = 'NOT_STARTED')`),
  index('rf_billing_trial_history_account_evaluated_idx').on(t.billingAccountId, t.evaluatedAt),
  uniqueIndex('rf_billing_trial_history_single_consumed_trial_uq').on(t.billingAccountId).where(sql`${t.trialStartedAt} is not null`),
]);

export const billingWebhookEvents = pgTable('rf_billing_webhook_events', {
  id: id(),
  paymentProvider: text('payment_provider').notNull().default('PADDLE'),
  providerEventId: text('provider_event_id').notNull(),
  eventType: text('event_type').notNull(),
  processingStatus: text('processing_status').notNull().default('RECEIVED'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  safeErrorDetails: text('safe_error_details'),
  retryCount: integer('retry_count').notNull().default(0),
}, (t) => [
  unique('rf_billing_webhook_events_provider_event_uq').on(t.paymentProvider, t.providerEventId),
  check('rf_billing_webhook_events_provider_ck', sql`${t.paymentProvider} in ('PADDLE')`),
  check('rf_billing_webhook_events_status_ck', sql`${t.processingStatus} in ('RECEIVED','PROCESSING','PROCESSED','FAILED','IGNORED')`),
  check('rf_billing_webhook_events_retry_count_ck', sql`${t.retryCount} >= 0`),
  check('rf_billing_webhook_events_error_length_ck', sql`${t.safeErrorDetails} is null or length(${t.safeErrorDetails}) <= 1000`),
  index('rf_billing_webhook_events_status_received_idx').on(t.processingStatus, t.receivedAt),
]);

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
