import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Truck,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';

export const CalendarDispatchView: React.FC = () => {
  const { currentOrg, bookings, equipmentList, updateEquipment } = useRentFlow();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [transferModal, setTransferModal] = useState<{
    equipmentId: string;
    unitId: string;
    unitIdentifier: string;
    currentLocationId: string;
  } | null>(null);
  const [targetLocationId, setTargetLocationId] = useState<string>(currentOrg.locations[1]?.id || 'loc-2');
  const [transferSuccess, setTransferSuccess] = useState(false);

  // Generate 14 day schedule columns
  const scheduleDays = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 2 + i);
    return {
      dateStr: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: d.getDate(),
      isToday: i === 2,
    };
  });

  const handleExecuteTransfer = () => {
    if (!transferModal) return;

    const targetEq = equipmentList.find((e) => e.id === transferModal.equipmentId);
    if (targetEq && targetEq.assetUnits) {
      const updatedUnits = targetEq.assetUnits.map((u) =>
        u.id === transferModal.unitId
          ? {
              ...u,
              locationId: targetLocationId,
              conditionNote: `Transferred to ${
                currentOrg.locations.find((l) => l.id === targetLocationId)?.name || 'Depot'
              } on ${new Date().toISOString().split('T')[0]}.`,
            }
          : u
      );
      updateEquipment(targetEq.id, { assetUnits: updatedUnits });
    }

    setTransferSuccess(true);
    setTimeout(() => {
      setTransferSuccess(false);
      setTransferModal(null);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Dispatch, Schedule & Yard Transfers
          </h1>
          <p className="text-xs text-slate-500">
            Multi-depot timeline: Track equipment movements, pickups, returns, and transfer assets between yards.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-blue-600" />
            Filter Yard:
          </label>
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:border-blue-500"
          >
            <option value="all">All Regional Depots ({currentOrg.locations.length})</option>
            {currentOrg.locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Yard Depot Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {currentOrg.locations.map((loc) => {
          let unitsInYard = 0;
          equipmentList.forEach((eq) => {
            if (eq.isSerialized && eq.assetUnits) {
              unitsInYard += eq.assetUnits.filter((u) => u.locationId === loc.id).length;
            }
          });

          return (
            <div
              key={loc.id}
              className={`rounded-xl border p-4 transition-all shadow-2xs ${
                selectedLocationId === loc.id || selectedLocationId === 'all'
                  ? 'border-blue-200 bg-white'
                  : 'border-slate-200 bg-slate-50/50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-[10px] font-bold text-blue-600">
                    {loc.code}
                  </span>
                  <h3 className="font-bold text-slate-900 text-xs mt-0.5">{loc.name}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{loc.address}</p>
                </div>
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                  {unitsInYard} Units
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual Gantt / Schedule Timeline */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">14-Day Fleet Dispatch Horizon</h2>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500"></span> Checked Out
            </span>
            <span className="flex items-center gap-1 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-500"></span> Confirmed Reservation
            </span>
            <span className="flex items-center gap-1 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-500"></span> Maintenance
            </span>
          </div>
        </div>

        {/* Calendar Grid Header */}
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-14 gap-1 text-center border-b border-slate-200 pb-2">
              {scheduleDays.map((day) => (
                <div
                  key={day.dateStr}
                  className={`p-1.5 rounded-lg ${
                    day.isToday ? 'bg-blue-600 text-white font-bold' : 'text-slate-600'
                  }`}
                >
                  <span className="text-[10px] block uppercase">{day.dayName}</span>
                  <span className="text-xs font-bold">{day.dayNumber}</span>
                </div>
              ))}
            </div>

            {/* Asset Rows */}
            <div className="mt-3 space-y-3">
              {equipmentList.slice(0, 5).map((item) => (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                    <span className="truncate max-w-sm">{item.name}</span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      SKU: {item.sku}
                    </span>
                  </div>

                  {item.assetUnits?.map((unit) => {
                    // Check if unit is in booking
                    const matchingBooking = bookings.find((b) =>
                      b.items.some((i) => i.assetUnitId === unit.id)
                    );

                    const locationName =
                      currentOrg.locations.find((l) => l.id === unit.locationId)?.code || 'DEP';

                    return (
                      <div
                        key={unit.id}
                        className="grid grid-cols-14 gap-1 items-center bg-slate-50/70 p-1 rounded-lg border border-slate-100 text-[10px]"
                      >
                        <div className="col-span-2 font-mono font-bold text-slate-700 flex items-center justify-between pr-2 border-r border-slate-200">
                          <span>{unit.unitIdentifier}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setTransferModal({
                                equipmentId: item.id,
                                unitId: unit.id,
                                unitIdentifier: unit.unitIdentifier,
                                currentLocationId: unit.locationId,
                              })
                            }
                            className="text-[9px] text-blue-600 hover:text-blue-800 underline ml-1"
                            title="Transfer yard"
                          >
                            [{locationName}]
                          </button>
                        </div>

                        {/* Visual timeline bar spanning cols 3 to 14 */}
                        <div className="col-span-12 relative h-6 bg-slate-100 rounded-md overflow-hidden flex items-center px-2">
                          {matchingBooking ? (
                            <div
                              className={`absolute inset-y-0.5 rounded-md px-2 flex items-center text-[10px] font-bold text-white shadow-2xs ${
                                matchingBooking.status === 'CHECKED_OUT'
                                  ? 'bg-amber-500'
                                  : 'bg-blue-600'
                              }`}
                              style={{ left: '10%', right: '25%' }}
                            >
                              <span className="truncate">
                                #{matchingBooking.bookingNumber} • {matchingBooking.customerName}
                              </span>
                            </div>
                          ) : unit.status === 'MAINTENANCE' ? (
                            <div className="absolute inset-y-0.5 left-4 right-10 rounded-md bg-rose-500 text-white px-2 flex items-center text-[10px] font-bold">
                              Scheduled Maintenance & Rigging Inspection
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px] italic">
                              Available at {locationName}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Yard Transfer Modal */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3">
              <span className="font-mono text-xs font-bold text-blue-600 flex items-center gap-1">
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Inter-Depot Equipment Transfer
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                Transfer Unit {transferModal.unitIdentifier}
              </h3>
              <p className="text-slate-500">
                Logistics relocation between maintenance yards and customer pickup depots.
              </p>
            </div>

            {transferSuccess ? (
              <div className="rounded-lg bg-emerald-50 p-4 text-center font-bold text-emerald-800">
                Unit successfully reassigned to target yard!
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Current Stationed Depot:
                  </label>
                  <p className="font-bold text-slate-800 bg-slate-50 p-2 rounded-lg border">
                    {currentOrg.locations.find((l) => l.id === transferModal.currentLocationId)?.name || 'Unknown'}
                  </p>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Destination Depot *
                  </label>
                  <select
                    value={targetLocationId}
                    onChange={(e) => setTargetLocationId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 font-semibold text-slate-900 focus:border-blue-500"
                  >
                    {currentOrg.locations
                      .filter((l) => l.id !== transferModal.currentLocationId)
                      .map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} ({loc.code})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setTransferModal(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteTransfer}
                    className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
                  >
                    Dispatch Transfer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
