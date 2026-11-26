import assert from 'node:assert/strict';
import test from 'node:test';
import { safeRuntimeErrorType } from './safe-runtime-error';

test('reports a bounded runtime error type without forwarding error details', () => {
  assert.equal(safeRuntimeErrorType(new TypeError('private token detail')), 'TypeError');
  assert.equal(safeRuntimeErrorType({ name: 'ReferenceError', message: 'secret=value' }), 'ReferenceError');
  assert.equal(safeRuntimeErrorType({ name: 'Bearer private-token', message: 'private-token' }), 'Error');
  assert.equal(safeRuntimeErrorType(null), 'Error');
});
