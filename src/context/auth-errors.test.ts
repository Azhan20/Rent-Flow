import assert from 'node:assert/strict';
import test from 'node:test';
import { getAuthErrorMessage, getSafeAuthDiagnostic } from './auth-errors';

test('provides separate guidance for Google popup and configuration failures', () => {
  const cases = [
    ['auth/popup-closed-by-user', 'closed before authentication finished'],
    ['auth/popup-blocked', 'Allow popups'],
    ['auth/unauthorized-domain', 'not authorized'],
    ['auth/operation-not-allowed', 'sign-in method is disabled'],
    ['auth/network-request-failed', 'could not reach Firebase'],
    ['auth/cancelled-popup-request', 'Another Google sign-in window'],
  ] as const;

  for (const [code, expectedText] of cases) {
    assert.match(getAuthErrorMessage({ code }), new RegExp(expectedText));
  }
});

test('explains expired or already-used verification links without bypassing verification', () => {
  for (const code of ['auth/expired-action-code', 'auth/invalid-action-code']) {
    assert.match(getAuthErrorMessage({ code }), /expired or was already used/i);
  }
});

test('keeps the Firebase code but never logs the raw SDK message', () => {
  const diagnostic = getSafeAuthDiagnostic({
    code: 'auth/unauthorized-domain',
    message: 'Failed for renter@example.invalid Bearer token-value apiKey=key-value https://example.invalid/path',
  });

  assert.equal(diagnostic.code, 'auth/unauthorized-domain');
  assert.equal(diagnostic.message, 'Firebase rejected the current sign-in domain.');
  assert.equal(diagnostic.message.includes('renter@example.invalid'), false);
  assert.equal(diagnostic.message.includes('token-value'), false);
  assert.equal(diagnostic.message.includes('key-value'), false);
});

test('preserves safe diagnostics for popup and network failures', () => {
  const cases = [
    ['auth/popup-blocked', 'Browser blocked the Google sign-in popup.'],
    ['auth/popup-closed-by-user', 'Google popup closed before sign-in completed.'],
    ['auth/network-request-failed', 'Firebase authentication could not reach the network.'],
  ] as const;

  for (const [code, message] of cases) {
    assert.deepEqual(
      getSafeAuthDiagnostic({ code, message: 'Sensitive SDK details must not be logged.' }),
      { code, message },
    );
  }
});

test('does not pass through arbitrary error codes into diagnostics', () => {
  assert.equal(getSafeAuthDiagnostic({ code: 'credential=private-data', message: 'failed' }).code, 'unknown');
});
