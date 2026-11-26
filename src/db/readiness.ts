export const DATABASE_READINESS_QUERY = 'SELECT 1' as const;

/** Run only the fixed read-only readiness query using the application's pool. */
export async function probeDatabaseReadiness(
  query: (statement: typeof DATABASE_READINESS_QUERY) => Promise<unknown>,
): Promise<void> {
  await query(DATABASE_READINESS_QUERY);
}
