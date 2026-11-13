/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EquipmentModel, MaintenanceWorkOrder, Booking } from '../types';
import { generatePredictiveAlerts, PredictiveMaintenanceAlert } from './predictiveMaintenance';

export interface MonthlyMaintenanceForecast {
  monthIndex: number; // 1 to 6
  monthLabel: string; // e.g. "Apr 2026", "May 2026"
  projectedServices: number; // Number of units reaching service thresholds
  plannedDowntimeHours: number; // Cumulative shop hours required
  estimatedCost: number; // Parts + Labor ($)
  affectedEquipmentNames: string[]; // List of machinery names entering shop
  highPriorityCount: number;
}

export interface SixMonthForecastSummary {
  months: MonthlyMaintenanceForecast[];
  totalProjectedServices: number;
  totalPlannedDowntimeHours: number;
  totalEstimatedCost: number;
  peakMonthLabel: string;
  recommendedShopTechFTE: number; // Recommended shop staffing FTE
}

/**
 * Projects fleet maintenance events and planned shop downtime over the next 6 months.
 * Uses current meter hours, historical burn rates (hours/day), and OEM milestone intervals (250h, 500h, 1000h).
 */
export function calculateSixMonthMaintenanceForecast(
  equipmentList: EquipmentModel[],
  maintenanceOrders: MaintenanceWorkOrder[],
  bookings: Booking[],
  startDate: Date = new Date()
): SixMonthForecastSummary {
  const alertsSummary = generatePredictiveAlerts(equipmentList, maintenanceOrders, bookings);
  const alerts = alertsSummary.alerts;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Initialize 6 months
  const monthlyBuckets: MonthlyMaintenanceForecast[] = [];
  const currentMonthIdx = startDate.getMonth();
  const currentYear = startDate.getFullYear();

  for (let i = 1; i <= 6; i++) {
    const targetDate = new Date(currentYear, currentMonthIdx + i, 1);
    const label = `${monthNames[targetDate.getMonth()]} ${targetDate.getFullYear()}`;
    monthlyBuckets.push({
      monthIndex: i,
      monthLabel: label,
      projectedServices: 0,
      plannedDowntimeHours: 0,
      estimatedCost: 0,
      affectedEquipmentNames: [],
      highPriorityCount: 0,
    });
  }

  // Iterate over each serialized asset alert
  alerts.forEach((alert) => {
    const dailyRate = Math.max(alert.dailyBurnRateHours || 0, 4);
    const interval = alert.maintenanceIntervalHours || 250;
    
    // First upcoming service milestone
    let daysToFirstService = Math.max(0, Math.round(alert.remainingHours / dailyRate));
    
    // If already overdue, it falls into month 1 (immediate action)
    if (alert.severity === 'CRITICAL_OVERDUE') {
      daysToFirstService = 3; // First week of month 1
    }

    // Determine standard downtime shop hours and cost by equipment category
    const isHeavy = /excavator|dozer|loader|roller|skid steer/i.test(alert.equipmentName);
    const standardDowntimeHours = isHeavy ? 10 : 6;
    const majorDowntimeHours = isHeavy ? 18 : 12;

    // Simulate service events across 180 days (6 months x 30 days)
    let simulatedDay = daysToFirstService;
    let cycleCount = 1;

    while (simulatedDay <= 180) {
      const monthSlotIndex = Math.min(5, Math.floor(simulatedDay / 30));
      const bucket = monthlyBuckets[monthSlotIndex];

      const isMajorOverhaul = (alert.currentMeterHours + simulatedDay * dailyRate) >= 1000 || cycleCount % 4 === 0;
      const downtimeHours = isMajorOverhaul ? majorDowntimeHours : standardDowntimeHours;
      const cost = isMajorOverhaul ? alert.recommendedService.estimatedCost * 1.8 : alert.recommendedService.estimatedCost;

      bucket.projectedServices += 1;
      bucket.plannedDowntimeHours += downtimeHours;
      bucket.estimatedCost += cost;
      if (!bucket.affectedEquipmentNames.includes(alert.equipmentName)) {
        bucket.affectedEquipmentNames.push(alert.equipmentName);
      }
      if (alert.severity === 'CRITICAL_OVERDUE' || alert.severity === 'HIGH_IMMINENT' || isMajorOverhaul) {
        bucket.highPriorityCount += 1;
      }

      // Next service cycle in ~ (interval / dailyRate) days
      const daysToNextInterval = Math.max(30, Math.round(interval / dailyRate));
      simulatedDay += daysToNextInterval;
      cycleCount++;
    }
  });

  // Calculate totals
  let totalProjectedServices = 0;
  let totalPlannedDowntimeHours = 0;
  let totalEstimatedCost = 0;
  let maxDowntime = -1;
  let peakMonthLabel = monthlyBuckets[0].monthLabel;

  monthlyBuckets.forEach((b) => {
    totalProjectedServices += b.projectedServices;
    totalPlannedDowntimeHours += b.plannedDowntimeHours;
    totalEstimatedCost += b.estimatedCost;

    if (b.plannedDowntimeHours > maxDowntime) {
      maxDowntime = b.plannedDowntimeHours;
      peakMonthLabel = b.monthLabel;
    }
  });

  // Recommended shop technician FTE assuming 140 wrench hours available per tech per month
  const avgMonthlyHours = totalPlannedDowntimeHours / 6;
  const recommendedShopTechFTE = Math.max(1, parseFloat((avgMonthlyHours / 140).toFixed(1)));

  return {
    months: monthlyBuckets,
    totalProjectedServices,
    totalPlannedDowntimeHours,
    totalEstimatedCost,
    peakMonthLabel,
    recommendedShopTechFTE,
  };
}
