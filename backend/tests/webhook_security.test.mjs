import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAllowedHosts, resolveWebhookTarget } from '../supabase/functions/process-outbox/webhook-policy.mjs';

test('webhook policy accepts a TLS endpoint on one exact allowed hostname', () => {
  const hosts = parseAllowedHosts('hooks.example.org');
  const target = resolveWebhookTarget('https://hooks.example.org/v1/events', hosts);
  assert.equal(target.href, 'https://hooks.example.org/v1/events');
});

test('webhook policy requires a non-empty allowlist of exact DNS hostnames', () => {
  for (const value of ['', ' , ', '*.example.org', 'localhost', '127.0.0.1', 'hooks.example.org, hooks.example.org']) {
    assert.throws(() => parseAllowedHosts(value), /allowlist|hostname/i, value || '(empty)');
  }
});

test('webhook policy rejects cleartext, unapproved, credentialed, and non-standard-port URLs', () => {
  const hosts = parseAllowedHosts('hooks.example.org');
  for (const endpoint of [
    'http://hooks.example.org/v1/events',
    'https://other.example.org/v1/events',
    'https://user:pass@hooks.example.org/v1/events',
    'https://hooks.example.org:8443/v1/events',
    'https://hooks.example.org/v1/events#fragment',
    'https://127.0.0.1/v1/events',
    'https://metadata.google.internal/v1/events',
  ]) {
    assert.throws(() => resolveWebhookTarget(endpoint, hosts), /HTTPS|allowlist|URL|hostname/i, endpoint);
  }
});
