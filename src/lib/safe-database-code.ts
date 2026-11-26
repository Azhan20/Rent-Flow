/** Return a PostgreSQL SQLSTATE only when it matches the fixed five-character format. */
export function safeDatabaseCode(error: unknown): string | undefined {
  let current = error;
  const seen = new Set<object>();

  for (let depth = 0; depth < 5; depth += 1) {
    if (!current || typeof current !== 'object' || seen.has(current)) return undefined;
    seen.add(current);
    const candidate = (current as { code?: unknown }).code;
    if (typeof candidate === 'string' && /^[0-9A-Z]{5}$/.test(candidate)) return candidate;
    current = (current as { cause?: unknown }).cause;
  }

  return undefined;
}

/** Bounded diagnostic category; never forwards arbitrary driver codes or messages. */
export function safeDatabaseErrorClass(error: unknown): string {
  const code = safeDatabaseCode(error);
  if (!code && hasKnownConnectionFailure(error)) return 'database_connection';
  if (!code) return 'unclassified';
  if (code.startsWith('08')) return 'database_connection';
  if (code.startsWith('28')) return 'database_authentication';
  if (code === '42501') return 'database_permission_or_rls';
  if (code.startsWith('23')) return 'database_constraint';
  if (code.startsWith('42')) return 'database_query_or_schema';
  if (code.startsWith('53') || code.startsWith('57')) return 'database_availability';
  return 'database_error';
}

function hasKnownConnectionFailure(error: unknown): boolean {
  const connectionCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN', 'ENOTFOUND']);
  const pending: unknown[] = [error];
  const seen = new Set<object>();

  for (let checked = 0; pending.length > 0 && checked < 8; checked += 1) {
    const current = pending.pop();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    const item = current as { code?: unknown; cause?: unknown; errors?: unknown };
    if (typeof item.code === 'string' && connectionCodes.has(item.code)) return true;
    if (item.cause && typeof item.cause === 'object') pending.push(item.cause);
    if (Array.isArray(item.errors)) pending.push(...item.errors.slice(0, 8));
  }

  return false;
}
