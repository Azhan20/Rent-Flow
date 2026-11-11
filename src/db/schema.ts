import { pgTable, serial, text, timestamp, integer, numeric, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table with Firebase Auth UID
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  role: text('role').default('OPERATIONS'), // SUPER_ADMIN, ORG_ADMIN, OPERATIONS, INSPECTOR, CUSTOMER
  orgId: text('org_id').default('org-apex'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Organizations table
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan').notNull().default('GROWTH'),
  depotAddress: text('depot_address'),
  lat: numeric('lat'),
  lng: numeric('lng'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Equipment table
export const equipment = pgTable('equipment', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  sku: text('sku').notNull(),
  dailyRate: numeric('daily_rate').notNull(),
  weeklyRate: numeric('weekly_rate').notNull(),
  monthlyRate: numeric('monthly_rate').notNull(),
  depositAmount: numeric('deposit_amount').notNull(),
  turnaroundBufferHours: integer('turnaround_buffer_hours').default(4),
  totalUnits: integer('total_units').default(1),
  availableUnits: integer('available_units').default(1),
  specs: jsonb('specs'),
  imageUrl: text('image_url'),
  model3dType: text('model_3d_type').default('excavator'), // excavator, boom_lift, generator
  createdAt: timestamp('created_at').defaultNow(),
});

// Bookings table
export const bookings = pgTable('bookings', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  equipmentId: text('equipment_id').notNull(),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  status: text('status').notNull().default('PENDING_DEPOSIT'), // PENDING_DEPOSIT, CONFIRMED, ACTIVE, COMPLETED, CANCELLED, OVERDUE
  quantity: integer('quantity').default(1),
  totalRentalPrice: numeric('total_rental_price').notNull(),
  depositAmount: numeric('deposit_amount').notNull(),
  deliveryAddress: text('delivery_address'),
  deliveryLat: numeric('delivery_lat'),
  deliveryLng: numeric('delivery_lng'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Inspections table
export const inspections = pgTable('inspections', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull(),
  orgId: text('org_id').notNull(),
  type: text('type').notNull(), // CHECKOUT, CHECKIN
  inspectorName: text('inspector_name').notNull(),
  hourMeter: numeric('hour_meter').notNull(),
  fuelLevel: integer('fuel_level').notNull(),
  cleanliness: text('cleanliness').notNull(),
  checklist: jsonb('checklist'),
  photos: jsonb('photos'),
  audioTranscript: text('audio_transcript'),
  notes: text('notes'),
  damageCharge: numeric('damage_charge').default('0'),
  cleaningFee: numeric('cleaning_fee').default('0'),
  refuelFee: numeric('refuel_fee').default('0'),
  totalDeductions: numeric('total_deductions').default('0'),
  refundedDeposit: numeric('refunded_deposit').default('0'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relationships
export const usersRelations = relations(users, ({ one }) => ({
  org: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
}));

export const equipmentRelations = relations(equipment, ({ one, many }) => ({
  org: one(organizations, {
    fields: [equipment.orgId],
    references: [organizations.id],
  }),
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  equipment: one(equipment, {
    fields: [bookings.equipmentId],
    references: [equipment.id],
  }),
  inspections: many(inspections),
}));
