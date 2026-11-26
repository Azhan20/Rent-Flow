function parseSerializedOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.origin !== value) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/** Same-origin browser calls are always allowed; cross-origin calls need an explicit allowlist entry. */
export function isRequestOriginAllowed(
  origin: string | undefined,
  requestOrigin: string | undefined,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  if (!origin) return true;
  const parsedOrigin = parseSerializedOrigin(origin);
  if (!parsedOrigin) return false;

  const parsedRequestOrigin = parseSerializedOrigin(requestOrigin);
  return parsedOrigin === parsedRequestOrigin || allowedOrigins.has(parsedOrigin);
}
