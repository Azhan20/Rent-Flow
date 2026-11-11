import test from 'node:test';
import assert from 'node:assert/strict';
import {
  intervalsOverlap,
  isSerializedAssetAvailable,
  calculateBulkAvailability,
} from './availability';

test('intervalsOverlap detects clear overlaps correctly', () => {
  const a = { start: '2026-11-15T08:00:00Z', end: '2026-11-18T17:00:00Z' };
  const b = { start: '2026-11-17T09:00:00Z', end: '2026-11-20T17:00:00Z' };
  assert.equal(intervalsOverlap(a, b), true);
});

test('intervalsOverlap returns false for non-overlapping dates', () => {
  const a = { start: '2026-11-10T08:00:00Z', end: '2026-11-12T17:00:00Z' };
  const b = { start: '2026-11-15T09:00:00Z', end: '2026-11-18T17:00:00Z' };
  assert.equal(intervalsOverlap(a, b), false);
});

test('intervalsOverlap respects buffer window', () => {
  // A ends at 17:00. B starts at 18:00.
  // Without buffer, they do not overlap.
  // With 120min (2 hours) buffer, A's window extends to 19:00, overlapping B!
  const a = { start: '2026-11-15T08:00:00Z', end: '2026-11-15T17:00:00Z' };
  const b = { start: '2026-11-15T18:00:00Z', end: '2026-11-16T17:00:00Z' };
  assert.equal(intervalsOverlap(a, b, 0), false);
  assert.equal(intervalsOverlap(a, b, 120), true);
});

test('isSerializedAssetAvailable blocks when conflicting with maintenance', () => {
  const requested = { start: '2026-11-20T08:00:00Z', end: '2026-11-22T17:00:00Z' };
  const maintenance = [
    {
      id: 'm1',
      equipmentId: 'eq-cat305',
      assetUnitId: 'unit-001',
      startDate: '2026-11-21T00:00:00Z',
      endDate: '2026-11-21T23:59:59Z',
      status: 'SCHEDULED' as const,
    },
  ];

  const result = isSerializedAssetAvailable('unit-001', requested, [], maintenance);
  assert.equal(result.available, false);
  assert.match(result.conflictReason || '', /maintenance/i);
});

test('calculateBulkAvailability calculates correct remaining stock', () => {
  const requested = { start: '2026-11-15T08:00:00Z', end: '2026-11-18T17:00:00Z' };
  const bookings = [
    {
      id: 'b1',
      bookingNumber: 'BK-101',
      equipmentId: 'scaffolding-set',
      quantity: 5,
      startDate: '2026-11-16T08:00:00Z',
      endDate: '2026-11-17T17:00:00Z',
      status: 'CONFIRMED' as const,
    },
    {
      id: 'b2',
      bookingNumber: 'BK-102',
      equipmentId: 'scaffolding-set',
      quantity: 3,
      startDate: '2026-11-10T08:00:00Z',
      endDate: '2026-11-12T17:00:00Z', // Does not overlap
      status: 'CONFIRMED' as const,
    },
    {
      id: 'b3',
      bookingNumber: 'BK-103',
      equipmentId: 'scaffolding-set',
      quantity: 4,
      startDate: '2026-11-15T08:00:00Z',
      endDate: '2026-11-18T17:00:00Z',
      status: 'CANCELLED' as const, // Cancelled does not count
    },
  ];

  // Total stock is 10. Only b1 overlaps (quantity 5).
  // Available should be 10 - 5 = 5.
  const avail = calculateBulkAvailability(10, requested, bookings);
  assert.equal(avail.totalStock, 10);
  assert.equal(avail.allocatedQuantity, 5);
  assert.equal(avail.availableQuantity, 5);
  assert.equal(avail.isAvailable, true);
});
