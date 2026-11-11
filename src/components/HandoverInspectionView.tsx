import React, { useState } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Camera,
  PenTool,
  Clock,
  ShieldCheck,
  DollarSign,
  UserCheck,
  FileCheck,
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';
import { reconcileDeposit } from '../utils/inspection';
import { VoiceInspectionRecorder } from './VoiceInspectionRecorder';

interface HandoverInspectionViewProps {
  initialBookingId?: string;
  initialType?: 'CHECKOUT' | 'RETURN';
}

export const HandoverInspectionView: React.FC<HandoverInspectionViewProps> = ({
  initialBookingId,
  initialType = 'CHECKOUT',
}) => {
  const {
    bookings,
    processCheckoutInspection,
    processReturnInspection,
    setActiveView,
  } = useRentFlow();

  const [inspectionType, setInspectionType] = useState<'CHECKOUT' | 'RETURN'>(initialType);
  const [selectedBookingId, setSelectedBookingId] = useState<string>(() => {
    if (initialBookingId) return initialBookingId;
    if (initialType === 'RETURN') {
      const active = bookings.find((b) => b.status === 'CHECKED_OUT');
      return active ? active.id : bookings[0]?.id || '';
    } else {
      const confirmed = bookings.find((b) => b.status === 'CONFIRMED');
      return confirmed ? confirmed.id : bookings[0]?.id || '';
    }
  });

  // Inspection Checklist State
  const [cleanCondition, setCleanCondition] = useState(true);
  const [fluidsChecked, setFluidsChecked] = useState(true);
  const [safetyEquipmentOk, setSafetyEquipmentOk] = useState(true);
  const [controlsTested, setControlsTested] = useState(true);
  const [tiresTracksOk, setTiresTracksOk] = useState(true);
  const [accessoriesPresent, setAccessoriesPresent] = useState(true);

  const [meterReading, setMeterReading] = useState('1125.0');
  const [performedBy, setPerformedBy] = useState('Jake Thornton (Yard Inspector)');
  const [notes, setNotes] = useState('');
  const [signatureName, setSignatureName] = useState('');

  // Return Damage Fees State
  const [damageDescription, setDamageDescription] = useState('');
  const [damageCharge, setDamageCharge] = useState('0');
  const [cleaningFee, setCleaningFee] = useState('0');
  const [refuelFee, setRefuelFee] = useState('0');
  const [hasPhotoAttached, setHasPhotoAttached] = useState(true);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const currentBooking = bookings.find((b) => b.id === selectedBookingId);

  // Reconcile deposit calculation
  const settlement = currentBooking
    ? reconcileDeposit(currentBooking.depositAmount || 0, {
        damageCharge: parseFloat(damageCharge) || 0,
        cleaningFee: parseFloat(cleaningFee) || 0,
        refuelingFee: parseFloat(refuelFee) || 0,
        lateFee: 0,
        meterOverageFee: 0,
      })
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBooking) return;

    if (inspectionType === 'CHECKOUT') {
      processCheckoutInspection(currentBooking.id, {
        bookingId: currentBooking.id,
        performedBy,
        meterReading: parseFloat(meterReading) || 0,
        checklist: {
          cleanCondition,
          fluidsChecked,
          safetyEquipmentOk,
          controlsTested,
          tiresTracksOk,
          accessoriesPresent,
        },
        damageCharge: 0,
        cleaningFee: 0,
        refuelFee: 0,
        notes: notes || 'Equipment clean and verified. Operator safety brief delivered.',
        customerSignature: signatureName || `${currentBooking.customerName} [Digital Auth]`,
      });
    } else {
      processReturnInspection(
        currentBooking.id,
        {
          bookingId: currentBooking.id,
          performedBy,
          meterReading: parseFloat(meterReading) || 0,
          checklist: {
            cleanCondition,
            fluidsChecked,
            safetyEquipmentOk,
            controlsTested,
            tiresTracksOk,
            accessoriesPresent,
          },
          notes: notes || 'Return inspection concluded. Meter and fluid levels recorded.',
          customerSignature: signatureName || `${currentBooking.customerName} [Return Receipt Auth]`,
        },
        parseFloat(damageCharge) || 0,
        parseFloat(cleaningFee) || 0,
        parseFloat(refuelFee) || 0
      );
    }

    setSubmittedSuccess(true);
    setTimeout(() => {
      setActiveView('bookings');
    }, 1500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Digital Handover & Return Inspection
        </h1>
        <p className="text-xs text-slate-500">
          Electronic condition assessment, meter telematics recording, and deposit escrow reconciliation.
        </p>
      </div>

      {/* Mode Selector Toggle */}
      <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
        <button
          type="button"
          onClick={() => {
            setInspectionType('CHECKOUT');
            setSubmittedSuccess(false);
          }}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
            inspectionType === 'CHECKOUT'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          1. Outbound Handover (Check-Out)
        </button>
        <button
          type="button"
          onClick={() => {
            setInspectionType('RETURN');
            setSubmittedSuccess(false);
          }}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
            inspectionType === 'RETURN'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          2. Inbound Return & Damage Reconciliation
        </button>
      </div>

      {submittedSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <h4 className="text-xs font-bold">Inspection Successfully Recorded & Logged!</h4>
            <p className="text-xs text-emerald-700">
              Fleet telematics updated, deposit ledger reconciled. Redirecting to bookings list...
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Select Active Booking */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">
              1
            </span>
            Target Reservation Contract
          </h2>

          <select
            value={selectedBookingId}
            onChange={(e) => setSelectedBookingId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-900 font-semibold focus:bg-white focus:border-blue-500"
          >
            {bookings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bookingNumber} • {b.customerName} • [{b.status}] ({b.items[0]?.equipmentName})
              </option>
            ))}
          </select>

          {currentBooking && (
            <div className="rounded-lg bg-slate-50 p-3 text-xs border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <span className="text-[11px] text-slate-400 block">Customer</span>
                <span className="font-semibold text-slate-800">{currentBooking.customerName}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Rental Dates</span>
                <span className="font-semibold text-slate-800">{currentBooking.startDate} → {currentBooking.endDate}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Security Deposit Held</span>
                <span className="font-bold text-purple-700">${currentBooking.depositAmount}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Delivery Site</span>
                <span className="font-semibold text-slate-800 truncate block">{currentBooking.deliveryAddress || 'Depot'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: 6-Point Inspection Checklist */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">
              2
            </span>
            Standard 6-Point Safety & Condition Checklist
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-2.5 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={cleanCondition}
                onChange={(e) => setCleanCondition(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-semibold text-slate-800 block">Clean Condition</span>
                <span className="text-[11px] text-slate-400">Cab, chassis & engine bay free of excessive mud</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-2.5 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={fluidsChecked}
                onChange={(e) => setFluidsChecked(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-semibold text-slate-800 block">Fluid Levels & Fuel Tank</span>
                <span className="text-[11px] text-slate-400">Diesel full, hydraulic oil & coolant at spec</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-2.5 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={safetyEquipmentOk}
                onChange={(e) => setSafetyEquipmentOk(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-semibold text-slate-800 block">Safety Restraints & Beacon</span>
                <span className="text-[11px] text-slate-400">Seat belt, strobe, horn, backup alarm operational</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-2.5 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={controlsTested}
                onChange={(e) => setControlsTested(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-semibold text-slate-800 block">Controls & Hydraulics Tested</span>
                <span className="text-[11px] text-slate-400">Boom, travel levers, steering, emergency stops pass</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-2.5 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={tiresTracksOk}
                onChange={(e) => setTiresTracksOk(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-semibold text-slate-800 block">Tracks / Tires Integrity</span>
                <span className="text-[11px] text-slate-400">No deep cuts, track tension calibrated</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-2.5 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={accessoriesPresent}
                onChange={(e) => setAccessoriesPresent(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-semibold text-slate-800 block">Accessories & Manuals Attached</span>
                <span className="text-[11px] text-slate-400">Pins, teeth, keys, operator manual in waterproof case</span>
              </div>
            </label>
          </div>
        </div>

        {/* Step 3: Meter Telematics & Inspector Log */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">
              3
            </span>
            Telemetry & Inspector Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Hour Meter Reading *
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={meterReading}
                onChange={(e) => setMeterReading(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-2 font-mono text-xs font-bold text-slate-900 focus:border-blue-500"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Recorded from machine dashboard digital tachometer.
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Inspector Name & Depot Staff *
              </label>
              <input
                type="text"
                required
                value={performedBy}
                onChange={(e) => setPerformedBy(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 focus:border-blue-500"
              />
            </div>

            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 block">
                  Handover / Return Notes & Observations
                </label>
                <VoiceInspectionRecorder
                  onTranscriptComplete={(text) => {
                    setNotes((prev) => (prev ? `${prev} [Voice Note]: ${text}` : `[Voice Note]: ${text}`));
                  }}
                  label="Dictate Notes with Gemini 3.5"
                />
              </div>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Note any cosmetic scratches, jobsite conditions, or customer handover instructions..."
                className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Step 4: (RETURN ONLY) Damage, Cleaning, Fuel, and Deposit Escrow Settlement */}
        {inspectionType === 'RETURN' && settlement && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-amber-950 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-200 text-[11px] font-bold text-amber-900">
                4
              </span>
              Damage Assessment & Deposit Escrow Settlement
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Damage Repair Charge ($)
                </label>
                <input
                  type="number"
                  min="0"
                  value={damageCharge}
                  onChange={(e) => setDamageCharge(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Cleaning Fee ($)
                </label>
                <input
                  type="number"
                  min="0"
                  value={cleaningFee}
                  onChange={(e) => setCleaningFee(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Refueling Fee ($)
                </label>
                <input
                  type="number"
                  min="0"
                  value={refuelFee}
                  onChange={(e) => setRefuelFee(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 font-semibold"
                />
              </div>
            </div>

            {parseFloat(damageCharge) > 0 && (
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Damage Description & Parts Required:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Scratched right counterweight panel and broken rear work lamp"
                  value={damageDescription}
                  onChange={(e) => setDamageDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900"
                />
              </div>
            )}

            {/* Live Deposit Reconciliation Summary */}
            <div className="rounded-xl border border-amber-200 bg-white p-4 space-y-2 text-xs">
              <div className="flex justify-between font-medium text-slate-700">
                <span>Original Security Deposit Held:</span>
                <span className="font-bold text-slate-900">${settlement.originalDeposit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-medium text-slate-700">
                <span>Total Assessed Deductions:</span>
                <span className="font-bold text-rose-600">-${settlement.totalCharges.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2">
                <span>
                  {settlement.settlementStatus === 'BALANCE_DUE'
                    ? 'Additional Customer Balance Due:'
                    : 'Net Deposit Refund to Customer:'}
                </span>
                <span
                  className={
                    settlement.settlementStatus === 'BALANCE_DUE'
                      ? 'text-rose-600 font-black'
                      : 'text-emerald-700 font-black'
                  }
                >
                  ${(settlement.settlementStatus === 'BALANCE_DUE'
                    ? settlement.customerBalanceDue
                    : settlement.netRefundDue
                  ).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Digital Signature Pad Simulator */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">
              {inspectionType === 'RETURN' ? '5' : '4'}
            </span>
            Customer Handover Acknowledgement & Digital Signature
          </h2>

          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center space-y-2">
            <PenTool className="mx-auto h-6 w-6 text-slate-400" />
            <p className="text-xs text-slate-600">
              "I hereby acknowledge the equipment condition listed above, verify fluid and meter readings, and agree to standard RentFlow terms of hire."
            </p>
            <input
              type="text"
              required
              placeholder="Type full legal name to digitally sign (e.g. Marcus Vance)"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              className="mx-auto max-w-sm w-full rounded-lg border border-slate-300 bg-white p-2 text-center text-xs font-serif font-bold text-slate-900 shadow-2xs focus:border-blue-500"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            className={`rounded-xl px-6 py-2.5 text-xs font-bold text-white shadow-md transition-all ${
              inspectionType === 'CHECKOUT'
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {inspectionType === 'CHECKOUT'
              ? 'Complete Check-Out & Release Machine'
              : 'Complete Return & Settle Deposit'}
          </button>
        </div>
      </form>
    </div>
  );
};
