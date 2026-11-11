import test from 'node:test';
import assert from 'node:assert';
import { generatePredictiveAlerts } from './predictiveMaintenance.ts';
import { EquipmentModel, MaintenanceWorkOrder } from '../types/index.ts';

const mockEquipment: EquipmentModel[] = [
  {
    id: 'eq-cat',
    categoryId: 'earthmoving',
    name: 'Caterpillar 305.5 CR Mini Excavator',
    sku: 'CAT-305',
    makeModel: 'CAT 305.5',
    description: 'Mini excavator',
    imageUrl: '',
    isSerialized: true,
    totalStock: 2,
    dailyRate: 350,
    weeklyRate: 1400,
    monthlyRate: 4200,
    securityDeposit: 500,
    replacementValue: 65000,
    maintenanceIntervalHours: 250,
    meterUnit: 'Hours',
    specifications: {},
    assetUnits: [
      {
        id: 'unit-cat-1',
        equipmentModelId: 'eq-cat',
        unitIdentifier: 'EXC-001',
        serialNumber: 'CAT305-9981',
        locationId: 'loc-1',
        currentMeterHours: 242.0, // 8 hours away from 250h -> High Imminent!
        status: 'AVAILABLE',
        conditionNote: 'Good',
      },
      {
        id: 'unit-cat-2',
        equipmentModelId: 'eq-cat',
        unitIdentifier: 'EXC-002',
        serialNumber: 'CAT305-9982',
        locationId: 'loc-1',
        currentMeterHours: 258.5, // 8.5 hours OVER 250h -> Critical Overdue!
        status: 'CHECKED_OUT',
        conditionNote: 'Working',
      },
    ],
  },
  {
    id: 'eq-genie',
    categoryId: 'aerial',
    name: 'Genie S-65 Telescopic Boom Lift',
    sku: 'GEN-S65',
    makeModel: 'Genie S-65',
    description: 'Boom lift',
    imageUrl: '',
    isSerialized: true,
    totalStock: 1,
    dailyRate: 450,
    weeklyRate: 1800,
    monthlyRate: 5400,
    securityDeposit: 800,
    replacementValue: 85000,
    maintenanceIntervalHours: 500,
    meterUnit: 'Hours',
    specifications: {},
    assetUnits: [
      {
        id: 'unit-genie-1',
        equipmentModelId: 'eq-genie',
        unitIdentifier: 'BOM-001',
        serialNumber: 'GENS65-4421',
        locationId: 'loc-1',
        currentMeterHours: 85.0, // Plenty of margin -> Healthy
        status: 'AVAILABLE',
        conditionNote: 'Clean',
      },
    ],
  },
];

test('generatePredictiveAlerts flags overdue machine as CRITICAL_OVERDUE', () => {
  const summary = generatePredictiveAlerts(mockEquipment);
  const overdueAlert = summary.alerts.find((a) => a.unitIdentifier === 'EXC-002');

  assert.ok(overdueAlert, 'Expected alert for EXC-002');
  assert.strictEqual(overdueAlert.severity, 'CRITICAL_OVERDUE');
  assert.ok(overdueAlert.remainingHours <= 0);
  assert.strictEqual(summary.overdueCount, 1);
});

test('generatePredictiveAlerts flags machine within 20h as HIGH_IMMINENT', () => {
  const summary = generatePredictiveAlerts(mockEquipment);
  const imminentAlert = summary.alerts.find((a) => a.unitIdentifier === 'EXC-001');

  assert.ok(imminentAlert, 'Expected alert for EXC-001');
  assert.strictEqual(imminentAlert.severity, 'HIGH_IMMINENT');
  assert.strictEqual(imminentAlert.remainingHours, 8);
  assert.strictEqual(summary.imminentCount, 1);
});

test('generatePredictiveAlerts accounts for past completed maintenance service', () => {
  // Suppose EXC-002 was serviced at 250h, and is now at 258.5h
  const completedOrder: MaintenanceWorkOrder = {
    id: 'wo-101',
    orderNumber: 'WO-101',
    assetUnitId: 'unit-cat-2',
    equipmentName: 'Caterpillar 305.5 CR Mini Excavator',
    unitIdentifier: 'EXC-002',
    title: '250h Service',
    description: 'Oil change done',
    technician: 'Carlos',
    status: 'COMPLETED',
    priority: 'HIGH',
    scheduledDate: '2026-11-01',
    currentHoursAtService: 250.0,
    costParts: 100,
    costLabor: 100,
  };

  const summary = generatePredictiveAlerts(mockEquipment, [completedOrder]);
  const alert = summary.alerts.find((a) => a.unitIdentifier === 'EXC-002');

  assert.ok(alert);
  // Last service at 250h, next target is 250 + 250 = 500h!
  // Current 258.5h means remaining is 500 - 258.5 = 241.5h -> HEALTHY!
  assert.strictEqual(alert.nextServiceTargetHours, 500);
  assert.strictEqual(alert.severity, 'HEALTHY');
});

test('generatePredictiveAlerts correctly calculates estimated days to service', () => {
  const summary = generatePredictiveAlerts(mockEquipment, [], [], { defaultDailyBurnRate: 4 });
  const imminentAlert = summary.alerts.find((a) => a.unitIdentifier === 'EXC-001');

  assert.ok(imminentAlert);
  // 8 hours remaining / 4 hours per day = 2 days
  assert.strictEqual(imminentAlert.estimatedDaysToService, 2);
});
