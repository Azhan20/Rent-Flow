import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { buildExplicitInsertManyQuery, buildExplicitInsertQuery, tableReturningColumns } from './explicit-insert';
import { bookingItems, bookings, customers, equipment } from './schema';

const dialect = new PgDialect();

function queryColumns(tableName: string, statement: ReturnType<typeof buildExplicitInsertQuery>) {
  const generatedSql = dialect.sqlToQuery(statement).sql;
  const beforeValues = generatedSql.split(' values ')[0];
  assert.ok(beforeValues.startsWith(`insert into "${tableName}" (`), generatedSql);
  return { generatedSql, insertColumnList: beforeValues.slice(beforeValues.indexOf('(') + 1, beforeValues.lastIndexOf(')')) };
}

test('customer INSERT omits defaulted ID and timestamps while returning the complete row', () => {
  const statement = buildExplicitInsertQuery(customers, [
    { column: customers.organizationId, value: 'org' },
    { column: customers.name, value: 'name' },
    { column: customers.companyName, value: null },
    { column: customers.email, value: 'email' },
    { column: customers.phone, value: null },
    { column: customers.billingAddress, value: null },
    { column: customers.notes, value: null },
  ], tableReturningColumns(getTableColumns(customers)));
  const { generatedSql, insertColumnList } = queryColumns('rf_customers', statement);
  assert.equal(insertColumnList, '"organization_id", "name", "company_name", "email", "phone", "billing_address", "notes"');
  assert.match(generatedSql, /values \(\$1, \$2, \$3, \$4, \$5, \$6, \$7\) returning/);
  assert.match(generatedSql, /returning "id" as "id"[\s\S]*"created_at" as "createdAt"[\s\S]*"updated_at" as "updatedAt"$/);
  assert.equal(dialect.sqlToQuery(statement).params.length, 7);
});

test('equipment INSERT omits generated and defaulted columns while returning the complete row', () => {
  const statement = buildExplicitInsertQuery(equipment, [
    { column: equipment.organizationId, value: 'org' },
    { column: equipment.sku, value: 'sku' },
    { column: equipment.name, value: 'name' },
    { column: equipment.description, value: null },
    { column: equipment.categoryId, value: null },
    { column: equipment.dailyRate, value: '1.00' },
    { column: equipment.weeklyRate, value: '2.00' },
    { column: equipment.monthlyRate, value: '3.00' },
    { column: equipment.depositAmount, value: '0.00' },
    { column: equipment.totalUnits, value: 1 },
    { column: equipment.specifications, value: {} },
  ], tableReturningColumns(getTableColumns(equipment)));
  const { generatedSql, insertColumnList } = queryColumns('rf_equipment', statement);
  assert.equal(insertColumnList, '"organization_id", "sku", "name", "description", "category_id", "daily_rate", "weekly_rate", "monthly_rate", "deposit_amount", "total_units", "specifications"');
  assert.match(generatedSql, /values \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10, \$11\) returning/);
  assert.match(generatedSql, /returning "id" as "id"[\s\S]*"active" as "active"[\s\S]*"updated_at" as "updatedAt"$/);
  assert.equal(dialect.sqlToQuery(statement).params.length, 11);
});

test('booking and booking-item INSERTs omit their defaulted columns', () => {
  const bookingStatement = buildExplicitInsertQuery(bookings, [
    { column: bookings.organizationId, value: 'org' },
    { column: bookings.customerId, value: 'customer' },
    { column: bookings.bookingNumber, value: 'number' },
    { column: bookings.startAt, value: new Date('2026-01-01T00:00:00Z') },
    { column: bookings.endAt, value: new Date('2026-01-02T00:00:00Z') },
    { column: bookings.status, value: 'REQUEST' },
    { column: bookings.subtotal, value: '1.00' },
    { column: bookings.taxAmount, value: '0.00' },
    { column: bookings.deliveryFee, value: '0.00' },
    { column: bookings.depositAmount, value: '0.00' },
  ], tableReturningColumns(getTableColumns(bookings)));
  const booking = queryColumns('rf_bookings', bookingStatement);
  assert.equal(booking.insertColumnList, '"organization_id", "customer_id", "booking_number", "start_at", "end_at", "status", "subtotal", "tax_amount", "delivery_fee", "deposit_amount"');
  assert.match(booking.generatedSql, /values \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10\) returning/);
  assert.match(booking.generatedSql, /returning "id" as "id"[\s\S]*"updated_at" as "updatedAt"$/);

  const itemRow = (equipmentId: string) => [
    { column: bookingItems.organizationId, value: 'org' },
    { column: bookingItems.bookingId, value: 'booking' },
    { column: bookingItems.equipmentId, value: equipmentId },
    { column: bookingItems.quantity, value: 1 },
    { column: bookingItems.rateApplied, value: '1.00' },
  ];
  const itemStatement = buildExplicitInsertManyQuery(bookingItems, [itemRow('equipment-1'), itemRow('equipment-2')]);
  const item = queryColumns('rf_booking_items', itemStatement);
  assert.equal(item.insertColumnList, '"organization_id", "booking_id", "equipment_id", "quantity", "rate_applied"');
  assert.match(item.generatedSql, /values \(\$1, \$2, \$3, \$4, \$5\), \(\$6, \$7, \$8, \$9, \$10\)$/);
  assert.doesNotMatch(item.generatedSql, /returning/i);
  assert.equal(dialect.sqlToQuery(itemStatement).params.length, 10);
});
