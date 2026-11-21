export function getAuthErrorMessage(error: unknown, resetMode = false): string {
  const code = (error as { code?: string } | null)?.code ?? '';
  if (resetMode && (code === 'auth/user-not-found' || code === 'auth/invalid-email')) {
    return 'If an account matches that address, a password reset email will arrive shortly.';
  }
  switch (code) {
    case 'auth/invalid-email': return 'Please provide a valid email address.';
    case 'auth/user-disabled': return 'This account has been disabled by an administrator.';
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password': return 'Email or password is incorrect.';
    case 'auth/email-already-in-use': return 'An account with this email already exists. Please sign in.';
    case 'auth/weak-password': return 'Use a password with at least 8 characters.';
    case 'auth/popup-closed-by-user': return 'The Google sign-in window closed before authentication finished. Reopen it and complete sign-in.';
    case 'auth/popup-blocked': return 'Your browser blocked the Google sign-in window. Allow popups for this site and try again.';
    case 'auth/unauthorized-domain': return 'This site is not authorized for sign-in. Add its domain in Firebase Authentication settings.';
    case 'auth/operation-not-allowed': return 'This sign-in method is disabled for this Firebase project. Enable it in Authentication sign-in providers.';
    case 'auth/network-request-failed': return 'RentFlow could not reach Firebase. Check your connection and try again.';
    case 'auth/cancelled-popup-request': return 'Another Google sign-in window was opened. Close it and try again.';
    case 'auth/too-many-requests': return 'Too many attempts. Wait a little and try again.';
    default: return error instanceof Error ? error.message : 'Authentication failed. Please try again.';
  }
}

function safeFirebaseErrorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^auth\/[a-z0-9-]+$/i.test(code) ? code : 'unknown';
}

export function getSafeAuthDiagnostic(error: unknown): { code: string; message: string } {
  const code = safeFirebaseErrorCode(error);
  const diagnosticMessages: Record<string, string> = {
    'auth/popup-closed-by-user': 'Google popup closed before sign-in completed.',
    'auth/popup-blocked': 'Browser blocked the Google sign-in popup.',
    'auth/unauthorized-domain': 'Firebase rejected the current sign-in domain.',
    'auth/operation-not-allowed': 'Google sign-in is disabled for this Firebase project.',
    'auth/network-request-failed': 'Firebase authentication could not reach the network.',
    'auth/cancelled-popup-request': 'Another Google popup request canceled this request.',
  };
  return {
    code,
    // Use fixed diagnostic text. SDK messages may contain user or credential data.
    message: diagnosticMessages[code] ?? 'Firebase authentication failed.',
  };
}
