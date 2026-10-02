import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);

async function migrationSql() {
  const directory = new URL('supabase/migrations/', root);
  const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  return (await Promise.all(files.map((name) => readFile(new URL(name, directory), 'utf8')))).join('\n');
}

test('backend exposes the QR invitation, redemption, snapshot, and dashboard queue contracts', async () => {
  const sql = await migrationSql();
  assert.match(sql, /create or replace function public\.create_connection_qr_invitation\(/i);
  assert.match(sql, /carelooppatient:\/\/connect\?v=1&code=%s/i);
  assert.match(sql, /create or replace function public\.redeem_connection_qr_payload\(qr_payload text\)/i);
  assert.match(sql, /CL-\[0-9A-F\]\{16\}/i);
  assert.match(sql, /create or replace function public\.get_patient_connectivity_snapshot\(\)/i);
  assert.match(sql, /create or replace function public\.list_follow_up_queue\(/i);
  assert.match(sql, /grant execute on function public\.create_connection_qr_invitation\(uuid, uuid, integer\) to authenticated/i);
  assert.match(sql, /grant execute on function public\.redeem_connection_qr_payload\(text\) to authenticated/i);
});

test('backend adds service-managed external ingestion without storing connector credentials', async () => {
  const sql = await migrationSql();
  for (const table of ['external_data_sources', 'external_import_batches', 'external_import_records']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`, 'i'));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
  assert.match(sql, /Credentials remain in Edge Function\/project secrets, never in this table/i);
  assert.match(sql, /revoke all on public\.external_data_sources, public\.external_import_batches, public\.external_import_records from public, anon, authenticated/i);
  assert.match(sql, /grant all on public\.external_data_sources, public\.external_import_batches, public\.external_import_records, public\.notification_endpoints, public\.notification_deliveries to service_role/i);
});

test('backend adds provider-neutral notification endpoint and delivery contracts', async () => {
  const sql = await migrationSql();
  assert.match(sql, /create table if not exists public\.notification_endpoints\b/i);
  assert.match(sql, /create table if not exists public\.notification_deliveries\b/i);
  assert.match(sql, /create or replace function public\.register_notification_endpoint\(/i);
  assert.match(sql, /create or replace function public\.revoke_notification_endpoint\(/i);
  assert.match(sql, /notification_deliveries_recipient_read/i);
  assert.match(sql, /notification_endpoints_self_update/i);
  assert.match(sql, /provider-neutral delivery ledger/i);
});
