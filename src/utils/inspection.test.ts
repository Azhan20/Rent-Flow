import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMeterOverage, reconcileDeposit } from './inspection';

test('calculateMeterOverage bills for hours over threshold', () => {
  const meter = {
    startHours: 1200,
    endHours: 1228, // 28 hours used
    allowedHoursPerDay: 8,
    excessHourlyRate: 50,
  };
  const rentalDays = 3; // 3 * 8 = 24 hours allowed. 4 excess hours!
  const charge = calculateMeterOverage(meter, rentalDays);
  assert.equal(charge, 200); // 4 * 50 = $200
});

test('reconcileDeposit returns full refund when no charges occur', () => {
  const settlement = reconcileDeposit(500, {
    damageCharge: 0,
    cleaningFee: 0,
    refuelingFee: 0,
    lateFee: 0,
    meterOverageFee: 0,
  });
  assert.equal(settlement.totalCharges, 0);
  assert.equal(settlement.netRefundDue, 500);
  assert.equal(settlement.customerBalanceDue, 0);
  assert.equal(settlement.settlementStatus, 'FULL_REFUND');
});

test('reconcileDeposit handles damage deduction with partial refund', () => {
  const settlement = reconcileDeposit(1000, {
    damageCharge: 350,
    cleaningFee: 75,
    refuelingFee: 50,
    lateFee: 0,
    meterOverageFee: 0,
  });
  assert.equal(settlement.totalCharges, 475);
  assert.equal(settlement.netRefundDue, 525);
  assert.equal(settlement.customerBalanceDue, 0);
  assert.equal(settlement.settlementStatus, 'PARTIAL_REFUND');
});

test('reconcileDeposit handles charges exceeding deposit (BALANCE_DUE)', () => {
  const settlement = reconcileDeposit(500, {
    damageCharge: 800,
    cleaningFee: 100,
    refuelingFee: 0,
    lateFee: 0,
    meterOverageFee: 0,
  });
  assert.equal(settlement.totalCharges, 900);
  assert.equal(settlement.netRefundDue, 0);
  assert.equal(settlement.customerBalanceDue, 400);
  assert.equal(settlement.settlementStatus, 'BALANCE_DUE');
});
