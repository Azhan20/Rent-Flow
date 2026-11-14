/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSixMonthMaintenanceForecast } from './maintenanceProjection';
import { EquipmentModel, MaintenanceWorkOrder, Booking } from '../types';

const mockEquipment: EquipmentModel[] = [
  {
    id: 'eq-1',
    categoryId: 'heavy-excavation',
    name: 'CAT 308 Mini Hydraulic Excavator',
    sku: 'CAT-308-X',
    makeModel: 'Caterpillar 308 CR',
    description: '8.5 ton mini excavator',
    imageUrl: 'https://images.unsplash.com/photo-1579829366248-204fe8413f31',
    dailyRate: 480,
    weeklyRate: 1920,
    monthlyRate: 5760,
    securityDeposit: 1500,
    isSerialized: true,
    totalStock: 1,
    maintenanceIntervalHours: 250,
    replacementValue: 125000,
    meterUnit: 'HOURS',
    specifications: {},
    assetUnits: [
      {
        id: 'unit-1',
        equipmentModelId: 'eq-1',
        unitIdentifier: 'CAT308-01',
        serialNumber: 'CAT308-SN-2023-01',
        locationId: 'yard-1',
        currentMeterHours: 252, // Overdue by 2 hours
        status: 'AVAILABLE',
        conditionNote: 'Good condition',
      },
    ],
  },
  {
    id: 'eq-2',
    categoryId: 'aerial-access',
    name: 'Genie S-65 Telescopic Boom Lift',
    sku: 'GEN-S65-A',
    makeModel: 'Genie S-65 TraX',
    description: '65ft diesel 4WD boom',
    imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758',
    dailyRate: 350,
    weeklyRate: 1400,
    monthlyRate: 4200,
    securityDeposit: 1000,
    isSerialized: true,
    totalStock: 1,
    maintenanceIntervalHours: 250,
    replacementValue: 95000,
    meterUnit: 'HOURS',
    specifications: {},
    assetUnits: [
      {
        id: 'unit-2',
        equipmentModelId: 'eq-2',
        unitIdentifier: 'GEN-65-02',
        serialNumber: 'GEN-65-SN-998',
        locationId: 'yard-1',
        currentMeterHours: 242, // Imminent (8 hrs remaining)
        status: 'CHECKED_OUT',
        conditionNote: 'Rental in progress',
      },
    ],
  },
];

const mockOrders: MaintenanceWorkOrder[] = [];
const mockBookings: Booking[] = [
  {
    id: 'b-1',
    bookingNumber: 'RF-2026-001',
    customerId: 'cust-1',
    customerName: 'BuildCorp Global',
    customerEmail: 'ops@buildcorp.com',
    customerPhone: '+1-555-0199',
    locationId: 'yard-1',
    status: 'CHECKED_OUT',
    startDate: '2026-03-01',
    endDate: '2026-04-15',
    subtotal: 4800,
    discountPercent: 0,
    discountAmount: 0,
    taxRatePercent: 0,
    taxAmount: 0,
    deliveryFee: 0,
    pickupFee: 0,
    depositAmount: 1500,
    totalAmount: 4800,
    totalDueNow: 6300,
    items: [
      {
        id: 'item-1',
        equipmentModelId: 'eq-1',
        assetUnitId: 'unit-1',
        equipmentName: 'CAT 308 Mini Hydraulic Excavator',
        quantity: 1,
        dailyRate: 480,
        totalDays: 10,
        lineSubtotal: 4800,
        securityDeposit: 1500,
      },
    ],
    createdAt: '2026-03-01T08:00:00Z',
  },
];

test('calculateSixMonthMaintenanceForecast returns 6 continuous months of projections', () => {
  const forecast = calculateSixMonthMaintenanceForecast(mockEquipment, mockOrders, mockBookings, new Date('2026-04-01'));
  
  assert.equal(forecast.months.length, 6);
  assert.ok(forecast.totalProjectedServices >= 2, 'Should project services for tracked units');
  assert.ok(forecast.totalPlannedDowntimeHours > 0, 'Planned downtime should be positive');
  assert.ok(forecast.totalEstimatedCost > 0, 'Estimated cost should be positive');
  assert.ok(forecast.recommendedShopTechFTE >= 0.1, 'Recommended FTE should be computed');
});

test('Overdue units are scheduled in Month 1 with high priority', () => {
  const forecast = calculateSixMonthMaintenanceForecast(mockEquipment, mockOrders, mockBookings, new Date('2026-04-01'));
  const month1 = forecast.months[0];
  
  assert.ok(month1.projectedServices >= 1, 'Month 1 should receive overdue units immediately');
  assert.ok(month1.highPriorityCount >= 1, 'Overdue units should be marked high priority');
  assert.ok(month1.affectedEquipmentNames.includes('CAT 308 Mini Hydraulic Excavator'));
});
