import { EquipmentModel, AssetUnit, MaintenanceWorkOrder, Booking } from '../types/index.ts';

export type AlertSeverity = 'CRITICAL_OVERDUE' | 'HIGH_IMMINENT' | 'MEDIUM_UPCOMING' | 'HEALTHY';

export interface PredictiveMaintenanceAlert {
  unitId: string;
  unitIdentifier: string;
  serialNumber: string;
  equipmentId: string;
  equipmentName: string;
  category: string;
  currentMeterHours: number;
  lastServicedHours: number;
  maintenanceIntervalHours: number;
  nextServiceTargetHours: number;
  remainingHours: number;
  percentElapsed: number;
  severity: AlertSeverity;
  estimatedDaysToService: number;
  dailyBurnRateHours: number;
  isWorkOrderActive: boolean;
  recommendedService: {
    title: string;
    description: string;
    suggestedPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    estimatedCost: number;
  };
}

export interface PredictiveSummary {
  alerts: PredictiveMaintenanceAlert[];
  overdueCount: number;
  imminentCount: number;
  upcomingCount: number;
  healthyCount: number;
  totalSerializedTracked: number;
}

/**
 * Calculates predictive maintenance metrics for all serialized units in the fleet.
 */
export function generatePredictiveAlerts(
  equipmentList: EquipmentModel[],
  maintenanceOrders: MaintenanceWorkOrder[] = [],
  bookings: Booking[] = [],
  options: {
    upcomingThresholdPercent?: number; // default 85%
    imminentThresholdPercent?: number; // default 95%
    defaultDailyBurnRate?: number;     // default 6 hours/day
  } = {}
): PredictiveSummary {
  const upcomingThreshold = options.upcomingThresholdPercent ?? 85;
  const imminentThreshold = options.imminentThresholdPercent ?? 95;
  const defaultDailyBurn = options.defaultDailyBurnRate ?? 6;

  const alerts: PredictiveMaintenanceAlert[] = [];

  equipmentList.forEach((eq) => {
    if (!eq.isSerialized || !eq.assetUnits || eq.assetUnits.length === 0) {
      return;
    }

    const interval = eq.maintenanceIntervalHours > 0 ? eq.maintenanceIntervalHours : 250;

    eq.assetUnits.forEach((unit) => {
      // Find orders for this unit
      const unitOrders = maintenanceOrders.filter((o) => o.assetUnitId === unit.id);
      
      // Determine if there is already an active work order in progress or scheduled
      const isWorkOrderActive = unitOrders.some(
        (o) => o.status === 'SCHEDULED' || o.status === 'IN_PROGRESS'
      );

      // Find the most recent completed service meter reading
      const completedOrders = unitOrders.filter((o) => o.status === 'COMPLETED');
      const lastServicedHours = completedOrders.reduce(
        (max, o) => Math.max(max, o.currentHoursAtService || 0),
        0
      );

      // Next service milestone target after the last recorded completed service
      const nextServiceTargetHours = lastServicedHours === 0
        ? interval
        : (Math.floor(lastServicedHours / interval) + 1) * interval;

      const remainingHours = Number((nextServiceTargetHours - unit.currentMeterHours).toFixed(1));
      const hoursSinceLastService = Math.max(0, unit.currentMeterHours - lastServicedHours);

      // Percentage of current service cycle elapsed
      const cycleElapsed = Math.max(0, unit.currentMeterHours - lastServicedHours);
      const percentElapsed = remainingHours <= 0
        ? 100
        : Math.min(100, Math.max(0, Math.round((cycleElapsed / interval) * 100)));

      // Estimate daily burn rate from recent bookings
      const unitBookings = bookings.filter((b) => 
        b.items.some((item) => item.assetUnitId === unit.id || item.equipmentModelId === eq.id)
      );
      const dailyBurnRate = unitBookings.length > 0 ? defaultDailyBurn : 4.5;
      const estimatedDaysToService = remainingHours > 0 ? Math.ceil(remainingHours / dailyBurnRate) : 0;

      // Severity classification
      let severity: AlertSeverity = 'HEALTHY';
      if (remainingHours <= 0) {
        severity = 'CRITICAL_OVERDUE';
      } else if (remainingHours <= 20 || percentElapsed >= imminentThreshold) {
        severity = 'HIGH_IMMINENT';
      } else if (remainingHours <= 50 || percentElapsed >= upcomingThreshold) {
        severity = 'MEDIUM_UPCOMING';
      }

      // Tailored OEM recommendation
      const categoryStr = eq.categoryId || eq.name || '';
      const recommendedService = getServiceRecommendation(categoryStr, nextServiceTargetHours, interval);

      alerts.push({
        unitId: unit.id,
        unitIdentifier: unit.unitIdentifier,
        serialNumber: unit.serialNumber,
        equipmentId: eq.id,
        equipmentName: eq.name,
        category: eq.categoryId,
        currentMeterHours: unit.currentMeterHours,
        lastServicedHours,
        maintenanceIntervalHours: interval,
        nextServiceTargetHours,
        remainingHours,
        percentElapsed,
        severity,
        estimatedDaysToService,
        dailyBurnRateHours: dailyBurnRate,
        isWorkOrderActive,
        recommendedService,
      });
    });
  });

  // Sort alerts: CRITICAL_OVERDUE first, then HIGH_IMMINENT, then MEDIUM_UPCOMING
  const severityRank: Record<AlertSeverity, number> = {
    CRITICAL_OVERDUE: 0,
    HIGH_IMMINENT: 1,
    MEDIUM_UPCOMING: 2,
    HEALTHY: 3,
  };

  alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  const overdueCount = alerts.filter((a) => a.severity === 'CRITICAL_OVERDUE').length;
  const imminentCount = alerts.filter((a) => a.severity === 'HIGH_IMMINENT').length;
  const upcomingCount = alerts.filter((a) => a.severity === 'MEDIUM_UPCOMING').length;
  const healthyCount = alerts.filter((a) => a.severity === 'HEALTHY').length;

  return {
    alerts,
    overdueCount,
    imminentCount,
    upcomingCount,
    healthyCount,
    totalSerializedTracked: alerts.length,
  };
}

/**
 * Returns specific OEM maintenance recommendations based on machine type and interval.
 */
function getServiceRecommendation(
  category: string,
  targetHours: number,
  interval: number
): {
  title: string;
  description: string;
  suggestedPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedCost: number;
} {
  const isMajorService = targetHours % 1000 === 0 || targetHours % 500 === 0;
  const cat = (category || '').toLowerCase();

  if (cat.includes('earth') || cat.includes('excavator')) {
    if (isMajorService) {
      return {
        title: `${targetHours}h Major Hydraulic & Powertrain Service`,
        description: 'Flush hydraulic circuit, replace return & pilot filters, calibrate main relief valves, and inspect track tensioner seals.',
        suggestedPriority: 'HIGH',
        estimatedCost: 650,
      };
    }
    return {
      title: `${targetHours}h Preventive Engine & Undercarriage Service`,
      description: 'Engine oil & filter renewal, fuel water separator drain, grease 24 pivot pins, and inspect bucket teeth wear.',
      suggestedPriority: 'MEDIUM',
      estimatedCost: 320,
    };
  }

  if (cat.includes('aerial') || cat.includes('lift')) {
    return {
      title: `${targetHours}h Safety Interlock & Hydraulic Hose Audit`,
      description: 'Non-destructive weld testing, cable tension measurement, platform tilt sensor zero-calibration, and hydraulic ram seal inspection.',
      suggestedPriority: 'HIGH',
      estimatedCost: 480,
    };
  }

  if (cat.includes('power') || cat.includes('generator')) {
    return {
      title: `${targetHours}h Generator Load Bank & Alternator Test`,
      description: 'Lube oil replacement, fuel filter change, radiator fin wash, insulation resistance megger test, and 2-hour 100% resistive load bank run.',
      suggestedPriority: 'MEDIUM',
      estimatedCost: 380,
    };
  }

  return {
    title: `${targetHours}h OEM Scheduled Preventive Service`,
    description: 'Comprehensive multi-point mechanical inspection, fluid sampling, filter replacements, and safety decal validation.',
    suggestedPriority: 'MEDIUM',
    estimatedCost: 350,
  };
}
