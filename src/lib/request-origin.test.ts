import assert from 'node:assert/strict';
import test from 'node:test';
import { isRequestOriginAllowed } from './request-origin';

test('allows requests without an Origin header and exact same-origin browser requests', () => {
  const allowedOrigins = new Set<string>();
  assert.equal(isRequestOriginAllowed(undefined, 'http://localhost:3000', allowedOrigins), true);
  assert.equal(isRequestOriginAllowed('http://localhost:3000', 'http://localhost:3000', allowedOrigins), true);
});

test('allows only explicitly listed cross-origin browser requests', () => {
  const allowedOrigins = new Set(['https://rent-flow-production.up.railway.app']);
  assert.equal(isRequestOriginAllowed(
    'https://rent-flow-production.up.railway.app',
    'https://api.example.test',
    allowedOrigins,
  ), true);
  assert.equal(isRequestOriginAllowed(
    'https://unlisted.example.test',
    'https://api.example.test',
    allowedOrigins,
  ), false);
});

test('rejects malformed, opaque, path-bearing, and scheme-mismatched origins', () => {
  const allowedOrigins = new Set(['http://localhost:3000']);
  assert.equal(isRequestOriginAllowed('null', 'http://localhost:3000', allowedOrigins), false);
  assert.equal(isRequestOriginAllowed('not-an-origin', 'http://localhost:3000', allowedOrigins), false);
  assert.equal(isRequestOriginAllowed('http://localhost:3000/path', 'http://localhost:3000', allowedOrigins), false);
  assert.equal(isRequestOriginAllowed('https://localhost:3000', 'http://localhost:3000', allowedOrigins), false);
});
