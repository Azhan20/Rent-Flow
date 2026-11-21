import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';

export const BOOKING_AVAILABILITY_LOCK_NAMESPACE = 'rentflow:booking-availability:v1';
const BOOKING_AVAILABILITY_LOCK_SEED = 0;

export interface BookingAdvisoryLockExecutor {
  execute(query: SQLWrapper): unknown;
}

/**
 * Produces one namespaced PostgreSQL advisory-lock key per organization and
 * equipment pair. UUID case is normalized before de-duplication and sorting.
 */
export function getBookingAvailabilityLockKeys(organizationId: string, equipmentIds: string[]): string[] {
  const normalizedOrganizationId = organizationId.toLowerCase();
  return [...new Set(equipmentIds.map((equipmentId) => equipmentId.toLowerCase()))]
    .map((equipmentId) => `${BOOKING_AVAILABILITY_LOCK_NAMESPACE}:${normalizedOrganizationId}:${equipmentId}`)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

export function requestedEquipmentIsTenantScoped(
  organizationId: string,
  requestedEquipmentIds: string[],
  rows: Array<{ id: string; organizationId: string }>,
): boolean {
  const requested = new Set(requestedEquipmentIds.map((equipmentId) => equipmentId.toLowerCase()));
  return requested.size === requestedEquipmentIds.length && rows.length === requested.size &&
    rows.every((row) => row.organizationId.toLowerCase() === organizationId.toLowerCase() && requested.has(row.id.toLowerCase()));
}

export function createBookingAvailabilityLockQuery(lockKey: string): SQL {
  return sql`
    select pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(${lockKey}, ${BOOKING_AVAILABILITY_LOCK_SEED})
    )
  `;
}

/** Acquire every requested resource lock sequentially in deterministic order. */
export async function acquireBookingAvailabilityLocks(
  executor: BookingAdvisoryLockExecutor,
  organizationId: string,
  equipmentIds: string[],
): Promise<void> {
  for (const lockKey of getBookingAvailabilityLockKeys(organizationId, equipmentIds)) {
    await executor.execute(createBookingAvailabilityLockQuery(lockKey));
  }
}
