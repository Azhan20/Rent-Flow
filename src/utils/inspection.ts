/**
 * Inspection, Damage Assessment & Deposit Reconciliation Engine
 */

export interface InspectionChecklist {
  cleanCondition: boolean;
  fluidLevelsOk: boolean;
  safetyGuardsIntact: boolean;
  tiresOrTracksOk: boolean;
  controlsFunctional: boolean;
  accessoriesPresent: boolean;
}

export interface MeterReading {
  startHours: number;
  endHours: number;
  allowedHoursPerDay?: number; // e.g. 8 hours/day included
  excessHourlyRate?: number; // e.g. $45/hour
}

export interface ReturnCharges {
  damageDescription?: string;
  damageCharge: number;
  cleaningFee: number;
  refuelingFee: number;
  lateFee: number;
  meterOverageFee: number;
}

export interface DepositSettlement {
  originalDeposit: number;
  totalCharges: number;
  netRefundDue: number; // positive = refund to customer
  customerBalanceDue: number; // positive = customer owes additional amount beyond deposit
  chargesBreakdown: ReturnCharges;
  settlementStatus: 'FULL_REFUND' | 'PARTIAL_REFUND' | 'EXHAUSTED' | 'BALANCE_DUE';
}

/**
 * Calculates excess meter charges based on allowed hours.
 */
export function calculateMeterOverage(
  meter: MeterReading,
  rentalDays: number
): number {
  if (!meter.allowedHoursPerDay || !meter.excessHourlyRate) return 0;
  const hoursUsed = Math.max(0, meter.endHours - meter.startHours);
  const totalAllowed = meter.allowedHoursPerDay * rentalDays;
  const excessHours = Math.max(0, hoursUsed - totalAllowed);
  return Math.round(excessHours * meter.excessHourlyRate * 100) / 100;
}

/**
 * Reconciles the security deposit against damage, cleaning, refueling, late fees, and meter overage.
 */
export function reconcileDeposit(
  originalDeposit: number,
  charges: ReturnCharges
): DepositSettlement {
  const totalCharges =
    (charges.damageCharge || 0) +
    (charges.cleaningFee || 0) +
    (charges.refuelingFee || 0) +
    (charges.lateFee || 0) +
    (charges.meterOverageFee || 0);

  const diff = originalDeposit - totalCharges;

  let netRefundDue = 0;
  let customerBalanceDue = 0;
  let settlementStatus: DepositSettlement['settlementStatus'] = 'FULL_REFUND';

  if (diff > 0) {
    netRefundDue = diff;
    settlementStatus = totalCharges > 0 ? 'PARTIAL_REFUND' : 'FULL_REFUND';
  } else if (diff === 0) {
    settlementStatus = 'EXHAUSTED';
  } else {
    // charges exceed deposit
    customerBalanceDue = Math.abs(diff);
    settlementStatus = 'BALANCE_DUE';
  }

  return {
    originalDeposit,
    totalCharges,
    netRefundDue,
    customerBalanceDue,
    chargesBreakdown: charges,
    settlementStatus,
  };
}
