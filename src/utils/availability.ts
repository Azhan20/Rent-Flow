/**
 * Pure Availability & Reservation Engine for RentFlow
 * Handles overlapping date intervals, buffers/cleaning turnaround, maintenance blocks,
 * and serialized vs bulk quantity allocations.
 */

export interface DateInterval {
  start: Date | string | number;
  end: Date | string | number;
}

export interface MaintenanceBlock {
  id: string;
  equipmentId: string;
  assetUnitId?: string;
  startDate: string;
  endDate: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

export interface BookingInterval {
  id: string;
  bookingNumber: string;
  equipmentId: string;
  assetUnitId?: string; // For serialized units
  quantity: number; // For bulk items
  startDate: string;
  endDate: string;
  status:
    | 'QUOTE'
    | 'REQUEST'
    | 'PENDING'
    | 'PENDING_APPROVAL'
    | 'CONFIRMED'
    | 'CHECKED_OUT'
    | 'RETURNED'
    | 'CLOSED'
    | 'CANCELLED'
    | 'OVERDUE'
    | string;
}

/**
 * Checks if two intervals overlap.
 * Uses inclusive start, inclusive end logic with optional turnaround buffer in minutes.
 */
export function intervalsOverlap(
  a: DateInterval,
  b: DateInterval,
  bufferMinutes: number = 0
): boolean {
  const startA = new Date(a.start).getTime();
  const endA = new Date(a.end).getTime() + bufferMinutes * 60 * 1000;
  const startB = new Date(b.start).getTime();
  const endB = new Date(b.end).getTime() + bufferMinutes * 60 * 1000;

  if (isNaN(startA) || isNaN(endA) || isNaN(startB) || isNaN(endB)) {
    throw new Error('Invalid date provided to intervalsOverlap');
  }

  // Interval overlap condition: StartA < EndB and StartB < EndA
  return startA <= endB && startB <= endA;
}

/**
 * Checks if an asset unit is available for a requested interval.
 */
export function isSerializedAssetAvailable(
  assetUnitId: string,
  requestedInterval: DateInterval,
  existingBookings: BookingInterval[],
  maintenanceBlocks: MaintenanceBlock[],
  bufferMinutes: number = 120 // 2 hours cleaning buffer
): { available: boolean; conflictReason?: string } {
  // Check maintenance blocks
  const maintenanceConflict = maintenanceBlocks.find(
    (m) =>
      m.assetUnitId === assetUnitId &&
      m.status !== 'CANCELLED' &&
      m.status !== 'COMPLETED' &&
      intervalsOverlap(
        requestedInterval,
        { start: m.startDate, end: m.endDate },
        0
      )
  );

  if (maintenanceConflict) {
    return {
      available: false,
      conflictReason: `Asset is scheduled for maintenance from ${maintenanceConflict.startDate} to ${maintenanceConflict.endDate}`,
    };
  }

  // Check existing active bookings
  const bookingConflict = existingBookings.find(
    (b) =>
      b.assetUnitId === assetUnitId &&
      ['CONFIRMED', 'CHECKED_OUT', 'PENDING'].includes(b.status) &&
      intervalsOverlap(
        requestedInterval,
        { start: b.startDate, end: b.endDate },
        bufferMinutes
      )
  );

  if (bookingConflict) {
    return {
      available: false,
      conflictReason: `Reserved for Booking #${bookingConflict.bookingNumber} (${bookingConflict.startDate} to ${bookingConflict.endDate})`,
    };
  }

  return { available: true };
}

/**
 * Calculates remaining available quantity for bulk equipment over an interval.
 */
export function calculateBulkAvailability(
  totalStock: number,
  requestedInterval: DateInterval,
  existingBookings: BookingInterval[],
  bufferMinutes: number = 60
): {
  totalStock: number;
  allocatedQuantity: number;
  availableQuantity: number;
  isAvailable: boolean;
} {
  // Sum up all active bookings that overlap with requested interval
  const overlappingBookings = existingBookings.filter(
    (b) =>
      ['CONFIRMED', 'CHECKED_OUT', 'PENDING'].includes(b.status) &&
      intervalsOverlap(
        requestedInterval,
        { start: b.startDate, end: b.endDate },
        bufferMinutes
      )
  );

  const allocatedQuantity = overlappingBookings.reduce(
    (acc, cur) => acc + (cur.quantity || 1),
    0
  );

  const availableQuantity = Math.max(0, totalStock - allocatedQuantity);

  return {
    totalStock,
    allocatedQuantity,
    availableQuantity,
    isAvailable: availableQuantity > 0,
  };
}
