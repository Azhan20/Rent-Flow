import test from 'node:test';
import assert from 'node:assert/strict';
import {
  consumeEmailVerificationReturn,
  createEmailVerificationContinueUrl,
} from './auth-navigation';

test('verification continuation preserves the current destination and plan while dropping the signup prompt', () => {
  const continuation = new URL(createEmailVerificationContinueUrl(
    'https://rent-flow.example/workspace?auth=signup&plan=growth-fleet&cycle=yearly#bookings',
  ));

  assert.equal(continuation.origin, 'https://rent-flow.example');
  assert.equal(continuation.pathname, '/workspace');
  assert.equal(continuation.searchParams.get('auth'), null);
  assert.equal(continuation.searchParams.get('plan'), 'growth-fleet');
  assert.equal(continuation.searchParams.get('cycle'), 'yearly');
  assert.equal(continuation.searchParams.get('rentflow_email_verification_return'), '1');
  assert.equal(continuation.hash, '#bookings');
});

test('verification return marker is consumed once without losing the destination', () => {
  const returned = consumeEmailVerificationReturn(
    'https://rent-flow.example/?plan=starter-depot&rentflow_email_verification_return=1#workspace',
  );
  assert.equal(returned.returnedFromVerification, true);
  assert.equal(returned.relativeUrl, '/?plan=starter-depot#workspace');

  const ordinary = consumeEmailVerificationReturn('https://rent-flow.example/?plan=starter-depot');
  assert.equal(ordinary.returnedFromVerification, false);
  assert.equal(ordinary.relativeUrl, '/?plan=starter-depot');
});
