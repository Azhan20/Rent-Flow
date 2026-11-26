export type EnterpriseOverrideRecord = {
  featureId: string;
  catalogVersion: string;
  value: unknown;
  startsAt: Date;
  endsAt: Date | null;
};

export class EnterpriseOverrideResolutionError extends Error {
  constructor(readonly code: 'AMBIGUOUS' | 'INVALID', message: string) {
    super(message);
    this.name = 'EnterpriseOverrideResolutionError';
  }
}

/**
 * Resolve an override only when exactly one record applies. Never use row
 * ordering to choose between overlapping periods; ambiguity fails closed.
 */
export function resolveEnterpriseOverride(input: {
  rows: readonly EnterpriseOverrideRecord[];
  featureId: string;
  catalogVersion: string;
  now: Date;
}): number | null {
  if (!Number.isFinite(input.now.getTime())) throw new RangeError('Override lookup time must be valid.');
  const applicable = input.rows.filter((row) => row.featureId === input.featureId
    && row.catalogVersion === input.catalogVersion
    && row.startsAt <= input.now
    && (!row.endsAt || row.endsAt > input.now));
  if (applicable.length === 0) return null;
  if (applicable.length > 1) {
    throw new EnterpriseOverrideResolutionError('AMBIGUOUS', 'Multiple Enterprise overrides apply to this account feature.');
  }
  const value = applicable[0].value;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new EnterpriseOverrideResolutionError('INVALID', 'The Enterprise override value is invalid.');
  }
  return value;
}
