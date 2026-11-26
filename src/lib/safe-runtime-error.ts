export function safeRuntimeErrorType(error: unknown): string {
  const name = (error as { name?: unknown } | null)?.name;
  return typeof name === 'string' && /^[A-Za-z]+Error$/.test(name) ? name : 'Error';
}
