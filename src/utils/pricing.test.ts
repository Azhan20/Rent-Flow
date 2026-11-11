import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRentalDays, calculateRentalCost } from './pricing';

test('calculateRentalDays handles 24h intervals as 1 day', () => {
  const start = '2026-11-15T08:00:00Z';
  const end = '2026-11-16T08:00:00Z';
  assert.equal(calculateRentalDays(start, end), 1);
});

test('calculateRentalDays handles 3 day rental period', () => {
  const start = '2026-11-15T08:00:00Z';
  const end = '2026-11-18T08:00:00Z';
  assert.equal(calculateRentalDays(start, end), 3);
});

test('calculateRentalCost calculates tiered weekly discount when applicable', () => {
  const rateCard = {
    dailyRate: 150,
    weeklyRate: 600, // 4x daily rate instead of 7x daily rate ($1050)
    securityDeposit: 500,
  };

  const cost = calculateRentalCost({
    startDate: '2026-11-15T08:00:00Z',
    endDate: '2026-11-22T08:00:00Z', // 7 days
    rateCard,
    quantity: 1,
    taxRatePercent: 10,
    discountPercent: 0,
    deliveryFee: 50,
  });

  // Subtotal should use weeklyRate ($600), not 7 * 150 ($1050)
  assert.equal(cost.subtotal, 600);
  assert.equal(cost.deliveryFee, 50);
  // Taxable: 600 + 50 = 650. 10% tax = 65.
  assert.equal(cost.taxAmount, 65);
  // Revenue: 650 + 65 = 715.
  assert.equal(cost.totalRentalRevenue, 715);
  // Deposit: 500. Total due now: 715 + 500 = 1215.
  assert.equal(cost.securityDeposit, 500);
  assert.equal(cost.totalDueNow, 1215);
});
