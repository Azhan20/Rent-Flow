/**
 * RentFlow Rate Calculation, Taxes, Discounts, and Deposit Ledger Engine
 */

export interface RateCard {
  hourlyRate?: number;
  dailyRate: number;
  weeklyRate?: number;
  monthlyRate?: number;
  weekendRate?: number;
  securityDeposit: number;
  minimumRentalDays?: number;
}

export interface PricingOptions {
  startDate: string | Date;
  endDate: string | Date;
  rateCard: RateCard;
  quantity?: number;
  discountPercent?: number; // e.g. 10 for 10%
  taxRatePercent?: number; // e.g. 8.5 for 8.5%
  deliveryFee?: number;
  pickupFee?: number;
}

export interface RentalCostBreakdown {
  durationDays: number;
  effectiveDailyRate: number;
  subtotal: number;
  discountAmount: number;
  netRentalAmount: number;
  deliveryFee: number;
  pickupFee: number;
  taxableAmount: number;
  taxAmount: number;
  securityDeposit: number;
  totalDueNow: number;
  totalRentalRevenue: number; // Excludes refundable deposit
}

/**
 * Calculates rental duration in billable days.
 * Minimum is 1 day.
 */
export function calculateRentalDays(start: string | Date, end: string | Date): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e) || e < s) {
    return 1;
  }
  const diffHours = (e - s) / (1000 * 60 * 60);
  // Rental days standard: <= 24h = 1 day, 25-48h = 2 days, etc.
  const days = Math.ceil(diffHours / 24);
  return Math.max(1, days);
}

/**
 * Calculates optimal rental cost using daily, weekly (7 days), and monthly (28 days) tiers.
 */
export function calculateRentalCost(options: PricingOptions): RentalCostBreakdown {
  const {
    startDate,
    endDate,
    rateCard,
    quantity = 1,
    discountPercent = 0,
    taxRatePercent = 8, // 8% default tax
    deliveryFee = 0,
    pickupFee = 0,
  } = options;

  let days = calculateRentalDays(startDate, endDate);
  if (rateCard.minimumRentalDays && days < rateCard.minimumRentalDays) {
    days = rateCard.minimumRentalDays;
  }

  // Tiered rate calculation: best rate for customer
  // 1 month = 28 days
  // 1 week = 7 days
  const weeklyRate = rateCard.weeklyRate || rateCard.dailyRate * 5; // standard 5x day rate for week
  const monthlyRate = rateCard.monthlyRate || weeklyRate * 3.5; // standard ~17.5x day rate

  let baseItemCost = 0;
  let remainingDays = days;

  if (remainingDays >= 28 && rateCard.monthlyRate) {
    const months = Math.floor(remainingDays / 28);
    baseItemCost += months * monthlyRate;
    remainingDays = remainingDays % 28;
  }

  if (remainingDays >= 7 && rateCard.weeklyRate) {
    const weeks = Math.floor(remainingDays / 7);
    baseItemCost += weeks * weeklyRate;
    remainingDays = remainingDays % 7;
  }

  // Remainder at daily rate, capped at weekly rate if cheaper
  const remainderDaily = remainingDays * rateCard.dailyRate;
  baseItemCost += Math.min(remainderDaily, weeklyRate);

  const subtotal = Math.round(baseItemCost * quantity * 100) / 100;
  const discountAmount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;
  const netRentalAmount = Math.max(0, subtotal - discountAmount);

  const totalLogistics = (deliveryFee + pickupFee);
  const taxableAmount = netRentalAmount + totalLogistics;
  const taxAmount = Math.round(taxableAmount * (taxRatePercent / 100) * 100) / 100;

  // Refundable security deposit (per unit)
  const securityDeposit = (rateCard.securityDeposit || 0) * quantity;

  // Total rental revenue (excluding refundable deposit)
  const totalRentalRevenue = netRentalAmount + totalLogistics + taxAmount;
  // Total due upfront includes refundable security deposit
  const totalDueNow = totalRentalRevenue + securityDeposit;

  return {
    durationDays: days,
    effectiveDailyRate: Math.round((subtotal / (days * quantity)) * 100) / 100,
    subtotal,
    discountAmount,
    netRentalAmount,
    deliveryFee,
    pickupFee,
    taxableAmount,
    taxAmount,
    securityDeposit,
    totalDueNow,
    totalRentalRevenue,
  };
}
