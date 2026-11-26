import React, { useState, useMemo } from 'react';
import {
  Calendar,
  X,
  Truck,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  User,
  Plus,
  DollarSign,
  MapPin,
  Clock,
} from 'lucide-react';
import { useRentFlow } from '../context/RentFlowContext';
import { calculateRentalCost } from '../utils/pricing';
import { isSerializedAssetAvailable, calculateBulkAvailability } from '../utils/availability';
import { addCalendarDays, getCalendarDateInTimeZone, getRentalTimeZone, isValidDateRange } from '../utils/dateTime';
import { BookingItem } from '../types';

interface NewBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedEquipmentId?: string;
}

export const NewBookingModal: React.FC<NewBookingModalProps> = ({
  isOpen,
  onClose,
  preSelectedEquipmentId,
}) => {
  const {
    currentOrg,
    equipmentList,
    customers,
    bookings,
    maintenanceOrders,
    createBooking,
  } = useRentFlow();

  // Date-only rental values use the organization's calendar, not a UTC timestamp.
  const rentalTimeZone = getRentalTimeZone(currentOrg.timezone);
  const today = getCalendarDateInTimeZone(rentalTimeZone);
  const defaultStart = addCalendarDays(today, 1);
  const defaultEnd = addCalendarDays(today, 4);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [dateRangeError, setDateRangeError] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(preSelectedEquipmentId || equipmentList[0]?.id || '');
  const [selectedAssetUnitId, setSelectedAssetUnitId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [selectedLocationId, setSelectedLocationId] = useState(currentOrg.locations[0]?.id || 'loc-1');
  const [isDelivery, setIsDelivery] = useState(true);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [customerNotes, setCustomerNotes] = useState('');

  const selectedEquipment = equipmentList.find((e) => e.id === selectedEquipmentId) || equipmentList[0];
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0];

  // Map bookings to format required by availability checker
  const bookingIntervals = useMemo(() => {
    return bookings.map((b) => ({
      id: b.id,
      bookingNumber: b.bookingNumber,
      equipmentId: b.items[0]?.equipmentModelId || '',
      assetUnitId: b.items[0]?.assetUnitId,
      quantity: b.items[0]?.quantity || 1,
      startDate: b.startDate,
      endDate: b.endDate,
      status: b.status,
    }));
  }, [bookings]);

  // Check availability for selected asset or bulk
  const availabilityCheck = useMemo(() => {
    if (!selectedEquipment) return { isAvailable: false, message: 'Select equipment' };
    if (!isValidDateRange(startDate, endDate)) {
      return { isAvailable: false, message: 'Choose a valid pickup date and a later return date.' };
    }

    const interval = { start: startDate, end: endDate };

    if (selectedEquipment.isSerialized && selectedEquipment.assetUnits) {
      // Find eligible unit
      const candidateUnits = selectedEquipment.assetUnits.filter((u) => {
        const res = isSerializedAssetAvailable(
          u.id,
          interval,
          bookingIntervals,
          maintenanceOrders.map((m) => ({
            id: m.id,
            equipmentId: '',
            assetUnitId: m.assetUnitId,
            startDate: m.scheduledDate,
            endDate: m.completedDate || m.scheduledDate,
            status: m.status,
          }))
        );
        return res.available;
      });

      if (candidateUnits.length === 0) {
        return {
          isAvailable: false,
          message: 'All serialized units of this model are reserved or in maintenance for these dates.',
          units: [],
        };
      }

      return {
        isAvailable: true,
        message: `${candidateUnits.length} units available for this date window.`,
        units: candidateUnits,
      };
    } else {
      // Bulk item availability
      const bulkCheck = calculateBulkAvailability(
        selectedEquipment.totalStock,
        interval,
        bookingIntervals
      );

      if (bulkCheck.availableQuantity < quantity) {
        return {
          isAvailable: false,
          message: `Only ${bulkCheck.availableQuantity} units available (requested ${quantity}).`,
        };
      }

      return {
        isAvailable: true,
        message: `${bulkCheck.availableQuantity} bulk units available.`,
      };
    }
  }, [selectedEquipment, startDate, endDate, bookingIntervals, maintenanceOrders, quantity]);

  // Live Pricing Calculation
  const costBreakdown = useMemo(() => {
    if (!selectedEquipment) {
      return {
        durationDays: 1,
        subtotal: 0,
        discountAmount: 0,
        netRentalAmount: 0,
        deliveryFee: 0,
        pickupFee: 0,
        taxAmount: 0,
        securityDeposit: 0,
        totalDueNow: 0,
        totalRentalRevenue: 0,
      };
    }

    return calculateRentalCost({
      startDate,
      endDate,
      rateCard: {
        dailyRate: selectedEquipment.dailyRate,
        weeklyRate: selectedEquipment.weeklyRate,
        monthlyRate: selectedEquipment.monthlyRate,
        securityDeposit: selectedEquipment.securityDeposit,
      },
      quantity: selectedEquipment.isSerialized ? 1 : quantity,
      discountPercent,
      taxRatePercent: currentOrg.taxRatePercent || 8.25,
      deliveryFee: isDelivery ? 100 : 0,
      pickupFee: isDelivery ? 100 : 0,
    });
  }, [selectedEquipment, startDate, endDate, quantity, discountPercent, isDelivery, currentOrg]);

  if (!isOpen) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidDateRange(startDate, endDate)) {
      setDateRangeError('Return date must be after pickup date.');
      return;
    }
    setDateRangeError('');
    if (!availabilityCheck.isAvailable) return;

    // Pick assigned unit if serialized
    let assignedUnitId = selectedAssetUnitId;
    if (selectedEquipment.isSerialized && !assignedUnitId && availabilityCheck.units?.[0]) {
      assignedUnitId = availabilityCheck.units[0].id;
    }

    const items: BookingItem[] = [
      {
        id: `bi-${Date.now()}`,
        equipmentModelId: selectedEquipment.id,
        assetUnitId: assignedUnitId || undefined,
        equipmentName: `${selectedEquipment.name} ${
          assignedUnitId
            ? `(Unit ${
                selectedEquipment.assetUnits?.find((u) => u.id === assignedUnitId)?.unitIdentifier || 'Assigned'
              })`
            : ''
        }`,
        quantity: selectedEquipment.isSerialized ? 1 : quantity,
        dailyRate: selectedEquipment.dailyRate,
        totalDays: costBreakdown.durationDays,
        lineSubtotal: costBreakdown.subtotal,
        securityDeposit: costBreakdown.securityDeposit,
      },
    ];

    createBooking({
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.companyName
        ? `${selectedCustomer.name} (${selectedCustomer.companyName})`
        : selectedCustomer.name,
      customerEmail: selectedCustomer.email,
      customerPhone: selectedCustomer.phone,
      locationId: selectedLocationId,
      startDate,
      endDate,
      status: 'CONFIRMED',
      items,
      subtotal: costBreakdown.subtotal,
      discountPercent,
      discountAmount: costBreakdown.discountAmount,
      taxRatePercent: currentOrg.taxRatePercent,
      taxAmount: costBreakdown.taxAmount,
      deliveryFee: costBreakdown.deliveryFee,
      pickupFee: costBreakdown.pickupFee,
      depositAmount: costBreakdown.securityDeposit,
      totalAmount: costBreakdown.totalRentalRevenue,
      totalDueNow: costBreakdown.totalDueNow,
      deliveryAddress: isDelivery ? deliveryAddress || selectedCustomer.billingAddress : 'Customer Yard Pickup',
      customerNotes,
      internalNotes: `Auto-confirmed reservation via Operations Dispatch. Invoice issued.`,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl space-y-4 overflow-y-auto overscroll-contain rounded-xl bg-white p-4 shadow-xl sm:p-6">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase tracking-wider border border-blue-200">
              New Booking Engine
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Create Equipment Reservation
            </h2>
            <p className="text-xs text-slate-500">
              Instant date conflict verification, rate calculation, and invoice issuance.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            aria-label="Close new booking dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          {/* Customer Selection */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-500" />
                Customer Account *
              </label>
              <span className="text-[11px] text-slate-500">
                Credit Limit: ${selectedCustomer?.creditLimit.toLocaleString()}
              </span>
            </div>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 font-medium focus:border-blue-500 focus:outline-hidden"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.companyName ? `• ${c.companyName}` : ''} ({c.email})
                </option>
              ))}
            </select>
          </div>

          {/* Dates & Duration Picker */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="booking-start-date" className="text-xs font-semibold text-slate-700 block mb-1">
                Pickup / Dispatch Date *
              </label>
              <input
                id="booking-start-date"
                type="date"
                required
                min={today}
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setDateRangeError(''); }}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 font-medium focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="booking-end-date" className="text-xs font-semibold text-slate-700 block mb-1">
                Estimated Return Date *
              </label>
              <input
                id="booking-end-date"
                type="date"
                required
                min={startDate ? addCalendarDays(startDate, 1) : addCalendarDays(today, 1)}
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setDateRangeError(''); }}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 font-medium focus:border-blue-500"
              />
            </div>
          </div>
          {dateRangeError && <p role="alert" className="text-xs font-medium text-rose-700">{dateRangeError}</p>}

          {/* Equipment Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 block">
              Equipment / Machinery Asset *
            </label>
            <select
              value={selectedEquipmentId}
              onChange={(e) => {
                setSelectedEquipmentId(e.target.value);
                setSelectedAssetUnitId('');
              }}
              className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 font-semibold focus:border-blue-500"
            >
              {equipmentList.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  [{eq.sku}] {eq.name} — ${eq.dailyRate}/day (${eq.weeklyRate}/wk)
                </option>
              ))}
            </select>

            {/* Serialized Unit or Bulk Quantity Selection */}
            {selectedEquipment.isSerialized && availabilityCheck.units && availabilityCheck.units.length > 0 && (
              <div className="mt-2">
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Assign Specific Unit (Optional - Auto-allocated if empty):
                </label>
                <select
                  value={selectedAssetUnitId}
                  onChange={(e) => setSelectedAssetUnitId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-xs text-slate-800"
                >
                  <option value="">Auto-Assign Optimal Available Unit</option>
                  {availabilityCheck.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unitIdentifier} (SN: {u.serialNumber} • {u.currentMeterHours}h meter)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!selectedEquipment.isSerialized && (
              <div className="mt-2 flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-700">
                  Bulk Quantity:
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedEquipment.totalStock}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-24 rounded-lg border border-slate-200 p-1.5 text-xs text-slate-900 font-semibold"
                />
                <span className="text-xs text-slate-400">
                  Total in fleet: {selectedEquipment.totalStock} units
                </span>
              </div>
            )}

            {/* Availability Indicator */}
            <div
              className={`flex items-center gap-2 rounded-lg p-2.5 text-xs font-medium border ${
                availabilityCheck.isAvailable
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {availabilityCheck.isAvailable ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <span>{availabilityCheck.message}</span>
            </div>
          </div>

          {/* Delivery & Logistics Options */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-slate-500" />
                Transport Logistics
              </span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="transport"
                    checked={isDelivery}
                    onChange={() => setIsDelivery(true)}
                  />
                  <span>Flatbed Delivery ($200 roundtrip)</span>
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="transport"
                    checked={!isDelivery}
                    onChange={() => setIsDelivery(false)}
                  />
                  <span>Customer Yard Pickup ($0)</span>
                </label>
              </div>
            </div>

            {isDelivery && (
              <input
                type="text"
                placeholder="Job site address (e.g. 1500 Red River St, Austin, TX)"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500"
              />
            )}
          </div>

          {/* Pricing Breakdown Card */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-700">
              <span>Rental Duration:</span>
              <span className="font-bold text-slate-900">{costBreakdown.durationDays} Billable Days</span>
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span>Equipment Subtotal:</span>
              <span className="font-bold text-slate-900">${costBreakdown.subtotal.toFixed(2)}</span>
            </div>
            {isDelivery && (
              <div className="flex items-center justify-between text-slate-700">
                <span>Delivery & Return Logistics:</span>
                <span className="font-bold text-slate-900">$200.00</span>
              </div>
            )}
            <div className="flex items-center justify-between text-slate-700">
              <span>State & Local Tax ({currentOrg.taxRatePercent}%):</span>
              <span className="font-bold text-slate-900">${costBreakdown.taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-purple-800 font-semibold border-t border-blue-200 pt-1.5">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Refundable Security Deposit:
              </span>
              <span>${costBreakdown.securityDeposit.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-bold text-slate-950 border-t border-blue-200 pt-2">
              <span>Total Upfront Due (with Deposit):</span>
              <span className="text-base text-blue-700">${costBreakdown.totalDueNow.toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-slate-500 italic">
              *Net rental revenue is ${(costBreakdown.totalRentalRevenue).toFixed(2)}. The security deposit of ${(costBreakdown.securityDeposit).toFixed(2)} is held in escrow and returned after inspection.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!availabilityCheck.isAvailable}
              className={`w-full rounded-lg px-5 py-2 text-xs font-semibold text-white shadow-xs transition-colors sm:w-auto ${
                availabilityCheck.isAvailable
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              Confirm Reservation & Issue Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
