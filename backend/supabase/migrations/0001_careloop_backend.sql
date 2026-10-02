-- CareLoop backend baseline
-- Supabase/PostgreSQL migration. Apply in a dedicated environment first.
-- The patient app currently consumes the compatibility tables in this migration.

create extension if not exists pgcrypto;

create type public.profile_role as enum (
  'pending',
  'doctor',
  'staff',
  'care_coordinator',
  'org_admin',
  'platform_admin'
);

create type public.appointment_status as enum ('upcoming', 'completed', 'missed', 'cancelled', 'overdue');
create type public.test_status as enum ('pending', 'completed', 'overdue');
create type public.medication_status as enum ('current', 'past');
create type public.care_plan_status as enum ('active', 'completed', 'paused');
create type public.follow_up_task_status as enum ('open', 'in_progress', 'completed', 'cancelled');
create type public.follow_up_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.connection_status as enum ('active', 'withdrawn', 'revoked');
create type public.invitation_status as enum ('pending', 'redeemed', 'revoked', 'expired');
create type public.outbox_status as enum ('pending', 'processing', 'delivered', 'dead_letter');

create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.care_teams (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 160),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, name)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.profile_role not null default 'pending',
  organisation_id uuid references public.organisations(id) on delete restrict,
  primary_care_team_id uuid references public.care_teams(id) on delete set null,
  full_name text not null default '' check (length(btrim(full_name)) <= 160),
  email text not null default '',
  phone text,
  age integer check (age is null or age between 13 and 120),
  specialty text,
  department text,
  workplace text,
  experience_years integer check (experience_years is null or experience_years between 0 and 100),
  location text,
  staff_code text unique,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.care_team_memberships (
  care_team_id uuid not null references public.care_teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.profile_role not null check (role in ('doctor', 'staff', 'care_coordinator', 'org_admin')),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (care_team_id, profile_id)
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  patient_code text not null unique default ('CL-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8))),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  first_name text not null check (length(btrim(first_name)) between 1 and 80),
  last_name text not null check (length(btrim(last_name)) between 1 and 80),
  date_of_birth date,
  phone text,
  email text,
  condition text check (condition is null or length(condition) <= 240),
  notes text check (notes is null or length(notes) <= 4000),
  assigned_doctor_id uuid references public.profiles(id) on delete set null,
  assigned_staff_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.patient_care_team_connections (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  care_team_id uuid not null references public.care_teams(id) on delete restrict,
  status public.connection_status not null default 'active',
  connected_at timestamptz not null default timezone('utc', now()),
  withdrawn_at timestamptz,
  created_by uuid references auth.users(id) on delete set null
);

create unique index if not exists one_active_connection_per_patient
  on public.patient_care_team_connections(patient_id)
  where status = 'active';

create table if not exists public.connection_consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  care_team_id uuid not null references public.care_teams(id) on delete restrict,
  consent_version text not null check (length(btrim(consent_version)) between 1 and 40),
  scope jsonb not null default '{"coordination": true}'::jsonb,
  consented_by uuid not null references auth.users(id) on delete restrict,
  consented_at timestamptz not null default timezone('utc', now()),
  withdrawn_at timestamptz,
  check (jsonb_typeof(scope) = 'object')
);

create table if not exists public.connection_invitations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  care_team_id uuid not null references public.care_teams(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  -- `code` is retained for the existing client contract during cutover.
  -- `code_hash` is authoritative for server-generated invitations.
  code text not null unique check (length(btrim(code)) between 6 and 120),
  code_hash text,
  code_hint text,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null default (timezone('utc', now()) + interval '24 hours'),
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  check (expires_at > created_at)
);

create unique index if not exists one_pending_connection_invitation_per_patient
  on public.connection_invitations(patient_id)
  where status = 'pending';

create table if not exists public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  care_team_id uuid not null references public.care_teams(id) on delete cascade,
  target_email text not null check (length(btrim(target_email)) between 3 and 320),
  target_role public.profile_role not null check (target_role in ('doctor', 'staff', 'care_coordinator', 'org_admin')),
  token_hash text not null unique,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid references public.profiles(id) on delete set null,
  scheduled_at timestamptz not null,
  purpose text not null check (length(btrim(purpose)) between 1 and 240),
  status public.appointment_status not null default 'upcoming',
  notes text check (notes is null or length(notes) <= 4000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, patient_id)
);

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 240),
  test_date date not null,
  status public.test_status not null default 'pending',
  notes text check (notes is null or length(notes) <= 4000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, patient_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  test_id uuid not null references public.tests(id) on delete cascade,
  file_path text not null unique check (length(btrim(file_path)) between 1 and 1024),
  file_name text not null check (length(btrim(file_name)) between 1 and 255),
  mime_type text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  check (file_path not like '%..%'),
  constraint reports_test_patient_fk foreign key (test_id, patient_id) references public.tests(id, patient_id) on delete cascade
);

create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 240),
  dosage text not null check (length(btrim(dosage)) between 1 and 240),
  instructions text not null check (length(btrim(instructions)) between 1 and 1000),
  start_date date not null,
  end_date date,
  status public.medication_status not null default 'current',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (end_date is null or end_date >= start_date)
);

create table if not exists public.care_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 240),
  goal text not null check (length(btrim(goal)) between 1 and 1000),
  actions text not null check (length(btrim(actions)) between 1 and 4000),
  responsible_profile_id uuid references public.profiles(id) on delete set null,
  review_date date not null,
  status public.care_plan_status not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.follow_up_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  attempted_at timestamptz not null default timezone('utc', now()),
  outcome text not null check (length(btrim(outcome)) between 1 and 1000),
  next_steps text check (next_steps is null or length(next_steps) <= 2000),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid,
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  due_at timestamptz not null,
  priority public.follow_up_priority not null default 'normal',
  priority_source text not null check (length(btrim(priority_source)) between 1 and 120),
  owner_id uuid references public.profiles(id) on delete set null,
  status public.follow_up_task_status not null default 'open',
  next_action text not null check (length(btrim(next_action)) between 1 and 1000),
  closure_note text check (closure_note is null or length(btrim(closure_note)) between 1 and 2000),
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  idempotency_key text check (idempotency_key is null or length(btrim(idempotency_key)) between 1 and 200),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, patient_id),
  foreign key (appointment_id, patient_id) references public.appointments(id, patient_id) on delete restrict,
  check ((status in ('completed', 'cancelled') and closed_at is not null and closed_by is not null and closure_note is not null)
    or (status in ('open', 'in_progress') and closed_at is null and closed_by is null))
);

create table if not exists public.follow_up_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'updated', 'status_changed')),
  from_status public.follow_up_task_status,
  to_status public.follow_up_task_status not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (task_id, patient_id) references public.follow_up_tasks(id, patient_id) on delete cascade
);

create table if not exists public.appointment_responses (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  response text not null check (response in ('confirmed', 'reschedule_requested')),
  requested_scheduled_at timestamptz,
  responded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  check (response <> 'reschedule_requested' or requested_scheduled_at is not null)
);

create table if not exists public.care_journey_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  event_type text not null check (length(btrim(event_type)) between 1 and 120),
  title text not null check (length(btrim(title)) between 1 and 240),
  summary text check (summary is null or length(summary) <= 2000),
  occurred_at timestamptz not null default timezone('utc', now()),
  patient_visible boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  channel text not null check (channel in ('in_app', 'sms', 'push', 'email')),
  message text not null check (length(btrim(message)) between 1 and 1000),
  send_at timestamptz not null,
  status text not null default 'approved' check (status in ('draft', 'approved', 'queued', 'sent', 'failed', 'cancelled')),
  approved_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.care_team_messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default timezone('utc', now()),
  read_at timestamptz
);

create table if not exists public.patient_groups (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  description text check (description is null or length(description) <= 1000),
  assigned_doctor_id uuid references public.profiles(id) on delete set null,
  assigned_staff_id uuid references public.profiles(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  unique (organisation_id, name)
);

create table if not exists public.patient_group_members (
  group_id uuid not null references public.patient_groups(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (group_id, patient_id)
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (length(btrim(action)) between 1 and 120),
  entity_type text not null check (length(btrim(entity_type)) between 1 and 120),
  entity_id text,
  summary text not null check (length(btrim(summary)) between 1 and 2000),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (length(btrim(action)) between 1 and 160),
  entity_type text not null check (length(btrim(entity_type)) between 1 and 120),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete set null,
  topic text not null check (length(btrim(topic)) between 1 and 160),
  aggregate_type text not null check (length(btrim(aggregate_type)) between 1 and 120),
  aggregate_id uuid,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  idempotency_key text unique,
  status public.outbox_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default timezone('utc', now()),
  claimed_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (length(btrim(notification_type)) between 1 and 120),
  title text not null check (length(btrim(title)) between 1 and 160),
  body text not null check (length(btrim(body)) between 1 and 1000),
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists patients_org_idx on public.patients(organisation_id);
create index if not exists patients_auth_user_idx on public.patients(auth_user_id);
create index if not exists appointments_patient_time_idx on public.appointments(patient_id, scheduled_at);
create index if not exists appointments_status_time_idx on public.appointments(status, scheduled_at);
create index if not exists tests_patient_date_idx on public.tests(patient_id, test_date desc);
create index if not exists reports_patient_created_idx on public.reports(patient_id, created_at desc);
create index if not exists follow_up_patient_time_idx on public.follow_up_events(patient_id, attempted_at desc);
create index if not exists follow_up_tasks_queue_idx on public.follow_up_tasks(status, due_at, created_at);
create index if not exists follow_up_tasks_owner_queue_idx on public.follow_up_tasks(owner_id, status, due_at);
create index if not exists follow_up_tasks_patient_idx on public.follow_up_tasks(patient_id, status, due_at);
create unique index if not exists follow_up_tasks_idempotency_idx on public.follow_up_tasks(created_by, idempotency_key) where idempotency_key is not null;
create index if not exists follow_up_task_events_task_idx on public.follow_up_task_events(task_id, created_at);
create index if not exists appointment_responses_patient_created_idx on public.appointment_responses(patient_id, created_at desc);
create index if not exists care_journey_patient_occurred_idx on public.care_journey_events(patient_id, occurred_at desc);
create index if not exists reminders_due_idx on public.reminders(status, send_at);
create index if not exists care_team_messages_patient_created_idx on public.care_team_messages(patient_id, created_at);
create index if not exists activity_patient_created_idx on public.activity_log(patient_id, created_at desc);
create index if not exists outbox_pending_idx on public.outbox_events(status, available_at);
create index if not exists outbox_processing_lease_idx on public.outbox_events(claimed_at) where status = 'processing';
create index if not exists notifications_recipient_created_idx on public.notifications(recipient_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.sync_connection_code_hash()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and current_user = 'authenticated' then
    new.code := 'CL-' || upper(encode(extensions.gen_random_bytes(8), 'hex'));
    new.code_hash := encode(extensions.digest(new.code, 'sha256'), 'hex');
    new.code_hint := right(new.code, 4);
    return new;
  end if;
  if new.code_hash is null then
    new.code_hash := encode(extensions.digest(upper(btrim(new.code)), 'sha256'), 'hex');
  end if;
  if new.code_hint is null then
    new.code_hint := right(upper(btrim(new.code)), 4);
  end if;
  return new;
end;
$$;

create or replace function public.populate_patient_context()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.organisation_id is null then
    new.organisation_id := public.current_organisation_id();
  end if;
  if new.organisation_id is null then
    raise exception using errcode = '23502', message = 'An organisation is required for a patient record.';
  end if;
  return new;
end;
$$;

create or replace function public.populate_patient_group_context()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  caller_org uuid;
  caller_role public.profile_role;
begin
  if current_user in ('postgres', 'supabase_admin') or auth.role() = 'service_role' then
    return new;
  end if;
  caller_org := public.current_organisation_id();
  caller_role := public.current_profile_role();
  if new.organisation_id is null then
    new.organisation_id := caller_org;
  end if;
  if new.organisation_id is null then
    raise exception using errcode = '23502', message = 'An organisation is required for a patient group.';
  end if;
  if caller_role is distinct from 'platform_admin' and new.organisation_id is distinct from caller_org then
    raise exception using errcode = '42501', message = 'Patient group organisation access is not permitted.';
  end if;
  if new.assigned_doctor_id is not null and not exists (
    select 1 from public.profiles p
    where p.id = new.assigned_doctor_id and p.organisation_id = new.organisation_id
      and p.role = 'doctor' and p.active
  ) then
    raise exception using errcode = '23503', message = 'Assigned doctor must be an active doctor in the patient group organisation.';
  end if;
  if new.assigned_staff_id is not null and not exists (
    select 1 from public.profiles p
    where p.id = new.assigned_staff_id and p.organisation_id = new.organisation_id
      and p.role in ('staff', 'care_coordinator') and p.active
  ) then
    raise exception using errcode = '23503', message = 'Assigned staff must be active staff or care coordinator in the patient group organisation.';
  end if;
  return new;
end;
$$;

create or replace function public.protect_patient_group_member_scope()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  group_org uuid;
  patient_org uuid;
begin
  if current_user in ('postgres', 'supabase_admin') or auth.role() = 'service_role' then
    return new;
  end if;
  select organisation_id into group_org from public.patient_groups where id = new.group_id;
  select organisation_id into patient_org from public.patients where id = new.patient_id;
  if group_org is null or patient_org is null or group_org is distinct from patient_org
    or not public.can_access_patient(new.patient_id) then
    raise exception using errcode = '42501', message = 'Patient group membership requires an accessible patient in the same organisation.';
  end if;
  return new;
end;
$$;

create or replace function public.protect_care_team_membership_scope()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  team_org uuid;
  profile_org uuid;
  profile_role public.profile_role;
  profile_active boolean;
begin
  if current_user in ('postgres', 'supabase_admin') or auth.role() = 'service_role' then
    return new;
  end if;
  select organisation_id into team_org from public.care_teams where id = new.care_team_id;
  select organisation_id, role, active into profile_org, profile_role, profile_active
  from public.profiles where id = new.profile_id;
  if team_org is null or profile_org is null or team_org is distinct from profile_org
    or profile_role is distinct from new.role or profile_active is distinct from true then
    raise exception using errcode = '42501', message = 'Care-team membership requires an active matching-role profile in the same organisation.';
  end if;
  return new;
end;
$$;

create or replace function public.protect_care_team_message_update()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
begin
  if new.id is distinct from old.id
    or new.patient_id is distinct from old.patient_id
    or new.sender_id is distinct from old.sender_id
    or new.body is distinct from old.body
    or new.created_at is distinct from old.created_at then
    raise exception using errcode = '42501', message = 'Care-team message content and authorship are immutable.';
  end if;
  return new;
end;
$$;

create or replace function public.populate_invitation_context()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  patient_org uuid;
begin
  if auth.uid() is not null and new.created_by is distinct from auth.uid() and auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'Invitation creator must match the authenticated user.';
  end if;
  if new.care_team_id is null then
    select primary_care_team_id into new.care_team_id from public.profiles where id = new.created_by;
  end if;
  if new.care_team_id is null then
    raise exception using errcode = '23502', message = 'A care team is required for an invitation.';
  end if;
  select organisation_id into patient_org from public.patients where id = new.patient_id for update;
  if patient_org is null or not exists (
    select 1 from public.care_teams t
    where t.id = new.care_team_id and t.organisation_id = patient_org
  ) then
    raise exception using errcode = '42501', message = 'Invitation care team must belong to the patient organisation.';
  end if;
  if exists (
    select 1 from public.patient_care_team_connections c
    where c.patient_id = new.patient_id and c.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'Patient already has an active care-team connection; withdraw it before creating another invitation.';
  end if;
  if auth.uid() is not null and auth.role() <> 'service_role'
    and public.current_profile_role() not in ('org_admin', 'platform_admin')
    and not exists (
      select 1 from public.care_team_memberships m
      where m.care_team_id = new.care_team_id and m.profile_id = auth.uid() and m.active
    ) then
    raise exception using errcode = '42501', message = 'Invitation requires active care-team membership.';
  end if;
  return new;
end;
$$;

create or replace function public.protect_profile_privilege_fields()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  actor_role public.profile_role;
begin
  if current_user in ('postgres', 'supabase_admin') or auth.role() = 'service_role' then
    return new;
  end if;
  if new.primary_care_team_id is not null and not exists (
    select 1 from public.care_teams t
    where t.id = new.primary_care_team_id and t.organisation_id = new.organisation_id
  ) then
    raise exception using errcode = '42501', message = 'Primary care team must belong to the profile organisation.';
  end if;
  actor_role := public.current_profile_role();
  if actor_role = 'platform_admin' then
    return new;
  end if;
  if actor_role = 'org_admin' then
    if new.organisation_id is distinct from old.organisation_id or new.role = 'platform_admin' then
      raise exception using errcode = '42501', message = 'Organisation administrators cannot change organisation boundaries or grant platform access.';
    end if;
    return new;
  end if;
  if auth.uid() = old.id and new.role = old.role and new.organisation_id is not distinct from old.organisation_id and new.active = old.active then
    return new;
  end if;
  raise exception using errcode = '42501', message = 'Profile privilege fields are protected.';
end;
$$;

create or replace function public.protect_patient_identity_fields()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  actor_role public.profile_role;
  actor_org uuid;
  patient_org uuid;
begin
  if current_user in ('postgres', 'supabase_admin') or auth.role() = 'service_role' then
    return new;
  end if;
  actor_role := public.current_profile_role();
  actor_org := public.current_organisation_id();
  if tg_op = 'INSERT' then
    patient_org := new.organisation_id;
    if new.auth_user_id is not null then
      raise exception using errcode = '42501', message = 'Patient accounts must be linked through invitation redemption.';
    end if;
    if actor_role is distinct from 'platform_admin' and new.organisation_id is distinct from actor_org then
      raise exception using errcode = '42501', message = 'Patient organisation must match the authenticated organisation.';
    end if;
  else
    patient_org := old.organisation_id;
    if new.id is distinct from old.id
      or new.organisation_id is distinct from old.organisation_id
      or new.auth_user_id is distinct from old.auth_user_id then
      raise exception using errcode = '42501', message = 'Patient identity and organisation fields are protected.';
    end if;
  end if;
  if new.assigned_doctor_id is not null and not exists (
    select 1 from public.profiles p
    where p.id = new.assigned_doctor_id
      and p.organisation_id = patient_org
      and p.role = 'doctor'
      and p.active
  ) then
    raise exception using errcode = '23503', message = 'Assigned doctor must be active in the patient organisation.';
  end if;
  if new.assigned_staff_id is not null and not exists (
    select 1 from public.profiles p
    where p.id = new.assigned_staff_id
      and p.organisation_id = patient_org
      and p.role in ('staff', 'care_coordinator')
      and p.active
  ) then
    raise exception using errcode = '23503', message = 'Assigned staff must be active in the patient organisation.';
  end if;
  return new;
end;
$$;

create or replace function public.protect_patient_appointment_update()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
begin
  if public.current_patient_id() = old.patient_id and not public.is_staff_user() then
    if new.id is distinct from old.id
      or new.patient_id is distinct from old.patient_id
      or new.doctor_id is distinct from old.doctor_id
      or new.purpose is distinct from old.purpose
      or new.notes is distinct from old.notes
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
      or new.status <> 'upcoming' then
      raise exception using errcode = '42501', message = 'Patients may only confirm or request rescheduling through the appointment response path.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.record_patient_appointment_response()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  response_kind text;
  requested_time timestamptz;
  response_id uuid;
begin
  if public.current_patient_id() is distinct from new.patient_id or public.is_staff_user() then
    return new;
  end if;
  if new.status is not distinct from old.status and new.scheduled_at is not distinct from old.scheduled_at then
    return new;
  end if;

  if new.scheduled_at is distinct from old.scheduled_at then
    response_kind := 'reschedule_requested';
    requested_time := new.scheduled_at;
  else
    response_kind := 'confirmed';
    requested_time := null;
  end if;

  insert into public.appointment_responses (appointment_id, patient_id, response, requested_scheduled_at, responded_by)
  values (new.id, new.patient_id, response_kind, requested_time, auth.uid())
  returning id into response_id;
  insert into public.care_journey_events (patient_id, event_type, title, summary, patient_visible, created_by, metadata)
  values (
    new.patient_id,
    'appointment_response',
    case when response_kind = 'confirmed' then 'Appointment confirmed' else 'Reschedule requested' end,
    case when response_kind = 'confirmed' then 'The patient confirmed the appointment.' else 'The patient asked the care team to review a different time.' end,
    true,
    auth.uid(),
    jsonb_build_object('appointment_id', new.id, 'response', response_kind, 'requested_scheduled_at', requested_time)
  );
  perform public.write_audit_event(
    new.patient_id,
    'appointment.response.recorded',
    'appointment',
    new.id,
    jsonb_build_object('response', response_kind, 'requested_scheduled_at', requested_time)
  );
  perform public.enqueue_outbox_event(
    'appointment.response.recorded',
    'appointment',
    new.id,
    new.patient_id,
    jsonb_build_object('patient_id', new.patient_id, 'response', response_kind),
    'appointment-response:' || new.id::text || ':' || response_id::text
  );
  return new;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    new.phone
  )
  on conflict (id) do update set
    email = excluded.email,
    phone = excluded.phone,
    updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.current_profile_role()
returns public.profile_role
language sql
stable
security definer
set search_path = public, auth
as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.current_organisation_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select organisation_id from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.current_patient_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id from public.patients where auth_user_id = auth.uid();
$$;

create or replace function public.is_staff_user()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(public.current_profile_role() in ('doctor', 'staff', 'care_coordinator', 'org_admin', 'platform_admin'), false);
$$;

create or replace function public.can_access_patient(target_patient_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  viewer_role public.profile_role;
  viewer_org uuid;
begin
  if target_patient_id is null or auth.uid() is null then
    return false;
  end if;
  if exists (select 1 from public.patients p where p.id = target_patient_id and p.auth_user_id = auth.uid()) then
    return true;
  end if;
  select role, organisation_id into viewer_role, viewer_org
  from public.profiles where id = auth.uid() and active = true;
  if viewer_role is null then
    return false;
  end if;
  if viewer_role = 'platform_admin' then
    return true;
  end if;
  return exists (
    select 1
    from public.patients p
    where p.id = target_patient_id
      and p.organisation_id = viewer_org
      and (
      viewer_role = 'org_admin'
        or (viewer_role = 'doctor' and p.assigned_doctor_id = auth.uid())
        or (viewer_role in ('staff', 'care_coordinator') and p.assigned_staff_id = auth.uid())
        or exists (
          select 1
          from public.patient_care_team_connections c
          join public.care_team_memberships m on m.care_team_id = c.care_team_id
          where c.patient_id = p.id and c.status = 'active' and m.profile_id = auth.uid()
            and m.active and m.role = viewer_role
        )
      )
  );
end;
$$;

create or replace function public.write_audit_event(
  target_patient_id uuid,
  event_action text,
  event_entity_type text,
  event_entity_id uuid,
  event_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  created_id uuid;
  target_org uuid;
begin
  select organisation_id into target_org from public.patients where id = target_patient_id;
  insert into public.audit_events (organisation_id, patient_id, actor_id, action, entity_type, entity_id, metadata)
  values (target_org, target_patient_id, auth.uid(), event_action, event_entity_type, event_entity_id, coalesce(event_metadata, '{}'::jsonb))
  returning id into created_id;
  return created_id;
end;
$$;

create or replace function public.enqueue_outbox_event(
  event_topic text,
  event_aggregate_type text,
  event_aggregate_id uuid,
  event_patient_id uuid,
  event_payload jsonb,
  event_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  created_id uuid;
  target_org uuid;
begin
  if event_patient_id is not null then
    select organisation_id into target_org from public.patients where id = event_patient_id;
    if target_org is null then
      raise exception using errcode = '23503', message = 'Outbox patient attribution must reference an existing patient.';
    end if;
  end if;
  insert into public.outbox_events (organisation_id, topic, aggregate_type, aggregate_id, payload, idempotency_key)
  values (target_org, event_topic, event_aggregate_type, event_aggregate_id, coalesce(event_payload, '{}'::jsonb), event_idempotency_key)
  on conflict (idempotency_key) do update set id = public.outbox_events.id
  returning id into created_id;
  return created_id;
end;
$$;

create or replace function public.profile_can_access_patient(target_profile_id uuid, target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.patients p
    join public.profiles owner_profile on owner_profile.id = target_profile_id
    where p.id = target_patient_id
      and owner_profile.active
      and owner_profile.organisation_id = p.organisation_id
      and owner_profile.role in ('doctor', 'staff', 'care_coordinator')
      and (
        (owner_profile.role = 'doctor' and p.assigned_doctor_id = owner_profile.id)
        or (owner_profile.role in ('staff', 'care_coordinator') and p.assigned_staff_id = owner_profile.id)
        or exists (
          select 1
          from public.patient_care_team_connections c
          join public.care_team_memberships m on m.care_team_id = c.care_team_id
          where c.patient_id = p.id and c.status = 'active'
            and m.profile_id = owner_profile.id and m.active and m.role = owner_profile.role
        )
      )
  );
$$;

create or replace function public.create_follow_up_task(
  target_patient_id uuid,
  task_reason text,
  target_due_at timestamptz,
  request_key text,
  task_priority public.follow_up_priority default 'normal',
  priority_source text default 'staff_created',
  owner_profile_id uuid default null,
  target_appointment_id uuid default null,
  action_next text default 'Contact patient'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  created_task_id uuid;
  existing_task public.follow_up_tasks%rowtype;
begin
  if auth.uid() is null or not public.is_staff_user() or not public.can_access_patient(target_patient_id) then
    raise exception using errcode = '42501', message = 'Follow-up task access is not permitted.';
  end if;
  if request_key is null or length(btrim(request_key)) not between 1 and 200
    or task_reason is null or length(btrim(task_reason)) not between 1 and 1000
    or target_due_at is null
    or task_priority is null
    or priority_source is null or length(btrim(priority_source)) not between 1 and 120
    or action_next is null or length(btrim(action_next)) not between 1 and 1000 then
    raise exception using errcode = '22023', message = 'Follow-up task fields are invalid.';
  end if;
  if owner_profile_id is not null and not public.profile_can_access_patient(owner_profile_id, target_patient_id) then
    raise exception using errcode = '42501', message = 'Task owner must be an active team member authorized for this patient.';
  end if;

  insert into public.follow_up_tasks (
    patient_id, appointment_id, reason, due_at, priority, priority_source,
    owner_id, next_action, created_by, idempotency_key
  ) values (
    target_patient_id, target_appointment_id, btrim(task_reason), target_due_at,
    task_priority, btrim(priority_source), owner_profile_id, btrim(action_next), auth.uid(), btrim(request_key)
  )
  on conflict (created_by, idempotency_key) where idempotency_key is not null do nothing
  returning id into created_task_id;

  if created_task_id is null then
    select * into existing_task
    from public.follow_up_tasks
    where created_by = auth.uid() and idempotency_key = btrim(request_key);
    if not found then
      raise exception using errcode = '40001', message = 'Task creation raced; retry with the same request key.';
    end if;
    if existing_task.patient_id is distinct from target_patient_id
      or existing_task.appointment_id is distinct from target_appointment_id
      or existing_task.reason is distinct from btrim(task_reason)
      or existing_task.due_at is distinct from target_due_at
      or existing_task.priority is distinct from task_priority
      or existing_task.priority_source is distinct from btrim(priority_source)
      or existing_task.owner_id is distinct from owner_profile_id
      or existing_task.next_action is distinct from btrim(action_next) then
      raise exception using errcode = '22023', message = 'A task request key cannot be reused with different task fields.';
    end if;
    return existing_task.id;
  end if;

  insert into public.follow_up_task_events (task_id, patient_id, event_type, to_status, actor_id, metadata)
  values (
    created_task_id, target_patient_id, 'created', 'open', auth.uid(),
    jsonb_build_object('priority', task_priority, 'priority_source', btrim(priority_source), 'owner_id', owner_profile_id)
  );
  perform public.write_audit_event(target_patient_id, 'follow_up_task.created', 'follow_up_task', created_task_id,
    jsonb_build_object('status', 'open', 'priority', task_priority, 'priority_source', btrim(priority_source)));
  perform public.enqueue_outbox_event('follow_up_task.created', 'follow_up_task', created_task_id, target_patient_id,
    jsonb_build_object('task_id', created_task_id, 'patient_id', target_patient_id, 'status', 'open'),
    'follow-up-task-created:' || created_task_id::text);
  return created_task_id;
end;
$$;

create or replace function public.update_follow_up_task(
  task_id uuid,
  expected_updated_at timestamptz,
  new_status public.follow_up_task_status default null,
  change_owner boolean default false,
  new_owner_id uuid default null,
  new_due_at timestamptz default null,
  new_next_action text default null,
  closure_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  task public.follow_up_tasks%rowtype;
  resolved_status public.follow_up_task_status;
  resolved_owner uuid;
  resolved_due_at timestamptz;
  resolved_next_action text;
  resolved_closure_note text;
  resolved_closed_at timestamptz;
  resolved_closed_by uuid;
  task_updated_at timestamptz;
  task_event_type text;
begin
  if auth.uid() is null or not public.is_staff_user() then
    raise exception using errcode = '42501', message = 'Follow-up task access is not permitted.';
  end if;
  select * into task from public.follow_up_tasks t where t.id = task_id for update;
  if not found or not public.can_access_patient(task.patient_id) then
    raise exception using errcode = '42501', message = 'Follow-up task access is not permitted.';
  end if;
  if expected_updated_at is null or expected_updated_at is distinct from task.updated_at then
    raise exception using errcode = '40001', message = 'Follow-up task changed; reload it before retrying.';
  end if;
  if change_owner is null then
    raise exception using errcode = '22023', message = 'Owner change flag is invalid.';
  end if;

  resolved_status := coalesce(new_status, task.status);
  resolved_owner := case when change_owner then new_owner_id else task.owner_id end;
  resolved_due_at := coalesce(new_due_at, task.due_at);
  resolved_next_action := coalesce(new_next_action, task.next_action);
  if resolved_next_action is null or length(btrim(resolved_next_action)) not between 1 and 1000 then
    raise exception using errcode = '22023', message = 'Next action is invalid.';
  end if;
  if resolved_owner is not null and not public.profile_can_access_patient(resolved_owner, task.patient_id) then
    raise exception using errcode = '42501', message = 'Task owner must be an active team member authorized for this patient.';
  end if;
  if new_status is not null and task.status is distinct from new_status and not (
    (task.status = 'open' and new_status in ('in_progress', 'completed', 'cancelled'))
    or (task.status = 'in_progress' and new_status in ('open', 'completed', 'cancelled'))
  ) then
    raise exception using errcode = '22023', message = 'Follow-up task status transition is invalid.';
  end if;
  if task.status in ('completed', 'cancelled') and (
    resolved_status is distinct from task.status
    or resolved_owner is distinct from task.owner_id
    or resolved_due_at is distinct from task.due_at
    or resolved_next_action is distinct from task.next_action
  ) then
    raise exception using errcode = '55000', message = 'Closed follow-up tasks are immutable.';
  end if;

  resolved_closure_note := task.closure_note;
  resolved_closed_at := task.closed_at;
  resolved_closed_by := task.closed_by;
  if resolved_status in ('completed', 'cancelled') and task.status is distinct from resolved_status then
    if closure_note is null or length(btrim(closure_note)) not between 1 and 2000 then
      raise exception using errcode = '22023', message = 'A closure note is required to close a follow-up task.';
    end if;
    resolved_closure_note := btrim(closure_note);
    resolved_closed_at := clock_timestamp();
    resolved_closed_by := auth.uid();
  elsif resolved_status in ('open', 'in_progress') then
    resolved_closure_note := null;
    resolved_closed_at := null;
    resolved_closed_by := null;
  end if;

  if resolved_status is not distinct from task.status
    and resolved_owner is not distinct from task.owner_id
    and resolved_due_at is not distinct from task.due_at
    and resolved_next_action is not distinct from task.next_action
    and resolved_closure_note is not distinct from task.closure_note then
    return task.id;
  end if;

  update public.follow_up_tasks
  set status = resolved_status,
      owner_id = resolved_owner,
      due_at = resolved_due_at,
      next_action = btrim(resolved_next_action),
      closure_note = resolved_closure_note,
      closed_at = resolved_closed_at,
      closed_by = resolved_closed_by
  where id = task.id
  returning updated_at into task_updated_at;

  task_event_type := case when task.status is distinct from resolved_status then 'status_changed' else 'updated' end;
  insert into public.follow_up_task_events (task_id, patient_id, event_type, from_status, to_status, actor_id, metadata)
  values (task.id, task.patient_id, task_event_type, task.status, resolved_status, auth.uid(),
    jsonb_build_object('owner_id', resolved_owner, 'due_at', resolved_due_at, 'next_action', btrim(resolved_next_action), 'closure_note', resolved_closure_note));
  perform public.write_audit_event(task.patient_id, 'follow_up_task.updated', 'follow_up_task', task.id,
    jsonb_build_object('from_status', task.status, 'to_status', resolved_status));
  perform public.enqueue_outbox_event('follow_up_task.updated', 'follow_up_task', task.id, task.patient_id,
    jsonb_build_object('task_id', task.id, 'patient_id', task.patient_id, 'status', resolved_status),
    'follow-up-task-updated:' || task.id::text || ':' || task_updated_at::text);
  return task.id;
end;
$$;

create or replace function public.touch_follow_up_task_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;

create or replace function public.create_appointment_follow_up_task()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  patient_owner uuid;
  task_reason text;
  task_priority public.follow_up_priority;
begin
  if new.status not in ('missed', 'overdue') or new.status is not distinct from old.status
    or auth.uid() is null or not public.is_staff_user() then
    return new;
  end if;
  select coalesce(assigned_doctor_id, assigned_staff_id) into patient_owner
  from public.patients where id = new.patient_id;
  task_reason := case when new.status = 'missed' then 'Appointment marked missed' else 'Appointment marked overdue' end;
  task_priority := case when new.status = 'missed' then 'high'::public.follow_up_priority else 'normal'::public.follow_up_priority end;
  perform public.create_follow_up_task(
    new.patient_id,
    task_reason,
    timezone('utc', now()),
    'appointment-status:' || new.id::text || ':' || new.status::text,
    task_priority,
    'appointment_' || new.status::text,
    patient_owner,
    new.id,
    'Contact the patient and agree a next step'
  );
  return new;
end;
$$;

create or replace function public.create_connection_invitation(
  target_patient_id uuid,
  target_care_team_id uuid,
  invitation_ttl_hours integer default 24
)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  raw_code text;
  expiry timestamptz;
begin
  if not public.can_access_patient(target_patient_id) or not public.is_staff_user() then
    raise exception using errcode = '42501', message = 'Patient access is not permitted.';
  end if;
  perform 1 from public.patients where id = target_patient_id for update;
  if exists (
    select 1 from public.patient_care_team_connections c
    where c.patient_id = target_patient_id and c.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'Patient already has an active care-team connection; withdraw it before creating another invitation.';
  end if;
  if not exists (
    select 1
    from public.patients p
    join public.care_teams t on t.organisation_id = p.organisation_id
    where p.id = target_patient_id and t.id = target_care_team_id
  ) then
    raise exception using errcode = '42501', message = 'Care team must belong to the patient organisation.';
  end if;
  if invitation_ttl_hours not between 1 and 168 then
    raise exception using errcode = '22023', message = 'Invitation expiry must be between 1 and 168 hours.';
  end if;
  if not exists (
    select 1 from public.care_team_memberships m
    where m.care_team_id = target_care_team_id and m.profile_id = auth.uid() and m.active
  ) and public.current_profile_role() not in ('org_admin', 'platform_admin') then
    raise exception using errcode = '42501', message = 'Care-team access is not permitted.';
  end if;
  update public.connection_invitations
  set status = 'revoked', revoked_at = timezone('utc', now())
  where patient_id = target_patient_id and status = 'pending';
  raw_code := 'CL-' || upper(encode(extensions.gen_random_bytes(8), 'hex'));
  expiry := timezone('utc', now()) + make_interval(hours => invitation_ttl_hours);
  insert into public.connection_invitations (patient_id, care_team_id, created_by, code, code_hash, code_hint, expires_at)
  values (target_patient_id, target_care_team_id, auth.uid(), raw_code, encode(extensions.digest(raw_code, 'sha256'), 'hex'), right(raw_code, 4), expiry);
  perform public.write_audit_event(target_patient_id, 'connection_invitation.created', 'connection_invitation', null, jsonb_build_object('code_hint', right(raw_code, 4)));
  return query select raw_code, expiry;
end;
$$;

create or replace function public.redeem_connection_code(invitation_code text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  invitation public.connection_invitations%rowtype;
  connected_patient_id uuid;
  connection_rows integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  select * into invitation
  from public.connection_invitations
  where code_hash = encode(extensions.digest(upper(btrim(invitation_code)), 'sha256'), 'hex')
    and revoked_at is null;
  if not found then
    raise exception using errcode = '22023', message = 'Invitation is invalid or expired.';
  end if;
  perform 1 from public.patients where id = invitation.patient_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'Invitation is invalid or expired.';
  end if;
  select * into invitation from public.connection_invitations where id = invitation.id for update;
  if not found or invitation.revoked_at is not null then
    raise exception using errcode = '22023', message = 'Invitation is invalid or expired.';
  end if;
  if invitation.status = 'redeemed' then
    if invitation.redeemed_by = auth.uid() then
      if exists (
        select 1
        from public.patient_care_team_connections c
        join public.connection_consents cc
          on cc.patient_id = c.patient_id and cc.care_team_id = c.care_team_id
        join public.patients p on p.id = c.patient_id
        where c.patient_id = invitation.patient_id
          and c.care_team_id = invitation.care_team_id
          and c.status = 'active'
          and cc.consented_by = auth.uid()
          and cc.withdrawn_at is null
          and p.auth_user_id = auth.uid()
      ) then
        return invitation.patient_id;
      end if;
      raise exception using errcode = '22023', message = 'This invitation was already redeemed, but the connection is no longer active; request a new invitation.';
    end if;
    raise exception using errcode = '42501', message = 'Invitation is already linked to another account.';
  end if;
  if invitation.status <> 'pending' or invitation.expires_at <= timezone('utc', now()) then
    raise exception using errcode = '22023', message = 'Invitation is invalid or expired.';
  end if;
  select id into connected_patient_id from public.patients where id = invitation.patient_id and (auth_user_id is null or auth_user_id = auth.uid());
  if connected_patient_id is null then
    raise exception using errcode = '42501', message = 'Invitation cannot be linked to this account.';
  end if;
  update public.patients set auth_user_id = auth.uid(), updated_at = timezone('utc', now()) where id = connected_patient_id and auth_user_id is null;
  insert into public.connection_consents (patient_id, care_team_id, consent_version, scope, consented_by)
  values (connected_patient_id, invitation.care_team_id, 'v1', '{"coordination": true}'::jsonb, auth.uid());
  insert into public.patient_care_team_connections (patient_id, care_team_id, created_by)
  values (connected_patient_id, invitation.care_team_id, auth.uid())
  on conflict (patient_id) where status = 'active' do nothing;
  get diagnostics connection_rows = row_count;
  if connection_rows = 0 then
    raise exception using errcode = '42501', message = 'Patient already has an active care-team connection; withdraw it before redeeming another invitation.';
  end if;
  update public.connection_invitations
  set status = 'redeemed', redeemed_at = timezone('utc', now()), redeemed_by = auth.uid()
  where id = invitation.id;
  perform public.write_audit_event(connected_patient_id, 'connection.consent_granted', 'connection', invitation.id, jsonb_build_object('consent_version', 'v1'));
  perform public.enqueue_outbox_event('connection.connected', 'patient', connected_patient_id, connected_patient_id, jsonb_build_object('patient_id', connected_patient_id), 'connection:' || connected_patient_id::text || ':' || invitation.id::text);
  return connected_patient_id;
end;
$$;

create or replace function public.create_staff_invitation(
  target_care_team_id uuid,
  target_email text,
  target_role public.profile_role,
  invitation_ttl_hours integer default 72
)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  raw_token text;
  target_org uuid;
begin
  if public.current_profile_role() not in ('org_admin', 'platform_admin') then
    raise exception using errcode = '42501', message = 'Organisation administrator access is required.';
  end if;
  if target_role not in ('doctor', 'staff', 'care_coordinator', 'org_admin') then
    raise exception using errcode = '22023', message = 'Invalid staff role.';
  end if;
  if invitation_ttl_hours not between 1 and 336 then
    raise exception using errcode = '22023', message = 'Invitation expiry must be between 1 and 336 hours.';
  end if;
  select organisation_id into target_org from public.care_teams where id = target_care_team_id;
  if target_org is null or (public.current_profile_role() <> 'platform_admin' and target_org <> public.current_organisation_id()) then
    raise exception using errcode = '42501', message = 'Care-team access is not permitted.';
  end if;
  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.staff_invitations (care_team_id, target_email, target_role, token_hash, expires_at, created_by)
  values (target_care_team_id, lower(btrim(target_email)), target_role, encode(extensions.digest(raw_token, 'sha256'), 'hex'), timezone('utc', now()) + make_interval(hours => invitation_ttl_hours), auth.uid());
  return raw_token;
end;
$$;

create or replace function public.accept_staff_invitation(invitation_token text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  invitation public.staff_invitations%rowtype;
  caller_email text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  caller_email := lower(coalesce((auth.jwt() ->> 'email'), ''));
  select * into invitation from public.staff_invitations
  where token_hash = encode(extensions.digest(btrim(invitation_token), 'sha256'), 'hex')
    and status = 'pending' and expires_at > timezone('utc', now())
    and lower(target_email) = caller_email
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'Staff invitation is invalid, expired, or assigned to another email.';
  end if;
  update public.profiles p
  set role = invitation.target_role,
      organisation_id = (select organisation_id from public.care_teams where id = invitation.care_team_id),
      primary_care_team_id = invitation.care_team_id,
      active = true,
      updated_at = timezone('utc', now())
  where p.id = auth.uid();
  insert into public.care_team_memberships (care_team_id, profile_id, role)
  values (invitation.care_team_id, auth.uid(), invitation.target_role)
  on conflict (care_team_id, profile_id) do update set role = excluded.role, active = true;
  update public.staff_invitations
  set status = 'redeemed', accepted_by = auth.uid(), accepted_at = timezone('utc', now())
  where id = invitation.id;
  return invitation.care_team_id;
end;
$$;

create or replace function public.respond_to_appointment(
  target_appointment_id uuid,
  response text,
  requested_scheduled_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  appointment public.appointments%rowtype;
  event_id uuid;
begin
  if response not in ('confirmed', 'reschedule_requested') then
    raise exception using errcode = '22023', message = 'Unsupported appointment response.';
  end if;
  select * into appointment from public.appointments where id = target_appointment_id for update;
  if not found or not public.can_access_patient(appointment.patient_id) or public.current_patient_id() <> appointment.patient_id then
    raise exception using errcode = '42501', message = 'Appointment access is not permitted.';
  end if;
  if response = 'reschedule_requested' and requested_scheduled_at is null then
    raise exception using errcode = '22023', message = 'A requested appointment time is required.';
  end if;
  insert into public.follow_up_events (patient_id, appointment_id, outcome, next_steps, recorded_by)
  values (
    appointment.patient_id,
    appointment.id,
    case when response = 'confirmed' then 'Patient confirmed attendance' else 'Reschedule requested' end,
    case when response = 'confirmed' then 'Review at scheduled appointment.' else 'Care team must review the requested time.' end,
    auth.uid()
  ) returning id into event_id;
  insert into public.appointment_responses (appointment_id, patient_id, response, requested_scheduled_at, responded_by)
  values (appointment.id, appointment.patient_id, response, requested_scheduled_at, auth.uid());
  insert into public.care_journey_events (patient_id, event_type, title, summary, patient_visible, created_by, metadata)
  values (
    appointment.patient_id,
    'appointment_response',
    case when response = 'confirmed' then 'Appointment confirmed' else 'Reschedule requested' end,
    case when response = 'confirmed' then 'The patient confirmed the appointment.' else 'The patient asked the care team to review a different time.' end,
    true,
    auth.uid(),
    jsonb_build_object('appointment_id', appointment.id, 'response', response)
  );
  perform public.write_audit_event(appointment.patient_id, 'appointment.response.recorded', 'appointment', appointment.id, jsonb_build_object('response', response, 'requested_scheduled_at', requested_scheduled_at));
  perform public.enqueue_outbox_event('appointment.response.recorded', 'appointment', appointment.id, appointment.patient_id, jsonb_build_object('patient_id', appointment.patient_id, 'response', response), 'appointment-response:' || appointment.id::text || ':' || event_id::text);
  return event_id;
end;
$$;

create or replace function public.withdraw_connection(target_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_patient uuid;
begin
  select patient_id into target_patient from public.patient_care_team_connections where id = target_connection_id;
  if target_patient is null or public.current_patient_id() <> target_patient then
    raise exception using errcode = '42501', message = 'Connection access is not permitted.';
  end if;
  perform 1 from public.patients where id = target_patient for update;
  select patient_id into target_patient
  from public.patient_care_team_connections
  where id = target_connection_id and status = 'active'
  for update;
  if target_patient is null or public.current_patient_id() <> target_patient then
    raise exception using errcode = '42501', message = 'Connection access is not permitted.';
  end if;
  update public.patient_care_team_connections set status = 'withdrawn', withdrawn_at = timezone('utc', now()) where id = target_connection_id;
  update public.connection_consents set withdrawn_at = timezone('utc', now()) where patient_id = target_patient and withdrawn_at is null;
  perform public.write_audit_event(target_patient, 'connection.withdrawn', 'connection', target_connection_id);
end;
$$;

create or replace function public.claim_outbox_events(batch_size integer default 25)
returns setof public.outbox_events
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service-role access is required.';
  end if;
  if batch_size is null or batch_size not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Batch size must be between 1 and 100.';
  end if;
  return query
  with expired_max_attempts as (
    select id
    from public.outbox_events
    where status = 'processing'
      and attempts >= 5
      and (claimed_at is null or claimed_at <= timezone('utc', now()) - interval '10 minutes')
    order by created_at
    for update skip locked
    limit batch_size
  ),
  dead_lettered as (
    update public.outbox_events e
    set status = 'dead_letter',
        claimed_at = null,
        last_error = coalesce(e.last_error, 'Worker claim expired after maximum attempts.')
    from expired_max_attempts x
    where e.id = x.id
    returning e.id
  ),
  candidates as (
    select id
    from public.outbox_events
    where (status = 'pending' and available_at <= timezone('utc', now()))
      or (status = 'processing' and attempts < 5
        and (claimed_at is null or claimed_at <= timezone('utc', now()) - interval '10 minutes'))
    order by created_at
    for update skip locked
    limit batch_size
  )
  update public.outbox_events e
  set status = 'processing', claimed_at = timezone('utc', now()), attempts = e.attempts + 1
  from candidates c
  where e.id = c.id
  returning e.*;
end;
$$;

create or replace function public.complete_outbox_event(event_id uuid, expected_attempt integer)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  affected_rows integer;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service-role access is required.';
  end if;
  if expected_attempt is null or expected_attempt not between 1 and 5 then
    raise exception using errcode = '22023', message = 'Outbox claim attempt is invalid.';
  end if;
  update public.outbox_events
  set status = 'delivered', delivered_at = timezone('utc', now()), claimed_at = null, last_error = null
  where id = event_id and status = 'processing' and attempts = expected_attempt;
  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

create or replace function public.fail_outbox_event(event_id uuid, expected_attempt integer, failure_message text, retry_after_seconds integer default 60)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  affected_rows integer;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service-role access is required.';
  end if;
  if expected_attempt is null or expected_attempt not between 1 and 5 then
    raise exception using errcode = '22023', message = 'Outbox claim attempt is invalid.';
  end if;
  if retry_after_seconds is null or retry_after_seconds not between 1 and 86400 then
    raise exception using errcode = '22023', message = 'Retry delay is invalid.';
  end if;
  update public.outbox_events
  set status = case when attempts >= 5 then 'dead_letter'::public.outbox_status else 'pending'::public.outbox_status end,
      available_at = timezone('utc', now()) + make_interval(secs => retry_after_seconds),
      claimed_at = null,
      last_error = left(coalesce(failure_message, 'delivery failed'), 1000)
  where id = event_id and status = 'processing' and attempts = expected_attempt;
  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger organisations_updated_at before update on public.organisations for each row execute function public.set_updated_at();
create trigger care_teams_updated_at before update on public.care_teams for each row execute function public.set_updated_at();
create trigger patients_updated_at before update on public.patients for each row execute function public.set_updated_at();
create trigger patients_identity_guard before insert or update on public.patients for each row execute function public.protect_patient_identity_fields();
create trigger appointments_updated_at before update on public.appointments for each row execute function public.set_updated_at();
create trigger appointments_patient_response_guard before update on public.appointments for each row execute function public.protect_patient_appointment_update();
create trigger appointments_patient_response_audit after update on public.appointments for each row execute function public.record_patient_appointment_response();
create trigger appointments_follow_up_task after update of status on public.appointments for each row execute function public.create_appointment_follow_up_task();
create trigger tests_updated_at before update on public.tests for each row execute function public.set_updated_at();
create trigger medications_updated_at before update on public.medications for each row execute function public.set_updated_at();
create trigger care_plans_updated_at before update on public.care_plans for each row execute function public.set_updated_at();
create trigger follow_up_tasks_updated_at before update on public.follow_up_tasks for each row execute function public.touch_follow_up_task_updated_at();
create trigger reminders_updated_at before update on public.reminders for each row execute function public.set_updated_at();
create trigger connection_code_hash before insert or update on public.connection_invitations for each row execute function public.sync_connection_code_hash();
create trigger patients_context before insert on public.patients for each row execute function public.populate_patient_context();
create trigger patient_groups_context before insert or update of organisation_id, assigned_doctor_id, assigned_staff_id on public.patient_groups for each row execute function public.populate_patient_group_context();
create trigger patient_group_members_scope before insert or update on public.patient_group_members for each row execute function public.protect_patient_group_member_scope();
create trigger invitations_context before insert on public.connection_invitations for each row execute function public.populate_invitation_context();
create trigger profiles_privilege_guard before update on public.profiles for each row execute function public.protect_profile_privilege_fields();
create trigger care_team_membership_scope before insert or update on public.care_team_memberships for each row execute function public.protect_care_team_membership_scope();
create trigger care_team_messages_update_guard before update on public.care_team_messages for each row execute function public.protect_care_team_message_update();
create trigger appointments_patient_guard before update on public.appointments for each row execute function public.protect_patient_appointment_update();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

alter table public.organisations enable row level security;
alter table public.care_teams enable row level security;
alter table public.care_team_memberships enable row level security;
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.patient_care_team_connections enable row level security;
alter table public.connection_consents enable row level security;
alter table public.connection_invitations enable row level security;
alter table public.staff_invitations enable row level security;
alter table public.appointments enable row level security;
alter table public.tests enable row level security;
alter table public.reports enable row level security;
alter table public.medications enable row level security;
alter table public.care_plans enable row level security;
alter table public.follow_up_events enable row level security;
alter table public.follow_up_tasks enable row level security;
alter table public.follow_up_task_events enable row level security;
alter table public.appointment_responses enable row level security;
alter table public.care_journey_events enable row level security;
alter table public.reminders enable row level security;
alter table public.care_team_messages enable row level security;
alter table public.patient_groups enable row level security;
alter table public.patient_group_members enable row level security;
alter table public.activity_log enable row level security;
alter table public.audit_events enable row level security;
alter table public.outbox_events enable row level security;
alter table public.notifications enable row level security;

create policy organisations_read on public.organisations for select using (id = public.current_organisation_id() or public.current_profile_role() = 'platform_admin');
create policy organisations_admin_update on public.organisations for update using (public.current_profile_role() = 'platform_admin' or id = public.current_organisation_id()) with check (public.current_profile_role() = 'platform_admin' or id = public.current_organisation_id());
create policy organisations_platform_insert on public.organisations for insert with check (public.current_profile_role() = 'platform_admin');

create policy care_teams_read on public.care_teams for select using (organisation_id = public.current_organisation_id() or public.current_profile_role() = 'platform_admin');
create policy care_teams_admin_write on public.care_teams for all
using (
  public.current_profile_role() = 'platform_admin'
  or (public.current_profile_role() = 'org_admin' and organisation_id = public.current_organisation_id())
)
with check (
  public.current_profile_role() = 'platform_admin'
  or (public.current_profile_role() = 'org_admin' and organisation_id = public.current_organisation_id())
);

create policy memberships_read on public.care_team_memberships for select using (profile_id = auth.uid() or care_team_id in (select id from public.care_teams where organisation_id = public.current_organisation_id()));
create policy memberships_admin_write on public.care_team_memberships for all
using (
  public.current_profile_role() = 'platform_admin'
  or (
    public.current_profile_role() = 'org_admin'
    and exists (
      select 1 from public.care_teams t
      where t.id = care_team_id and t.organisation_id = public.current_organisation_id()
    )
  )
)
with check (
  public.current_profile_role() = 'platform_admin'
  or (
    public.current_profile_role() = 'org_admin'
    and exists (
      select 1 from public.care_teams t
      where t.id = care_team_id and t.organisation_id = public.current_organisation_id()
    )
  )
);

create policy profiles_self_or_staff_read on public.profiles for select using (id = auth.uid() or organisation_id = public.current_organisation_id() or public.current_profile_role() = 'platform_admin');
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_update on public.profiles for update
using (
  public.current_profile_role() = 'platform_admin'
  or (public.current_profile_role() = 'org_admin' and organisation_id = public.current_organisation_id())
)
with check (
  public.current_profile_role() = 'platform_admin'
  or (public.current_profile_role() = 'org_admin' and organisation_id = public.current_organisation_id())
);

create policy patients_read_authorized on public.patients for select using (
  auth_user_id = auth.uid()
  or public.can_access_patient(id)
  or (
    public.is_staff_user()
    and organisation_id = public.current_organisation_id()
    and (
      public.current_profile_role() in ('org_admin', 'platform_admin')
      or (public.current_profile_role() = 'doctor' and assigned_doctor_id = auth.uid())
      or (public.current_profile_role() in ('staff', 'care_coordinator') and assigned_staff_id = auth.uid())
    )
  )
);
create policy patients_staff_insert on public.patients for insert with check (public.is_staff_user() and (organisation_id is null or organisation_id = public.current_organisation_id() or public.current_profile_role() = 'platform_admin'));
create policy patients_staff_update on public.patients for update using (public.is_staff_user() and public.can_access_patient(id)) with check (public.is_staff_user() and public.can_access_patient(id));

create policy connections_read_authorized on public.patient_care_team_connections for select using (public.can_access_patient(patient_id));
create policy connection_consents_read_authorized on public.connection_consents for select using (public.can_access_patient(patient_id));
create policy invitations_staff_read on public.connection_invitations for select using (public.is_staff_user() and public.can_access_patient(patient_id));
create policy invitations_staff_insert on public.connection_invitations for insert with check (public.is_staff_user() and public.can_access_patient(patient_id));
create policy invitations_staff_update on public.connection_invitations for update using (public.is_staff_user() and public.can_access_patient(patient_id)) with check (public.is_staff_user() and public.can_access_patient(patient_id));
create policy staff_invitations_admin_read on public.staff_invitations for select using (public.current_profile_role() = 'platform_admin' or (public.current_profile_role() = 'org_admin' and exists (select 1 from public.care_teams t where t.id = care_team_id and t.organisation_id = public.current_organisation_id())));

create policy appointments_read_authorized on public.appointments for select using (public.can_access_patient(patient_id));
create policy appointments_staff_insert on public.appointments for insert with check (public.is_staff_user() and public.can_access_patient(patient_id));
create policy appointments_staff_update on public.appointments for update using (public.is_staff_user() and public.can_access_patient(patient_id)) with check (public.is_staff_user() and public.can_access_patient(patient_id));
create policy appointments_patient_response_compat on public.appointments for update using (public.current_patient_id() = patient_id) with check (public.current_patient_id() = patient_id);

create policy tests_read_authorized on public.tests for select using (public.can_access_patient(patient_id));
create policy tests_staff_insert on public.tests for insert with check (public.is_staff_user() and public.can_access_patient(patient_id));
create policy tests_staff_update on public.tests for update using (public.is_staff_user() and public.can_access_patient(patient_id)) with check (public.is_staff_user() and public.can_access_patient(patient_id));

create policy reports_read_authorized on public.reports for select using (public.can_access_patient(patient_id));
create policy reports_staff_insert on public.reports for insert with check (public.is_staff_user() and public.can_access_patient(patient_id));
create policy reports_staff_update on public.reports for update using (public.is_staff_user() and public.can_access_patient(patient_id)) with check (public.is_staff_user() and public.can_access_patient(patient_id));

create policy medications_read_authorized on public.medications for select using (public.can_access_patient(patient_id));
create policy medications_staff_insert on public.medications for insert with check (public.is_staff_user() and public.can_access_patient(patient_id));
create policy medications_staff_update on public.medications for update using (public.is_staff_user() and public.can_access_patient(patient_id)) with check (public.is_staff_user() and public.can_access_patient(patient_id));

create policy care_plans_read_authorized on public.care_plans for select using (public.can_access_patient(patient_id));
create policy care_plans_staff_insert on public.care_plans for insert with check (public.is_staff_user() and public.can_access_patient(patient_id));
create policy care_plans_staff_update on public.care_plans for update using (public.is_staff_user() and public.can_access_patient(patient_id)) with check (public.is_staff_user() and public.can_access_patient(patient_id));

create policy follow_ups_read_authorized on public.follow_up_events for select using (public.can_access_patient(patient_id));
create policy follow_ups_staff_insert on public.follow_up_events for insert with check (public.is_staff_user() and public.can_access_patient(patient_id));
create policy follow_ups_patient_insert on public.follow_up_events for insert with check (public.current_patient_id() = patient_id and recorded_by = auth.uid());
create policy follow_up_tasks_staff_read on public.follow_up_tasks for select using (public.is_staff_user() and public.can_access_patient(patient_id));
create policy follow_up_task_events_staff_read on public.follow_up_task_events for select using (public.is_staff_user() and public.can_access_patient(patient_id));

create policy appointment_responses_read_authorized on public.appointment_responses for select using (public.can_access_patient(patient_id));
create policy care_journey_read_authorized on public.care_journey_events for select using (public.can_access_patient(patient_id) and (patient_visible or public.is_staff_user()));
create policy care_journey_staff_insert on public.care_journey_events for insert with check (public.is_staff_user() and public.can_access_patient(patient_id));
create policy reminders_read_authorized on public.reminders for select using (public.can_access_patient(patient_id));
create policy reminders_staff_write on public.reminders for all using (public.is_staff_user() and public.can_access_patient(patient_id)) with check (public.is_staff_user() and public.can_access_patient(patient_id));
create policy messages_read_authorized on public.care_team_messages for select using (public.can_access_patient(patient_id));
create policy messages_insert_authorized on public.care_team_messages for insert with check (sender_id = auth.uid() and public.can_access_patient(patient_id) and (public.is_staff_user() or public.current_patient_id() = patient_id));
create policy messages_mark_read_authorized on public.care_team_messages for update using (public.can_access_patient(patient_id)) with check (public.can_access_patient(patient_id));

create policy groups_staff_read on public.patient_groups for select using (public.current_profile_role() in ('doctor', 'staff', 'care_coordinator', 'org_admin', 'platform_admin') and (organisation_id = public.current_organisation_id() or public.current_profile_role() = 'platform_admin'));
create policy groups_staff_insert on public.patient_groups for insert with check (public.is_staff_user() and (organisation_id = public.current_organisation_id() or public.current_profile_role() = 'platform_admin'));
create policy groups_staff_update on public.patient_groups for update
using (public.is_staff_user() and (organisation_id = public.current_organisation_id() or public.current_profile_role() = 'platform_admin'))
with check (public.is_staff_user() and (organisation_id = public.current_organisation_id() or public.current_profile_role() = 'platform_admin'));
create policy group_members_staff_access on public.patient_group_members for all using (public.is_staff_user() and exists (select 1 from public.patient_groups g where g.id = group_id and (g.organisation_id = public.current_organisation_id() or public.current_profile_role() = 'platform_admin'))) with check (public.is_staff_user() and exists (select 1 from public.patient_groups g where g.id = group_id and (g.organisation_id = public.current_organisation_id() or public.current_profile_role() = 'platform_admin')));

create policy activity_read_authorized on public.activity_log for select using (patient_id is null or public.can_access_patient(patient_id));
create policy activity_insert_authorized on public.activity_log for insert with check (actor_id = auth.uid() and (public.is_staff_user() or (patient_id = public.current_patient_id() and entity_type = 'message')) and (patient_id is null or public.can_access_patient(patient_id)));
create policy audit_admin_read on public.audit_events for select using (public.current_profile_role() in ('org_admin', 'platform_admin') and (organisation_id = public.current_organisation_id() or public.current_profile_role() = 'platform_admin'));
create policy audit_no_client_write on public.audit_events for insert with check (false);
create policy outbox_no_client_read on public.outbox_events for select using (false);
create policy outbox_no_client_write on public.outbox_events for insert with check (false);
create policy notifications_recipient_read on public.notifications for select using (recipient_id = auth.uid());
create policy notifications_recipient_update on public.notifications for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('careloop-reports', 'careloop-reports', false)
on conflict (id) do update set public = false;

create policy careloop_reports_read on storage.objects
for select using (
  bucket_id = 'careloop-reports'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.can_access_patient(split_part(name, '/', 1)::uuid)
);

create policy careloop_reports_insert on storage.objects
for insert with check (
  bucket_id = 'careloop-reports'
  and public.is_staff_user()
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.can_access_patient(split_part(name, '/', 1)::uuid)
);

create policy careloop_reports_update on storage.objects
for update using (
  bucket_id = 'careloop-reports'
  and public.is_staff_user()
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.can_access_patient(split_part(name, '/', 1)::uuid)
) with check (
  bucket_id = 'careloop-reports'
  and public.is_staff_user()
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.can_access_patient(split_part(name, '/', 1)::uuid)
);

grant usage on schema public to anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.current_profile_role() to anon, authenticated;
grant execute on function public.current_organisation_id() to anon, authenticated;
grant execute on function public.current_patient_id() to anon, authenticated;
grant execute on function public.is_staff_user() to anon, authenticated;
grant execute on function public.can_access_patient(uuid) to anon, authenticated;
grant select, insert, update on public.patients to authenticated;
grant select, insert, update on public.appointments, public.tests, public.reports, public.medications, public.care_plans, public.follow_up_events to authenticated;
grant select on public.follow_up_tasks, public.follow_up_task_events to authenticated;
grant select, insert, update on public.appointment_responses, public.care_journey_events, public.reminders, public.care_team_messages to authenticated;
grant select, insert, update on public.activity_log to authenticated;
grant select on public.profiles, public.organisations, public.care_teams, public.care_team_memberships, public.patient_care_team_connections, public.connection_consents, public.connection_invitations, public.patient_groups, public.patient_group_members, public.notifications to authenticated;
grant execute on function public.redeem_connection_code(text) to authenticated;
grant execute on function public.create_connection_invitation(uuid, uuid, integer) to authenticated;
grant execute on function public.create_staff_invitation(uuid, text, public.profile_role, integer) to authenticated;
grant execute on function public.accept_staff_invitation(text) to authenticated;
grant execute on function public.respond_to_appointment(uuid, text, timestamptz) to authenticated;
grant execute on function public.withdraw_connection(uuid) to authenticated;
grant execute on function public.claim_outbox_events(integer) to service_role;
grant execute on function public.complete_outbox_event(uuid, integer) to service_role;
grant execute on function public.fail_outbox_event(uuid, integer, text, integer) to service_role;
grant execute on function public.create_follow_up_task(uuid, text, timestamptz, text, public.follow_up_priority, text, uuid, uuid, text) to authenticated;
grant execute on function public.update_follow_up_task(uuid, timestamptz, public.follow_up_task_status, boolean, uuid, timestamptz, text, text) to authenticated;

comment on table public.patients is 'Care coordination record; no diagnoses, reports, medications, or autonomous clinical advice are represented by this backend boundary.';
comment on table public.connection_invitations is 'Transition-compatible invitation table. Server-generated redemption checks code_hash; client contract currently returns code once when creating an invitation.';
comment on table public.outbox_events is 'Transactional delivery work; consumers use service-role credentials outside the client apps.';
