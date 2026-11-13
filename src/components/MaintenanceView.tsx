import React, { useState, useMemo } from 'react';
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  DollarSign,
  UserCheck,
  Calendar,
  Layers,
  Gauge,
  Activity,
  Zap,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  Filter
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';
import { MaintenanceStatus } from '../types';
import { 
  generatePredictiveAlerts, 
  PredictiveMaintenanceAlert, 
  AlertSeverity 
} from '../utils/predictiveMaintenance';
import { calculateSixMonthMaintenanceForecast } from '../utils/maintenanceProjection';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export const MaintenanceView: React.FC = () => {
  const { maintenanceOrders, equipmentList, bookings, createMaintenanceOrder, updateMaintenanceStatus } = useRentFlow();

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAssetUnitId, setSelectedAssetUnitId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [technician, setTechnician] = useState('Carlos Mendez (Lead Field Tech)');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [costParts, setCostParts] = useState('250');
  const [costLabor, setCostLabor] = useState('200');

  // Predictive Alert Filter
  const [alertFilter, setAlertFilter] = useState<'ACTION_REQUIRED' | 'ALL' | 'OVERDUE'>('ACTION_REQUIRED');

  // Compute live predictive alerts based on usage data & service intervals
  const predictiveSummary = useMemo(() => {
    return generatePredictiveAlerts(equipmentList, maintenanceOrders, bookings);
  }, [equipmentList, maintenanceOrders, bookings]);

  // Compute 6-Month maintenance & downtime projection
  const sixMonthForecast = useMemo(() => {
    return calculateSixMonthMaintenanceForecast(equipmentList, maintenanceOrders, bookings);
  }, [equipmentList, maintenanceOrders, bookings]);

  const [forecastViewMode, setForecastViewMode] = useState<'DOWNTIME' | 'BUDGET'>('DOWNTIME');

  // Collect all serialized units for work order dropdown
  const allSerializedUnits: {
    unitId: string;
    unitIdentifier: string;
    equipmentName: string;
    meterHours: number;
    serialNumber: string;
  }[] = [];

  equipmentList.forEach((eq) => {
    if (eq.isSerialized && eq.assetUnits) {
      eq.assetUnits.forEach((u) => {
        allSerializedUnits.push({
          unitId: u.id,
          unitIdentifier: u.unitIdentifier,
          equipmentName: eq.name,
          meterHours: u.currentMeterHours,
          serialNumber: u.serialNumber,
        });
      });
    }
  });

  // Handle scheduling directly from a predictive alert
  const handleScheduleFromAlert = (alert: PredictiveMaintenanceAlert) => {
    setSelectedAssetUnitId(alert.unitId);
    setTitle(alert.recommendedService.title);
    setDescription(
      `Predictive Maintenance Trigger: Current meter reading is ${alert.currentMeterHours} hrs (service milestone: ${alert.nextServiceTargetHours} hrs). ` +
      `${alert.remainingHours <= 0 ? 'Machine is OVERDUE.' : `Remaining hours: ${alert.remainingHours} hrs (~${alert.estimatedDaysToService} operating days).`} ` +
      `Recommended scope: ${alert.recommendedService.description}`
    );
    setPriority(alert.recommendedService.suggestedPriority);
    setCostParts((alert.recommendedService.estimatedCost * 0.55).toFixed(0));
    setCostLabor((alert.recommendedService.estimatedCost * 0.45).toFixed(0));
    setShowAddModal(true);
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const targetUnit = allSerializedUnits.find((u) => u.unitId === selectedAssetUnitId) || allSerializedUnits[0];
    if (!targetUnit) return;

    createMaintenanceOrder({
      assetUnitId: targetUnit.unitId,
      equipmentName: targetUnit.equipmentName,
      unitIdentifier: targetUnit.unitIdentifier,
      title: title || 'Routine Inspection & Service',
      description: description || 'Safety inspection and fluid replacement per OEM schedule.',
      technician,
      status: 'SCHEDULED',
      priority,
      scheduledDate,
      currentHoursAtService: targetUnit.meterHours,
      costParts: parseFloat(costParts) || 0,
      costLabor: parseFloat(costLabor) || 0,
    });

    setShowAddModal(false);
    setTitle('');
    setDescription('');
  };

  const filteredAlerts = predictiveSummary.alerts.filter((alert) => {
    if (alertFilter === 'OVERDUE') return alert.severity === 'CRITICAL_OVERDUE';
    if (alertFilter === 'ACTION_REQUIRED') {
      return (
        alert.severity === 'CRITICAL_OVERDUE' ||
        alert.severity === 'HIGH_IMMINENT' ||
        alert.severity === 'MEDIUM_UPCOMING'
      );
    }
    return true;
  });

  const priorityColors = {
    LOW: 'bg-slate-100 text-slate-700 border-slate-200',
    MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200',
    HIGH: 'bg-amber-50 text-amber-700 border-amber-200',
    CRITICAL: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  const statusColors: Record<MaintenanceStatus, { label: string; class: string }> = {
    SCHEDULED: { label: 'Scheduled', class: 'bg-blue-50 text-blue-700 border-blue-200' },
    IN_PROGRESS: { label: 'In Progress (Shop)', class: 'bg-amber-50 text-amber-700 border-amber-200' },
    COMPLETED: { label: 'Completed & Certified', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    CANCELLED: { label: 'Cancelled', class: 'bg-slate-100 text-slate-500 border-slate-200' },
  };

  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case 'CRITICAL_OVERDUE':
        return {
          label: 'OVERDUE',
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800',
          indicator: 'bg-rose-500 animate-pulse',
        };
      case 'HIGH_IMMINENT':
        return {
          label: 'SERVICE IMMINENT',
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
          indicator: 'bg-amber-500',
        };
      case 'MEDIUM_UPCOMING':
        return {
          label: 'UPCOMING SERVICE',
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
          indicator: 'bg-blue-500',
        };
      case 'HEALTHY':
        return {
          label: 'HEALTHY MARGIN',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
          indicator: 'bg-emerald-500',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Wrench className="h-6 w-6 text-amber-500" />
              Maintenance & Predictive Telematics
            </h1>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
              <Activity className="w-3 h-3 text-blue-500 animate-pulse" />
              Auto-Alerts Active
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time telemetry analysis forecasting service intervals, machine wear burn rates, and preventive work orders.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (allSerializedUnits[0]) setSelectedAssetUnitId(allSerializedUnits[0].unitId);
            setShowAddModal(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New Work Order</span>
        </button>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">Overdue Service</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-1">{predictiveSummary.overdueCount}</p>
          <span className="text-[10px] text-slate-400">Exceeded OEM interval threshold</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Imminent (&lt;20h)</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">{predictiveSummary.imminentCount}</p>
          <span className="text-[10px] text-slate-400">&ge;95% of service cycle consumed</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Upcoming (&lt;50h)</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">{predictiveSummary.upcomingCount}</p>
          <span className="text-[10px] text-slate-400">&ge;85% of service cycle consumed</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Healthy Margin</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{predictiveSummary.healthyCount}</p>
          <span className="text-[10px] text-slate-400">Out of {predictiveSummary.totalSerializedTracked} tracked units</span>
        </div>
      </div>

      {/* Predictive Maintenance Telematics Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Machine Service Interval Radar
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live equipment usage monitoring predicting runout times and triggering automated shop dispatch recommendations.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            <button
              onClick={() => setAlertFilter('ACTION_REQUIRED')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                alertFilter === 'ACTION_REQUIRED'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Action Required ({predictiveSummary.overdueCount + predictiveSummary.imminentCount + predictiveSummary.upcomingCount})
            </button>
            <button
              onClick={() => setAlertFilter('OVERDUE')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                alertFilter === 'OVERDUE'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-rose-600'
              }`}
            >
              Overdue ({predictiveSummary.overdueCount})
            </button>
            <button
              onClick={() => setAlertFilter('ALL')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                alertFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Tracked Units ({predictiveSummary.totalSerializedTracked})
            </button>
          </div>
        </div>

        {/* Predictive Alert Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAlerts.length > 0 ? (
            filteredAlerts.map((alert) => {
              const badge = getSeverityBadge(alert.severity);
              const isOverdue = alert.remainingHours <= 0;

              return (
                <div
                  key={alert.unitId}
                  className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${
                    alert.severity === 'CRITICAL_OVERDUE'
                      ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900 shadow-xs'
                      : alert.severity === 'HIGH_IMMINENT'
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900 shadow-xs'
                      : alert.severity === 'MEDIUM_UPCOMING'
                      ? 'bg-blue-50/30 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900'
                      : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Identifiers */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${badge.indicator}`} />
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                          {alert.unitIdentifier}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          SN: {alert.serialNumber}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.badgeClass}`}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Machine Name */}
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
                        {alert.equipmentName}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Interval: <span className="font-semibold text-slate-700 dark:text-slate-300">{alert.maintenanceIntervalHours} hrs</span> • Last Serviced: {alert.lastServicedHours}h
                      </p>
                    </div>

                    {/* Meter Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Gauge className="w-3.5 h-3.5 text-slate-400" />
                          Current Meter: <span className="font-mono font-bold text-slate-900 dark:text-white">{alert.currentMeterHours}h</span>
                        </span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          Target: {alert.nextServiceTargetHours}h
                        </span>
                      </div>

                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isOverdue
                              ? 'bg-rose-600'
                              : alert.percentElapsed >= 90
                              ? 'bg-amber-500'
                              : 'bg-blue-600'
                          }`}
                          style={{ width: `${Math.min(100, alert.percentElapsed)}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[11px] text-slate-500 pt-0.5">
                        <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600 dark:text-slate-300'}>
                          {isOverdue 
                            ? `Overdue by ${Math.abs(alert.remainingHours)} hrs` 
                            : `${alert.remainingHours} hrs remaining`}
                        </span>
                        <span className="text-slate-400 font-mono">
                          {alert.percentElapsed}% cycle elapsed
                        </span>
                      </div>
                    </div>

                    {/* Projected Runout Forecast */}
                    <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-amber-500" />
                          Est. Daily Usage:
                        </span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {alert.dailyBurnRateHours} hrs/day
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Service Runout Window:</span>
                        <span className={`font-bold ${isOverdue ? 'text-rose-600' : 'text-amber-600 dark:text-amber-400'}`}>
                          {isOverdue ? 'Service Immediate' : `~${alert.estimatedDaysToService} days`}
                        </span>
                      </div>
                    </div>

                    {/* OEM Service Scope */}
                    <div className="text-xs pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                        Recommended OEM Action:
                      </span>
                      <p className="text-slate-700 dark:text-slate-300 font-medium line-clamp-2">
                        {alert.recommendedService.title}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer Action */}
                  <div className="pt-3 mt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                    {alert.isWorkOrderActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Work Order In Progress
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleScheduleFromAlert(alert)}
                        className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                          isOverdue
                            ? 'bg-rose-600 hover:bg-rose-500 text-white'
                            : 'bg-amber-600 hover:bg-amber-500 text-white'
                        }`}
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Schedule Service Order</span>
                        <ArrowRight className="w-3 h-3 ml-0.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-bold text-slate-700 dark:text-slate-300">All Machinery Operating Within Safety Margins</p>
              <p className="text-[11px] text-slate-500 mt-0.5">No units currently require immediate service interventions.</p>
            </div>
          )}
        </div>
      </div>

      {/* 6-Month Projected Fleet Service Intervals & Downtime Planning (Recharts) */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <TrendingUp className="w-3.5 h-3.5" />
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                6-Month Projected Service Intervals & Downtime Forecast
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Operations downtime planner projecting machine maintenance intervals, shop hours, and servicing expenses.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setForecastViewMode('DOWNTIME')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  forecastViewMode === 'DOWNTIME'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Services & Shop Hours
              </button>
              <button
                type="button"
                onClick={() => setForecastViewMode('BUDGET')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  forecastViewMode === 'BUDGET'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Projected Budget ($)
              </button>
            </div>
          </div>
        </div>

        {/* 4 Operations Planning Metric Pills */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">6-Mo Projected Services</span>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{sixMonthForecast.totalProjectedServices} Units</p>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400">Scheduled milestone intervals</span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Planned Shop Downtime</span>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{sixMonthForecast.totalPlannedDowntimeHours} Hours</p>
            <span className="text-[10px] text-slate-500">Bay occupancy required</span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Peak Downtime Month</span>
            <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{sixMonthForecast.peakMonthLabel}</p>
            <span className="text-[10px] text-slate-500">Highest fleet shop demand</span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Estimated Budget</span>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              ${sixMonthForecast.totalEstimatedCost.toLocaleString()}
            </p>
            <span className="text-[10px] text-slate-500">Rec. Shop Techs: {sixMonthForecast.recommendedShopTechFTE} FTE</span>
          </div>
        </div>

        {/* Visual Trend Chart */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {forecastViewMode === 'DOWNTIME' ? (
              <AreaChart data={sixMonthForecast.months} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorServices" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorDowntime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: 'Service Units', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10, fill: '#6366f1' } }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: 'Downtime (Hours)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fontSize: 10, fill: '#f59e0b' } }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as typeof sixMonthForecast.months[0];
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-700">
                          <p className="font-bold text-sm text-indigo-300">{label}</p>
                          <div className="space-y-1 text-[11px]">
                            <p className="flex justify-between gap-4">
                              <span className="text-slate-400">Projected Services:</span>
                              <span className="font-semibold text-white">{data.projectedServices} machines</span>
                            </p>
                            <p className="flex justify-between gap-4">
                              <span className="text-slate-400">Planned Shop Downtime:</span>
                              <span className="font-semibold text-amber-400">{data.plannedDowntimeHours} hours</span>
                            </p>
                            <p className="flex justify-between gap-4">
                              <span className="text-slate-400">Est. Parts & Labor:</span>
                              <span className="font-semibold text-emerald-400">${data.estimatedCost.toLocaleString()}</span>
                            </p>
                            {data.affectedEquipmentNames.length > 0 && (
                              <div className="pt-1 border-t border-slate-700 text-[10px] text-slate-300">
                                <span className="text-slate-400 block font-medium">Entering Shop:</span>
                                <span>{data.affectedEquipmentNames.slice(0, 3).join(', ')}{data.affectedEquipmentNames.length > 3 ? ` +${data.affectedEquipmentNames.length - 3} more` : ''}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="projectedServices"
                  name="Projected Machine Services (Units)"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorServices)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="plannedDowntimeHours"
                  name="Planned Shop Downtime (Hours)"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#f59e0b' }}
                />
              </AreaChart>
            ) : (
              <AreaChart data={sixMonthForecast.months} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `$${val}`} />
                <Tooltip
                  formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'Estimated Maintenance Budget']}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="estimatedCost"
                  name="Projected Maintenance Budget ($)"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorCost)"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Proactive Shop Planning Note */}
        <div className="flex items-center gap-2.5 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl p-3 text-xs text-blue-900 dark:text-blue-200">
          <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <p className="text-[11px] leading-relaxed">
            <span className="font-bold">Operations Dispatch Recommendation:</span> Peak shop downtime is projected in <span className="font-semibold underline decoration-blue-400">{sixMonthForecast.peakMonthLabel}</span>. Pre-order fast-moving OEM filter kits (hydraulic, fuel, and engine oil) and schedule shop services during mid-week customer turnaround windows to maintain &ge;92% fleet availability.
          </p>
        </div>
      </div>

      {/* Work Orders Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              Active & Historic Work Orders ({maintenanceOrders.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Service logs, technician records, and cost tracking.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Equipment & Unit</th>
                <th className="px-4 py-3">Work Order Title</th>
                <th className="px-4 py-3">Technician</th>
                <th className="px-4 py-3">Scheduled</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Cost (Parts+Labor)</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {maintenanceOrders.map((wo) => {
                const pColor = priorityColors[wo.priority];
                const sBadge = statusColors[wo.status] || {
                  label: wo.status,
                  class: 'bg-slate-100 text-slate-600',
                };
                const totalCost = wo.costParts + wo.costLabor;

                return (
                  <tr key={wo.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                      {wo.orderNumber}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{wo.unitIdentifier}</span>
                      <p className="text-[11px] text-slate-400 truncate max-w-[180px]">
                        {wo.equipmentName}
                      </p>
                    </td>
                    <td className="px-4 py-3 max-w-[240px]">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{wo.title}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{wo.description}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{wo.technician}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{wo.scheduledDate}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${pColor}`}>
                        {wo.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={wo.status}
                        onChange={(e) => updateMaintenanceStatus(wo.id, e.target.value as MaintenanceStatus)}
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-bold cursor-pointer bg-white dark:bg-slate-800 ${sBadge.class}`}
                      >
                        <option value="SCHEDULED">Scheduled</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                      ${totalCost.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {wo.status !== 'COMPLETED' && (
                        <button
                          type="button"
                          onClick={() => updateMaintenanceStatus(wo.id, 'COMPLETED')}
                          className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                        >
                          Mark Done
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Work Order Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700 mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-500" />
                Schedule Maintenance Work Order
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Target Equipment Unit *
                </label>
                <select
                  value={selectedAssetUnitId}
                  onChange={(e) => setSelectedAssetUnitId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-white font-medium"
                >
                  {allSerializedUnits.map((u) => (
                    <option key={u.unitId} value={u.unitId}>
                      {u.unitIdentifier} — {u.equipmentName} ({u.meterHours} hrs)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Work Order Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 500h Engine & Hydraulic Filter Service"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Scope of Work & Replaced Parts
                </label>
                <textarea
                  rows={3}
                  placeholder="Detail filters, fluids, torque specs, or OEM inspection checklist items..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Assigned Technician
                  </label>
                  <input
                    type="text"
                    value={technician}
                    onChange={(e) => setTechnician(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-white font-medium"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Parts Cost ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={costParts}
                    onChange={(e) => setCostParts(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Labor Cost ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={costLabor}
                    onChange={(e) => setCostLabor(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Confirm & Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
