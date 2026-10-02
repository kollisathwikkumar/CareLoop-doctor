import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const migrationPath = new URL('../supabase/migrations/0001_careloop_backend.sql', import.meta.url);

async function migration() {
  return readFile(migrationPath, 'utf8');
}

test('backend migration exists and defines the shared application tables', async () => {
  const sql = await migration();
  for (const table of [
    'organisations',
    'care_teams',
    'care_team_memberships',
    'profiles',
    'patients',
    'appointments',
    'appointment_responses',
    'care_journey_events',
    'reminders',
    'care_team_messages',
    'tests',
    'reports',
    'medications',
    'care_plans',
    'follow_up_events',
    'follow_up_tasks',
    'follow_up_task_events',
    'connection_invitations',
    'connection_consents',
    'patient_care_team_connections',
    'activity_log',
    'audit_events',
    'outbox_events',
    'notifications',
  ]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`, 'i'), table);
  }
});

test('backend migration defines the patient-app compatibility columns', async () => {
  const sql = await migration();
  for (const field of [
    'patients.auth_user_id',
    'patients.first_name',
    'patients.last_name',
    'appointments.scheduled_at',
    'appointments.status',
    'appointments.purpose',
    'follow_up_events.next_steps',
    'activity_log.entity_type',
  ]) {
    const [table, column] = field.split('.');
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}[\\s\\S]*?\\b${column}\\b`, 'i'), field);
  }
});

test('backend migration protects every exposed domain table with RLS and policies', async () => {
  const sql = await migration();
  const tables = [
    'organisations', 'care_teams', 'care_team_memberships', 'profiles', 'patients',
    'appointments', 'appointment_responses', 'care_journey_events', 'reminders', 'care_team_messages', 'tests', 'reports', 'medications', 'care_plans', 'follow_up_events', 'follow_up_tasks', 'follow_up_task_events',
    'connection_invitations', 'connection_consents', 'patient_care_team_connections',
    'activity_log', 'audit_events', 'outbox_events', 'notifications',
  ];
  for (const table of tables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'), `${table} RLS`);
    assert.match(sql, new RegExp(`create policy [^;]+ on public\\.${table}\\b`, 'is'), `${table} policy`);
  }
});

test('backend migration exposes atomic connection and staff invitation operations', async () => {
  const sql = await migration();
  for (const fn of ['redeem_connection_code', 'create_connection_invitation', 'create_staff_invitation', 'accept_staff_invitation']) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}\\b`, 'i'), fn);
    assert.match(sql, new RegExp(`security definer`, 'i'), `${fn} security definer`);
  }
});

test('backend migration exposes an auditable, concurrency-checked follow-up task workflow', async () => {
  const sql = await migration();
  for (const fn of ['profile_can_access_patient', 'create_follow_up_task', 'update_follow_up_task']) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}\\b`, 'i'), fn);
  }
  assert.match(sql, /follow_up_tasks[\s\S]*?reason[\s\S]*?due_at[\s\S]*?priority_source[\s\S]*?owner_id[\s\S]*?status[\s\S]*?next_action[\s\S]*?closure_note/i);
  assert.match(sql, /follow_up_task_events[\s\S]*?from_status[\s\S]*?to_status[\s\S]*?metadata/i);
  assert.match(sql, /function public\.update_follow_up_task\([\s\S]*?expected_updated_at[\s\S]*?expected_updated_at is distinct from task\.updated_at/i);
  assert.match(sql, /request_key is null[\s\S]*?on conflict \(created_by, idempotency_key\)/i);
  assert.match(sql, /profile_can_access_patient\(owner_profile_id, target_patient_id\)/i);
  assert.match(sql, /profile_can_access_patient\(resolved_owner, task\.patient_id\)/i);
  assert.match(sql, /closure note is required to close a follow-up task/i);
  assert.match(sql, /closed follow-up tasks are immutable/i);
  assert.match(sql, /create or replace function public\.create_appointment_follow_up_task\([\s\S]*?new\.status not in \('missed', 'overdue'\)[\s\S]*?appointment-status:/i);
  assert.match(sql, /create trigger appointments_follow_up_task after update of status on public\.appointments/i);
  assert.match(sql, /grant select on public\.follow_up_tasks, public\.follow_up_task_events to authenticated/i);
  assert.match(sql, /grant execute on function public\.create_follow_up_task/i);
  assert.match(sql, /grant execute on function public\.update_follow_up_task/i);
});

test('backend migration includes audit and transactional outbox writes', async () => {
  const sql = await migration();
  assert.match(sql, /create or replace function public\.write_audit_event\b/i);
  assert.match(sql, /create or replace function public\.enqueue_outbox_event\b/i);
  assert.match(sql, /function public\.enqueue_outbox_event\([\s\S]*?event_aggregate_id uuid,[\s\S]*?event_patient_id uuid,[\s\S]*?select organisation_id into target_org from public\.patients where id = event_patient_id/i);
  assert.match(sql, /insert into public\.audit_events/i);
  assert.match(sql, /insert into public\.outbox_events/i);
  assert.match(sql, /'appointment\.response\.recorded',[\s\S]*?appointment\.id,[\s\S]*?appointment\.patient_id,[\s\S]*?jsonb_build_object\('patient_id', appointment\.patient_id/i);
});

test('care-team message authorship and content are immutable after sending', async () => {
  const sql = await migration();
  assert.match(sql, /function public\.protect_care_team_message_update\(\)[\s\S]*?new\.sender_id is distinct from old\.sender_id[\s\S]*?new\.body is distinct from old\.body/i);
  assert.match(sql, /create trigger care_team_messages_update_guard before update on public\.care_team_messages/i);
});

test('organisation-scoped policies and group context enforce tenant boundaries', async () => {
  const sql = await migration();
  assert.match(sql, /create or replace function public\.populate_patient_group_context\b/i);
  assert.match(sql, /create trigger patient_groups_context before insert or update of organisation_id, assigned_doctor_id, assigned_staff_id/i);
  assert.match(sql, /p\.role = 'doctor' and p\.active/i);
  assert.match(sql, /p\.role in \('staff', 'care_coordinator'\) and p\.active/i);
  assert.match(sql, /viewer_role = 'doctor' and p\.assigned_doctor_id = auth\.uid\(\)/i);
  assert.match(sql, /viewer_role in \('staff', 'care_coordinator'\) and p\.assigned_staff_id = auth\.uid\(\)/i);
  assert.match(sql, /m\.active and m\.role = viewer_role/i);
  assert.match(sql, /create policy patients_read_authorized[\s\S]*?current_profile_role\(\) = 'doctor' and assigned_doctor_id = auth\.uid\(\)[\s\S]*?current_profile_role\(\) in \('staff', 'care_coordinator'\) and assigned_staff_id = auth\.uid\(\)/i);
  assert.match(sql, /function public\.protect_patient_group_member_scope\(\)[\s\S]*?group_org is distinct from patient_org[\s\S]*?can_access_patient\(new\.patient_id\)/i);
  assert.match(sql, /create trigger patient_group_members_scope before insert or update on public\.patient_group_members/i);
  assert.match(sql, /function public\.protect_care_team_membership_scope\(\)[\s\S]*?team_org is distinct from profile_org[\s\S]*?profile_role is distinct from new\.role[\s\S]*?profile_active is distinct from true/i);
  assert.match(sql, /create trigger care_team_membership_scope before insert or update on public\.care_team_memberships/i);
  for (const policy of ['care_teams_admin_write', 'memberships_admin_write', 'profiles_admin_update']) {
    const expression = new RegExp(`create policy ${policy}[\\s\\S]*?with check \\([\\s\\S]*?current_organisation_id\\(\\)`, 'i');
    assert.match(sql, expression, `${policy} must constrain writes to the current organisation`);
  }
  assert.match(sql, /create policy groups_staff_update[\s\S]*?with check \(public\.is_staff_user\(\) and \(organisation_id = public\.current_organisation_id\(\)/i);
  assert.match(sql, /patient organisation\./i);
});
