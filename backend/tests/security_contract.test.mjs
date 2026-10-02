import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);

test('public API grants are least-privilege now and for future objects', async () => {
  const migrationDirectory = new URL('supabase/migrations/', root);
  const migrationFiles = (await readdir(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort();
  const sql = (await Promise.all(migrationFiles.map((name) => readFile(new URL(name, migrationDirectory), 'utf8')))).join('\n');
  assert.match(sql, /revoke all privileges on all tables in schema public from anon, authenticated/i);
  assert.match(sql, /alter default privileges for role postgres in schema public\s+revoke all on tables from anon, authenticated/i);
  assert.match(sql, /alter default privileges for role postgres\s+revoke execute on functions from public/i);
  assert.match(sql, /alter default privileges for role postgres in schema public\s+revoke execute on functions from anon, authenticated/i);
  assert.match(sql, /alter default privileges for role postgres in schema public\s+revoke (?:usage, select|all) on sequences from anon, authenticated/i);
  assert.match(sql, /grant select, insert, update on public\.patients to authenticated/i);
  assert.doesNotMatch(sql, /grant (?:all|delete)[^;]*\bto anon\b/i);
});

test('RLS policies evaluate request identity helpers once per statement', async () => {
  const migrationDirectory = new URL('supabase/migrations/', root);
  const migrationFiles = (await readdir(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort();
  const sql = (await Promise.all(migrationFiles.map((name) => readFile(new URL(name, migrationDirectory), 'utf8')))).join('\n');
  for (const policy of [
    'memberships_read', 'profiles_self_or_staff_read', 'profiles_self_update',
    'patients_read_authorized', 'follow_ups_patient_insert', 'messages_insert_authorized',
    'activity_insert_authorized', 'notifications_recipient_read', 'notifications_recipient_update',
  ]) {
    assert.match(sql, new RegExp(`alter policy ${policy} on public\\.[a-z_]+[\\s\\S]*?\\(select auth\\.uid\\(\\)\\)`, 'i'), `${policy} should cache auth.uid() per statement`);
  }
  assert.match(sql, /alter policy follow_ups_patient_insert[\s\S]*?\(select public\.current_patient_id\(\)\)/i);
  assert.match(sql, /alter policy messages_insert_authorized[\s\S]*?\(select public\.current_patient_id\(\)\)/i);
  assert.match(sql, /alter policy activity_insert_authorized[\s\S]*?\(select public\.current_patient_id\(\)\)/i);
});

test('the outbox worker does not contain an embedded credential', async () => {
  const source = await readFile(new URL('supabase/functions/process-outbox/index.ts', root), 'utf8');
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /OUTBOX_WORKER_TOKEN/);
  assert.doesNotMatch(source, /(?:sb_secret_|service_role\s*[:=]\s*['\"][^'\"]+)/i);
});

test('the migration guards privileged profile and appointment updates', async () => {
  const sql = await readFile(new URL('supabase/migrations/0001_careloop_backend.sql', root), 'utf8');
  assert.match(sql, /protect_profile_privilege_fields/);
  assert.match(sql, /function public\.protect_profile_privilege_fields\(\)[\s\S]*?security invoker/i);
  assert.match(sql, /function public\.protect_profile_privilege_fields\(\)[\s\S]*?new\.primary_care_team_id[\s\S]*?t\.organisation_id = new\.organisation_id/i);
  assert.match(sql, /function public\.protect_patient_identity_fields\(\)[\s\S]*?security invoker/i);
  assert.match(sql, /create trigger patients_identity_guard before insert or update on public\.patients/i);
  assert.match(sql, /protect_patient_appointment_update/);
  assert.match(sql, /Patients may only confirm or request rescheduling through the appointment response path/);
  assert.match(sql, /new\.notes is distinct from old\.notes/);
  assert.match(sql, /create trigger appointments_patient_response_guard before update on public\.appointments[\s\S]*?protect_patient_appointment_update/);
  assert.match(sql, /create trigger appointments_patient_response_audit after update on public\.appointments[\s\S]*?record_patient_appointment_response/);
  assert.match(sql, /function public\.record_patient_appointment_response\(\)[\s\S]*?security definer/i);
  assert.match(sql, /grant execute on function public\.claim_outbox_events\(integer\) to service_role/i);
});

test('report storage is private and patient scoped', async () => {
  const sql = await readFile(new URL('supabase/migrations/0001_careloop_backend.sql', root), 'utf8');
  assert.match(sql, /values \('careloop-reports', 'careloop-reports', false\)/i);
  assert.match(sql, /create policy careloop_reports_read on storage\.objects/i);
  assert.match(sql, /public\.can_access_patient\(split_part\(name, '\/', 1\)::uuid\)/i);
});

test('privileged internal functions are not executable by API caller roles', async () => {
  const directory = new URL('supabase/migrations/', root);
  const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  const sql = (await Promise.all(files.map((name) => readFile(new URL(name, directory), 'utf8')))).join('\n');
  assert.match(sql, /revoke execute on all functions in schema public from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.current_profile_role\(\) to authenticated/i);
  assert.match(sql, /revoke execute on function public\.can_access_patient\(uuid\) from anon/i);
});

test('local Supabase Auth enables phone OTP signup and SMS test fixtures', async () => {
  const config = await readFile(new URL('supabase/config.toml', root), 'utf8');
  assert.match(config, /enable_signup = true/);
  assert.match(config, /\[auth\.sms\][\s\S]*?enable_signup = true/i);
  assert.match(config, /\[auth\.sms\.test_otp\]/i);
  assert.match(config, /"\+910000000001"\s*=\s*"123456"[\s\S]*?"\+910000000002"\s*=\s*"123456"/);
  assert.match(config, /\[auth\.sms\.twilio\][\s\S]*?enabled = true/i);
});

test('outbox webhook is checked against an exact TLS hostname allowlist before claiming work', async () => {
  const source = await readFile(new URL('supabase/functions/process-outbox/index.ts', root), 'utf8');
  assert.match(source, /NOTIFICATION_WEBHOOK_ALLOWED_HOSTS/);
  assert.match(source, /parseAllowedHosts\(notificationWebhookAllowedHosts\)[\s\S]*?resolveWebhookTarget\(notificationWebhookUrl, allowedHosts\)[\s\S]*?claim_outbox_events/);
  assert.match(source, /redirect: 'error'/);
  assert.match(source, /AbortSignal\.timeout\(15_000\)/);
});

test('direct Patient app invitation inserts receive server-generated high-entropy codes', async () => {
  const sql = await readFile(new URL('supabase/migrations/0001_careloop_backend.sql', root), 'utf8');
  assert.match(sql, /function public\.sync_connection_code_hash\(\)[\s\S]*?tg_op = 'INSERT' and current_user = 'authenticated'[\s\S]*?gen_random_bytes\(8\)[\s\S]*?new\.code_hash := encode\(extensions\.digest\(new\.code, 'sha256'\)/i);
  assert.match(sql, /create or replace function public\.create_connection_invitation\([\s\S]*?gen_random_bytes\(8\)/i);
});

test('active patient connections prevent invitations and failed redemption stays atomic', async () => {
  const sql = await readFile(new URL('supabase/migrations/0001_careloop_backend.sql', root), 'utf8');
  assert.match(sql, /function public\.populate_invitation_context\(\)[\s\S]*?from public\.patients where id = new\.patient_id for update[\s\S]*?patient_care_team_connections c[\s\S]*?c\.patient_id = new\.patient_id and c\.status = 'active'[\s\S]*?withdraw it before creating another invitation/i);
  assert.match(sql, /function public\.create_connection_invitation\([\s\S]*?from public\.patients where id = target_patient_id for update[\s\S]*?c\.patient_id = target_patient_id and c\.status = 'active'[\s\S]*?withdraw it before creating another invitation/i);
  assert.match(sql, /function public\.redeem_connection_code\([\s\S]*?get diagnostics connection_rows = row_count[\s\S]*?if connection_rows = 0 then[\s\S]*?withdraw it before redeeming another invitation/i);
  assert.match(sql, /function public\.redeem_connection_code\([\s\S]*?invitation\.status = 'redeemed'[\s\S]*?c\.status = 'active'[\s\S]*?cc\.withdrawn_at is null[\s\S]*?connection is no longer active/i);
  assert.match(sql, /function public\.withdraw_connection\([\s\S]*?from public\.patients where id = target_patient for update[\s\S]*?from public\.patient_care_team_connections[\s\S]*?status = 'active'[\s\S]*?for update/i);
});

test('outbox worker can reclaim processing events abandoned past the lease', async () => {
  const sql = await readFile(new URL('supabase/migrations/0001_careloop_backend.sql', root), 'utf8');
  const worker = await readFile(new URL('supabase/functions/process-outbox/index.ts', root), 'utf8');
  assert.match(sql, /create index if not exists outbox_processing_lease_idx on public\.outbox_events\(claimed_at\) where status = 'processing'/i);
  assert.match(sql, /function public\.claim_outbox_events\([\s\S]*?status = 'processing'[\s\S]*?claimed_at is null or claimed_at <= timezone\('utc', now\(\)\) - interval '10 minutes'/i);
  assert.match(sql, /function public\.claim_outbox_events\([\s\S]*?expired_max_attempts[\s\S]*?attempts >= 5[\s\S]*?status = 'dead_letter'[\s\S]*?attempts < 5/i);
  assert.match(sql, /function public\.complete_outbox_event\(event_id uuid, expected_attempt integer\)[\s\S]*?attempts = expected_attempt/i);
  assert.match(sql, /function public\.fail_outbox_event\(event_id uuid, expected_attempt integer,[\s\S]*?attempts = expected_attempt/i);
  assert.match(worker, /complete_outbox_event'[\s\S]*?expected_attempt: event\.attempts/);
  assert.match(worker, /fail_outbox_event'[\s\S]*?expected_attempt: event\.attempts/);
});

test('RLS policy consolidation removes overlap without broadening write predicates', async () => {
  const migrationDirectory = new URL('supabase/migrations/', root);
  const migrationFiles = (await readdir(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort();
  const sql = (await Promise.all(migrationFiles.map((name) => readFile(new URL(name, migrationDirectory), 'utf8')))).join('\n').replace(/\s+/g, ' ');

  assert.match(sql, /drop policy if exists appointments_staff_update on public\.appointments/i);
  assert.match(sql, /create policy appointments_update_authorized on public\.appointments\s+for update\s+using \([\s\S]*?public\.is_staff_user\(\)[\s\S]*?public\.current_patient_id\(\)[\s\S]*?with check \([\s\S]*?public\.is_staff_user\(\)[\s\S]*?public\.current_patient_id\(\)/i);
  assert.match(sql, /create policy profiles_update_authorized on public\.profiles\s+for update\s+using \([\s\S]*?id = \(select auth\.uid\(\)\)[\s\S]*?current_profile_role\(\)[\s\S]*?with check \([\s\S]*?id = \(select auth\.uid\(\)\)[\s\S]*?current_profile_role\(\)/i);
  assert.match(sql, /create policy follow_ups_insert_authorized on public\.follow_up_events\s+for insert\s+with check \([\s\S]*?is_staff_user\(\)[\s\S]*?current_patient_id\(\)[\s\S]*?recorded_by = \(select auth\.uid\(\)\)/i);

  for (const table of ['care_teams', 'care_team_memberships']) {
    assert.match(sql, new RegExp(`drop policy if exists ${table === 'care_teams' ? 'care_teams_admin_write' : 'memberships_admin_write'} on public\\.${table}`, 'i'));
    for (const command of ['insert', 'update', 'delete']) {
      assert.match(sql, new RegExp(`create policy ${table}_admin_${command} on public\\.${table} for ${command}`, 'i'));
    }
  }
  assert.match(sql, /drop policy if exists reminders_staff_write on public\.reminders/i);
  assert.match(sql, /create policy reminders_staff_insert on public\.reminders\s+for insert\s+with check \(public\.is_staff_user\(\) and public\.can_access_patient\(patient_id\)\)/i);
  assert.match(sql, /create policy reminders_staff_update on public\.reminders\s+for update\s+using \(public\.is_staff_user\(\) and public\.can_access_patient\(patient_id\)\)\s+with check \(public\.is_staff_user\(\) and public\.can_access_patient\(patient_id\)\)/i);
});

test('foreign-key index migration and integration catalog assertion stay in sync', async () => {
  const migrationDirectory = new URL('supabase/migrations/', root);
  const migrationFiles = (await readdir(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort();
  const sql = (await Promise.all(migrationFiles.map((name) => readFile(new URL(name, migrationDirectory), 'utf8')))).join('\n');
  const integration = await readFile(new URL('tests/integration.sql', root), 'utf8');
  assert.match(sql, /create index if not exists careloop_fk_[a-z0-9_]+ on public\.[a-z_]+ \([a-z_, ]+\)/i);
  assert.match(integration, /pg_constraint[\s\S]*?pg_index[\s\S]*?pg_am[\s\S]*?access_method\.amname = 'btree'[\s\S]*?public foreign keys without a leading-column B-tree index/i);
});
