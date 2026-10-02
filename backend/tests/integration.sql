\set ON_ERROR_STOP on
begin;
set role postgres;

do $$
declare
  relation_row record;
  privilege_name text;
begin
  for relation_row in
    select c.oid, format('%I.%I', n.nspname, c.relname) as qualified_name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    foreach privilege_name in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
      if has_table_privilege('anon', relation_row.oid, privilege_name) then
        raise exception 'anon retained % on %', privilege_name, relation_row.qualified_name;
      end if;
    end loop;
    foreach privilege_name in array array['DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
      if has_table_privilege('authenticated', relation_row.oid, privilege_name) then
        raise exception 'authenticated retained % on %', privilege_name, relation_row.qualified_name;
      end if;
    end loop;
  end loop;
  if not has_table_privilege('authenticated', 'public.patients', 'SELECT')
    or not has_table_privilege('authenticated', 'public.patient_group_members', 'UPDATE')
    or not has_table_privilege('authenticated', 'public.connection_invitations', 'INSERT') then
    raise exception 'CareLoop client required least-privilege grants are missing';
  end if;

  create table public._careloop_default_acl_probe (id uuid primary key);
  if has_table_privilege('anon', 'public._careloop_default_acl_probe', 'SELECT')
    or has_table_privilege('authenticated', 'public._careloop_default_acl_probe', 'SELECT') then
    raise exception 'new public table inherited API-role privileges';
  end if;
  execute $ddl$ create function public._careloop_default_acl_probe() returns integer language sql as 'select 1' $ddl$;
  if has_function_privilege('anon', 'public._careloop_default_acl_probe()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public._careloop_default_acl_probe()', 'EXECUTE') then
    raise exception 'new public function inherited API-role execution';
  end if;
  drop function public._careloop_default_acl_probe();
  drop table public._careloop_default_acl_probe;
  raise notice 'public API roles have least-privilege current/default ACLs';
end;
$$;

insert into auth.users (id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'doctor@careloop.test', now(), '{"full_name":"Dr. Test"}', now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'patient@careloop.test', now(), '{"full_name":"Patient Test"}', now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'outsider@careloop.test', now(), '{"full_name":"Outsider Test"}', now(), now()),
  ('10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'admin@careloop.test', now(), '{"full_name":"Admin Test"}', now(), now()),
  ('10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'newstaff@careloop.test', now(), '{"full_name":"New Staff"}', now(), now());
insert into public.organisations (id, name, slug)
values ('20000000-0000-0000-0000-000000000001', 'Synthetic Care Org', 'synthetic-care-org');
insert into public.organisations (id, name, slug)
values ('20000000-0000-0000-0000-000000000002', 'Synthetic Other Org', 'synthetic-other-org');
insert into public.care_teams (id, organisation_id, name, created_by)
values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Synthetic Team', '10000000-0000-0000-0000-000000000004');
insert into public.care_teams (id, organisation_id, name, created_by)
values ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Alternate Synthetic Team', '10000000-0000-0000-0000-000000000004');
insert into public.care_teams (id, organisation_id, name, created_by)
values ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Other Synthetic Team', '10000000-0000-0000-0000-000000000003');
update public.profiles
set role = case id when '10000000-0000-0000-0000-000000000004' then 'org_admin'::public.profile_role else 'doctor'::public.profile_role end,
    organisation_id = '20000000-0000-0000-0000-000000000001',
    primary_care_team_id = '30000000-0000-0000-0000-000000000001',
    active = true
where id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004');
update public.profiles
set role = 'org_admin', organisation_id = '20000000-0000-0000-0000-000000000002',
    primary_care_team_id = '30000000-0000-0000-0000-000000000002', active = true
where id = '10000000-0000-0000-0000-000000000003';
insert into public.care_team_memberships (care_team_id, profile_id, role)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'doctor'),
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'org_admin'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'org_admin');
insert into public.patient_groups (organisation_id, name, created_by)
values ('20000000-0000-0000-0000-000000000002', 'Other organisation group', '10000000-0000-0000-0000-000000000003');
insert into public.patients (organisation_id, first_name, last_name)
values ('20000000-0000-0000-0000-000000000002', 'OtherOrg', 'Patient')
returning id as foreign_patient_id
\gset foreign_

set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', false);
select public.create_staff_invitation('30000000-0000-0000-0000-000000000001', 'newstaff@careloop.test', 'staff', 72) as staff_token
\gset s_
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', false);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005","email":"newstaff@careloop.test","role":"authenticated"}', false);
select public.accept_staff_invitation(:'s_staff_token'::text) as accepted_team;
select count(*) as accepted_staff_count from public.profiles where id = auth.uid() and role = 'staff' and active;
select count(*) as accepted_membership_count from public.care_team_memberships where profile_id = auth.uid() and active;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', false);
do $$
declare
  visible_team_count integer;
  visible_membership_count integer;
  changed_profile_count integer;
  created_group_org uuid;
  created_group_id uuid;
begin
  select count(*) into visible_team_count from public.care_teams;
  if visible_team_count <> 2 then
    raise exception 'organisation admin saw % teams; expected only own organisation teams', visible_team_count;
  end if;
  select count(*) into visible_membership_count from public.care_team_memberships;
  if visible_membership_count <> 3 then
    raise exception 'organisation admin saw % memberships; expected only own organisation', visible_membership_count;
  end if;
  begin
    update public.profiles set role = 'platform_admin' where id = auth.uid();
    raise exception 'organisation administrator self-promoted to platform administrator';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.profiles
    set primary_care_team_id = '30000000-0000-0000-0000-000000000002'
    where id = auth.uid();
    raise exception 'organisation admin assigned a cross-organisation primary care team';
  exception when insufficient_privilege then
    raise notice 'cross-organisation primary care team assignment denied';
  end;
  update public.profiles set full_name = 'Cross-organisation mutation'
  where id = '10000000-0000-0000-0000-000000000003';
  get diagnostics changed_profile_count = row_count;
  if changed_profile_count <> 0 then
    raise exception 'organisation admin updated a profile in another organisation';
  end if;
  begin
    insert into public.care_team_memberships (care_team_id, profile_id, role)
    values ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'staff');
    raise exception 'organisation admin inserted membership into another organisation';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.care_team_memberships (care_team_id, profile_id, role)
    values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'org_admin');
    raise exception 'organisation admin added an external-organisation profile to the local care team';
  exception when insufficient_privilege then
    raise notice 'cross-organisation profile membership denied';
  end;
  begin
    insert into public.patient_groups (name, created_by, assigned_doctor_id)
    values ('Role mismatch doctor assignment', auth.uid(), '10000000-0000-0000-0000-000000000005');
    raise exception 'staff-role profile was assigned as a group doctor';
  exception when foreign_key_violation then
    raise notice 'patient-group doctor role mismatch denied';
  end;
  begin
    insert into public.patient_groups (name, created_by, assigned_staff_id)
    values ('Role mismatch staff assignment', auth.uid(), '10000000-0000-0000-0000-000000000001');
    raise exception 'doctor profile was assigned as group staff';
  exception when foreign_key_violation then
    raise notice 'patient-group staff role mismatch denied';
  end;
  update public.profiles set active = false where id = '10000000-0000-0000-0000-000000000005';
  begin
    insert into public.patient_groups (name, created_by, assigned_staff_id)
    values ('Inactive group assignment', auth.uid(), '10000000-0000-0000-0000-000000000005');
    raise exception 'inactive profile was assigned to a patient group';
  exception when foreign_key_violation then
    raise notice 'inactive patient-group assignment denied';
  end;
  update public.profiles set active = true where id = '10000000-0000-0000-0000-000000000005';
  insert into public.patient_groups (name, created_by)
  values ('App-compatible group', auth.uid())
  returning id, organisation_id into created_group_id, created_group_org;
  if created_group_org <> '20000000-0000-0000-0000-000000000001' then
    raise exception 'patient group did not inherit the caller organisation';
  end if;
  begin
    update public.patient_groups set organisation_id = '20000000-0000-0000-0000-000000000002'
    where id = created_group_id;
    raise exception 'organisation admin moved a group across organisations';
  exception when insufficient_privilege then
    null;
  end;
  raise notice 'cross-organisation isolation and app-compatible group creation passed';
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
do $$
begin
  begin
    insert into public.patients (organisation_id, auth_user_id, first_name, last_name, assigned_doctor_id)
    values (
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002',
      'Unapproved', 'Linked', '10000000-0000-0000-0000-000000000001'
    );
    raise exception 'staff created a patient with a pre-linked Auth account';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
insert into public.patients (
  first_name, last_name, date_of_birth, phone, email, condition, notes,
  assigned_doctor_id, assigned_staff_id, auth_user_id, created_at
)
values (
  'Patient', 'Test', null, '+910000000001', null, null, null,
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000005', null, now()
)
returning id as patient_id
\gset p_
insert into public.patients (first_name, last_name, phone, assigned_doctor_id)
values ('Other', 'Patient', '+910000000002', '10000000-0000-0000-0000-000000000001')
returning id as other_patient_id
\gset o_
select set_config('careloop.test_patient_id', :'p_patient_id', false);
do $$
begin
  begin
    update public.patients set auth_user_id = '10000000-0000-0000-0000-000000000003'
    where id = current_setting('careloop.test_patient_id')::uuid;
    raise exception 'staff linked a patient account without invitation redemption';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.patients set organisation_id = '20000000-0000-0000-0000-000000000002'
    where id = current_setting('careloop.test_patient_id')::uuid;
    raise exception 'staff moved a patient across organisations';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.patients set assigned_staff_id = '10000000-0000-0000-0000-000000000003'
    where id = current_setting('careloop.test_patient_id')::uuid;
    raise exception 'staff assigned a patient to another organisation';
  exception when foreign_key_violation then
    null;
  end;
  update public.patients set assigned_staff_id = '10000000-0000-0000-0000-000000000005'
  where id = current_setting('careloop.test_patient_id')::uuid;
  raise notice 'patient identity guarded; same-organisation allocation allowed';
end;
$$;
insert into public.patient_groups (name, created_by)
values ('Membership tenant guard', auth.uid())
returning id as membership_guard_group_id
\gset group_
select set_config('careloop.test_group_id', :'group_membership_guard_group_id', false);
select set_config('careloop.test_foreign_patient_id', :'foreign_foreign_patient_id', false);
select set_config('careloop.test_local_patient_id', :'p_patient_id', false);
do $$
begin
  insert into public.patient_group_members (group_id, patient_id)
  values (current_setting('careloop.test_group_id')::uuid, current_setting('careloop.test_local_patient_id')::uuid);
  begin
    insert into public.patient_group_members (group_id, patient_id)
    values (current_setting('careloop.test_group_id')::uuid, current_setting('careloop.test_foreign_patient_id')::uuid);
    raise exception 'cross-organisation patient was added to a group';
  exception when insufficient_privilege then
    raise notice 'cross-organisation patient group membership denied';
  end;
end;
$$;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', false);
select set_config('careloop.test_patient_id', :'p_patient_id', false);
do $$
begin
  begin
    perform public.create_connection_invitation(
      current_setting('careloop.test_patient_id')::uuid,
      '30000000-0000-0000-0000-000000000002',
      24
    );
    raise exception 'organisation admin created a connection invitation for another organisation team';
  exception when insufficient_privilege then
    null;
  end;
  raise notice 'cross-organisation connection invitation denied';
end;
$$;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
insert into public.appointments (patient_id, doctor_id, scheduled_at, purpose, notes, created_by)
values (:'p_patient_id', '10000000-0000-0000-0000-000000000001', now() + interval '2 days', 'Follow-up review', 'Synthetic appointment', '10000000-0000-0000-0000-000000000001')
returning id as appointment_id
\gset a_

select public.create_follow_up_task(
  :'p_patient_id'::uuid, 'Review pending test results', now() + interval '1 day',
  'integration-task-create-v1', 'normal', 'staff_created',
  '10000000-0000-0000-0000-000000000001', :'a_appointment_id'::uuid,
  'Call patient after results are reviewed'
) as task_id
\gset task_
select public.create_follow_up_task(
  :'p_patient_id'::uuid, 'Review pending test results', now() + interval '1 day',
  'integration-task-create-v1', 'normal', 'staff_created',
  '10000000-0000-0000-0000-000000000001', :'a_appointment_id'::uuid,
  'Call patient after results are reviewed'
) as replay_task_id
\gset task_replay_
select set_config('careloop.test_task_id', :'task_task_id', false);
select set_config('careloop.test_task_replay_id', :'task_replay_replay_task_id', false);
select updated_at as task_initial_updated_at from public.follow_up_tasks where id = :'task_task_id'::uuid
\gset task_
select set_config('careloop.test_task_initial_updated_at', :'task_task_initial_updated_at', false);
select public.update_follow_up_task(:'task_task_id'::uuid, :'task_task_initial_updated_at'::timestamptz, 'in_progress') as task_id;
do $$
declare
  rejection_code text;
  task_row public.follow_up_tasks%rowtype;
  task_count integer;
  event_count integer;
begin
  if current_setting('careloop.test_task_id')::uuid <> current_setting('careloop.test_task_replay_id')::uuid then
    raise exception 'idempotent task create returned different IDs';
  end if;
  select count(*) into task_count from public.follow_up_tasks where id = current_setting('careloop.test_task_id')::uuid;
  select count(*) into event_count from public.follow_up_task_events where task_id = current_setting('careloop.test_task_id')::uuid and event_type = 'created';
  if task_count <> 1 or event_count <> 1 then raise exception 'task create replay duplicated task or creation event'; end if;
  select * into task_row from public.follow_up_tasks where id = current_setting('careloop.test_task_id')::uuid;
  if task_row.status <> 'in_progress' then raise exception 'task transition to in_progress failed'; end if;
  rejection_code := null;
  begin
    perform public.create_follow_up_task(
      task_row.patient_id, 'Different content under reused key', task_row.due_at,
      'integration-task-create-v1', 'normal', 'staff_created', task_row.owner_id,
      task_row.appointment_id, task_row.next_action
    );
    rejection_code := 'NO_ERROR';
  exception when others then
    get stacked diagnostics rejection_code = returned_sqlstate;
  end;
  if rejection_code <> '22023' then raise exception 'task idempotency key payload mismatch returned %', rejection_code; end if;
  rejection_code := null;
  begin
    perform public.create_follow_up_task(
      task_row.patient_id, 'Invalid owner test', now() + interval '1 day',
      'integration-task-invalid-owner-v1', 'normal', 'staff_created',
      '10000000-0000-0000-0000-000000000004', task_row.appointment_id, 'Contact patient'
    );
    rejection_code := 'NO_ERROR';
  exception when others then
    get stacked diagnostics rejection_code = returned_sqlstate;
  end;
  if rejection_code <> '42501' then raise exception 'unauthorized task owner returned %', rejection_code; end if;
  begin
    perform public.update_follow_up_task(task_row.id, current_setting('careloop.test_task_initial_updated_at')::timestamptz, 'completed', false, null, null, null, 'Done');
    rejection_code := 'NO_ERROR';
  exception when others then
    get stacked diagnostics rejection_code = returned_sqlstate;
  end;
  if rejection_code <> '40001' then raise exception 'stale task edit returned %', rejection_code; end if;
  begin
    perform public.update_follow_up_task(task_row.id, task_row.updated_at, 'completed');
    rejection_code := 'NO_ERROR';
  exception when others then
    get stacked diagnostics rejection_code = returned_sqlstate;
  end;
  if rejection_code <> '22023' then raise exception 'task closure without evidence returned %', rejection_code; end if;
  raise notice 'follow-up task idempotency, payload/owner validation, status transition, stale-write rejection, and closure evidence passed';
end;
$$;
select public.update_follow_up_task(
  :'task_task_id'::uuid,
  (select updated_at from public.follow_up_tasks where id = :'task_task_id'::uuid),
  'completed', false, null, null, null, 'Patient contacted; plan agreed'
) as closed_task_id;
do $$
declare
  task_row public.follow_up_tasks%rowtype;
  rejection_code text;
begin
  select * into task_row from public.follow_up_tasks where id = current_setting('careloop.test_task_id')::uuid;
  if not exists (
    select 1 from public.follow_up_tasks
    where id = current_setting('careloop.test_task_id')::uuid and status = 'completed'
      and closed_at is not null and closed_by = auth.uid()
      and closure_note = 'Patient contacted; plan agreed'
  ) then raise exception 'task completion evidence was not persisted'; end if;
  if (select count(*) from public.follow_up_task_events where task_id = current_setting('careloop.test_task_id')::uuid) <> 3 then
    raise exception 'task event history does not contain create, start, and completion events';
  end if;
  begin
    perform public.update_follow_up_task(task_row.id, task_row.updated_at, null, true, null, null, null, null);
    rejection_code := 'NO_ERROR';
  exception when others then
    get stacked diagnostics rejection_code = returned_sqlstate;
  end;
  if rejection_code <> '55000' then raise exception 'closed task mutation returned %', rejection_code; end if;
end;
$$;

insert into public.appointments (patient_id, doctor_id, scheduled_at, purpose, created_by)
values (:'p_patient_id', '10000000-0000-0000-0000-000000000001', now() - interval '1 day', 'Missed appointment task fixture', '10000000-0000-0000-0000-000000000001')
returning id as missed_appointment_id
\gset missed_
select set_config('careloop.test_missed_appointment_id', :'missed_missed_appointment_id', false);
update public.appointments set status = 'missed' where id = :'missed_missed_appointment_id'::uuid;
do $$
begin
  if not exists (
    select 1 from public.follow_up_tasks
    where appointment_id = current_setting('careloop.test_missed_appointment_id')::uuid
      and reason = 'Appointment marked missed' and priority = 'high'
      and priority_source = 'appointment_missed' and owner_id = '10000000-0000-0000-0000-000000000001'
  ) then raise exception 'missed appointment did not emit an explainable assigned task'; end if;
end;
$$;

select code as invitation_code from public.create_connection_invitation(:'p_patient_id'::uuid, '30000000-0000-0000-0000-000000000001', 24)
\gset i_
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', false);
select public.redeem_connection_code(:'i_invitation_code'::text) as redeemed_patient;
select case when public.redeem_connection_code(:'i_invitation_code'::text) = :'p_patient_id'::uuid then 'idempotent' else 'wrong_id' end as redemption_identity;
select count(*) as consent_count from public.connection_consents where patient_id = :'p_patient_id'::uuid and consented_by = auth.uid();
select count(*) as connection_count from public.patient_care_team_connections where patient_id = :'p_patient_id'::uuid and status = 'active';

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', false);
do $$
begin
  begin
    perform public.create_connection_invitation(
      current_setting('careloop.test_patient_id')::uuid,
      '30000000-0000-0000-0000-000000000003',
      24
    );
    raise exception 'staff created a second care-team invitation while a connection was active';
  exception when insufficient_privilege then
    raise notice 'active patient connection blocks second invitation RPC';
  end;
  begin
    insert into public.connection_invitations (patient_id, care_team_id, created_by, code)
    values (current_setting('careloop.test_patient_id')::uuid, '30000000-0000-0000-0000-000000000003', auth.uid(), 'CL-SECOND-TEAM');
    raise exception 'legacy direct insert created a second care-team invitation while connected';
  exception when insufficient_privilege then
    raise notice 'active patient connection blocks legacy second invitation insert';
  end;
  if exists (
    select 1 from public.connection_invitations
    where patient_id = current_setting('careloop.test_patient_id')::uuid and care_team_id = '30000000-0000-0000-0000-000000000003'
  ) then
    raise exception 'second-team invitation persisted despite active connection';
  end if;
end;
$$;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', false);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', false);
update public.profiles set role = 'doctor'
where id = '10000000-0000-0000-0000-000000000005';
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', false);
do $$
declare
  patient_id uuid := current_setting('careloop.test_patient_id')::uuid;
  visible_patient_count integer;
begin
  if public.can_access_patient(patient_id) then
    raise exception 'profile role change retained access through stale staff assignment or membership';
  end if;
  select count(*) into visible_patient_count from public.patients where id = patient_id;
  if visible_patient_count <> 0 then
    raise exception 'profile role change left the former staff member able to read the patient';
  end if;
  raise notice 'stale patient assignment and membership access denied after role change';
end;
$$;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', false);
update public.profiles set role = 'staff'
where id = '10000000-0000-0000-0000-000000000005';
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', false);

do $$
declare
  visible_tasks integer;
  rejection_code text;
begin
  select count(*) into visible_tasks from public.follow_up_tasks where patient_id = current_setting('careloop.test_patient_id')::uuid;
  if visible_tasks <> 0 then raise exception 'patient role saw % staff-only follow-up tasks', visible_tasks; end if;
  begin
    insert into public.follow_up_tasks (patient_id, reason, due_at, priority_source, next_action, created_by)
    values (current_setting('careloop.test_patient_id')::uuid, 'Patient forged task', now(), 'test', 'test', auth.uid());
    rejection_code := 'NO_ERROR';
  exception when others then
    get stacked diagnostics rejection_code = returned_sqlstate;
  end;
  if rejection_code <> '42501' then raise exception 'patient direct task creation returned %', rejection_code; end if;
  raise notice 'follow-up queue is staff-only; patient direct task creation denied';
end;
$$;
select count(*) as patient_appointment_count from public.appointments where patient_id = :'p_patient_id'::uuid;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
update public.appointments
set scheduled_at = scheduled_at + interval '1 day', status = 'upcoming'
where id = :'a_appointment_id'::uuid;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', false);

do $$
declare
  target_appointment uuid;
  rejection_code text;
  changed_rows integer;
  response_rows integer;
begin
  select id into target_appointment from public.appointments where patient_id = public.current_patient_id() limit 1;
  update public.appointments
  set scheduled_at = scheduled_at + interval '4 days', status = 'upcoming'
  where id = target_appointment;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then raise exception 'patient app appointment reschedule was not accepted'; end if;
  select count(*) into response_rows from public.appointment_responses
  where appointment_id = target_appointment and patient_id = public.current_patient_id()
    and response = 'reschedule_requested' and requested_scheduled_at is not null and responded_by = auth.uid();
  if response_rows <> 1 then raise exception 'patient app schedule update was not recorded as an audited reschedule response'; end if;

  rejection_code := null;
  begin
    update public.appointments set notes = 'Patient-modified staff note' where id = target_appointment;
    rejection_code := 'NO_ERROR';
  exception when others then
    get stacked diagnostics rejection_code = returned_sqlstate;
  end;
  if rejection_code <> '42501' then raise exception 'notes guard returned %', rejection_code; end if;
  raise notice 'app-compatible reschedule recorded; patient note edit denied';
end;
$$;
insert into public.follow_up_events (patient_id, appointment_id, attempted_at, outcome, next_steps, recorded_by)
values (public.current_patient_id(), :'a_appointment_id'::uuid, now(), 'Reschedule requested', 'Please review the requested time.', auth.uid());
select case when count(*) = 1 then 'patient_app_follow_up_insert=PASS' else 'patient_app_follow_up_insert=FAIL' end
from public.follow_up_events
where patient_id = public.current_patient_id() and appointment_id = :'a_appointment_id'::uuid
  and recorded_by = auth.uid() and outcome = 'Reschedule requested';
select count(*) as unauthorized_patient_rows from public.patients where id = :'o_other_patient_id'::uuid;

select public.respond_to_appointment(:'a_appointment_id'::uuid, 'confirmed', null) as response_event;
select count(*) as response_count from public.appointment_responses where appointment_id = :'a_appointment_id'::uuid;
select count(*) as journey_count from public.care_journey_events where patient_id = :'p_patient_id'::uuid;
select set_config('careloop.test_appointment_id', :'a_appointment_id', false);
reset role;
select topic, aggregate_type, aggregate_id, organisation_id, payload
from public.outbox_events where topic = 'appointment.response.recorded' and aggregate_id = :'a_appointment_id'::uuid;
do $$
begin
  if not exists (
    select 1 from public.outbox_events
    where topic = 'appointment.response.recorded'
      and aggregate_type = 'appointment'
      and aggregate_id = current_setting('careloop.test_appointment_id')::uuid
      and organisation_id = '20000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'appointment response outbox event lost its organisation attribution';
  end if;
end;
$$;
set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', false);

insert into public.care_team_messages (patient_id, sender_id, body)
values (public.current_patient_id(), auth.uid(), 'Patient message fixture')
returning id as patient_message_id
\gset message_
select set_config('careloop.test_message_id', :'message_patient_message_id', false);
insert into storage.objects (bucket_id, name, owner_id, metadata)
values (
  'careloop-reports',
  public.current_patient_id()::text || '/messages/patient-attachment.png',
  auth.uid(),
  '{"mimetype":"image/png","size":1024}'::jsonb
);
do $$
begin
  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'careloop-reports',
      public.current_patient_id()::text || '/reports/patient-forged.pdf',
      auth.uid(),
      '{"mimetype":"application/pdf","size":1024}'::jsonb
    );
    raise exception 'patient uploaded outside the messages prefix';
  exception when insufficient_privilege then
    raise notice 'patient report path upload denied';
  end;
  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'careloop-reports',
      public.current_patient_id()::text || '/messages/oversize.png',
      auth.uid(),
      '{"mimetype":"image/png","size":8388609}'::jsonb
    );
    raise exception 'patient uploaded an oversized message attachment';
  exception when insufficient_privilege then
    raise notice 'patient oversized attachment denied';
  end;
end;
$$;
do $$
declare
  rejection_code text;
begin
  begin
    update public.care_team_messages set body = 'Tampered message'
    where id = current_setting('careloop.test_message_id')::uuid;
    rejection_code := 'NO_ERROR';
  exception when others then
    get stacked diagnostics rejection_code = returned_sqlstate;
  end;
  if rejection_code <> '42501' then raise exception 'message content guard returned %', rejection_code; end if;
  update public.care_team_messages set read_at = now()
  where id = current_setting('careloop.test_message_id')::uuid;
  if not exists (select 1 from public.care_team_messages where id = current_setting('careloop.test_message_id')::uuid and read_at is not null) then
    raise exception 'message read receipt update did not persist';
  end if;
  raise notice 'message content immutable; read receipt update allowed';
end;
$$;

reset role;
insert into public.outbox_events (topic, aggregate_type, idempotency_key)
values ('lease.recovery.synthetic', 'patient', 'lease-recovery:' || gen_random_uuid()::text)
returning id as stale_outbox_id
\gset
select set_config('careloop.stale_outbox_id', :'stale_outbox_id', false);
insert into public.outbox_events (topic, aggregate_type, idempotency_key)
values ('lease.dead-letter.synthetic', 'patient', 'lease-dead-letter:' || gen_random_uuid()::text)
returning id as deadletter_outbox_id
\gset
select set_config('careloop.deadletter_outbox_id', :'deadletter_outbox_id', false);
set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
select count(*) as claimed_count from public.claim_outbox_events(10);
select count(*) as processing_count from public.outbox_events where status = 'processing';
reset role;
update public.outbox_events
set claimed_at = timezone('utc', now()) - interval '15 minutes'
where id in (:'stale_outbox_id'::uuid, :'deadletter_outbox_id'::uuid) and status = 'processing';
update public.outbox_events
set attempts = 5
where id = :'deadletter_outbox_id'::uuid and status = 'processing';
set role service_role;
select count(*) as stale_reclaimed_count
from public.claim_outbox_events(10) as claimed
where claimed.id = :'stale_outbox_id'::uuid;
do $$
declare
  recovered_attempts integer;
begin
  select attempts into recovered_attempts
  from public.outbox_events
  where id = current_setting('careloop.stale_outbox_id')::uuid;
  if recovered_attempts <> 2 then
    raise exception 'expired processing outbox event was not reclaimed; attempts=%', recovered_attempts;
  end if;
  if not exists (
    select 1 from public.outbox_events
    where id = current_setting('careloop.deadletter_outbox_id')::uuid
      and status = 'dead_letter' and attempts = 5 and claimed_at is null
  ) then
    raise exception 'expired max-attempt outbox claim was not dead-lettered';
  end if;
  raise notice 'expired outbox claim recovered and exhausted claim dead-lettered';
end;
$$;
select public.complete_outbox_event(:'stale_outbox_id'::uuid, 1) as stale_completion_accepted;
select public.fail_outbox_event(:'stale_outbox_id'::uuid, 1, 'stale worker failure', 60) as stale_failure_recorded;
do $$
begin
  if not exists (
    select 1 from public.outbox_events
    where id = current_setting('careloop.stale_outbox_id')::uuid and status = 'processing' and attempts = 2
  ) then
    raise exception 'stale worker completed a newer outbox claim';
  end if;
end;
$$;
select public.complete_outbox_event(id, attempts) from public.outbox_events where status = 'processing';
select count(*) as delivered_count from public.outbox_events where status = 'delivered';
do $$
declare
  missing_foreign_keys text;
begin
  select string_agg(conrelid::regclass::text || '.' || conname, ', ' order by conrelid::regclass::text, conname)
  into missing_foreign_keys
  from pg_constraint c
  where c.contype = 'f'
    and c.connamespace = 'public'::regnamespace
    and not exists (
      select 1
      from pg_index i
      join pg_class index_relation on index_relation.oid = i.indexrelid
      join pg_am access_method on access_method.oid = index_relation.relam
      where i.indrelid = c.conrelid
        and access_method.amname = 'btree'
        and i.indisvalid
        and i.indisready
        and i.indpred is null
        and i.indnkeyatts >= cardinality(c.conkey)
        and (
          select array_agg(i.indkey[position] order by position)
          from generate_series(0, cardinality(c.conkey) - 1) as key_position(position)
        ) = c.conkey
    );
  if missing_foreign_keys is not null then
    raise exception 'public foreign keys without a leading-column B-tree index: %', missing_foreign_keys;
  end if;
  raise notice 'every public foreign key has a covering leading-column B-tree index';
end;
$$;


reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","email":"doctor@careloop.test","role":"authenticated"}', false);
select * from public.create_connection_qr_invitation(:'o_other_patient_id'::uuid, '30000000-0000-0000-0000-000000000001', 24)
\gset qr_
select :'qr_qr_payload'::text ~ '^carelooppatient://connect\?v=1&code=CL-[0-9A-F]{16}$' as qr_payload_shape;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', false);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","email":"outsider@careloop.test","role":"authenticated"}', false);
select public.redeem_connection_qr_payload(:'qr_qr_payload'::text) as qr_redeemed_patient;
select count(*) as qr_snapshot_count
from public.get_patient_connectivity_snapshot()
where patient_id = :'o_other_patient_id'::uuid
  and care_team_id = '30000000-0000-0000-0000-000000000001'
  and consent_version = 'v1';

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","email":"doctor@careloop.test","role":"authenticated"}', false);
select count(*) as dashboard_queue_count
from public.list_follow_up_queue(NULL, NULL, NULL, 100)
where patient_id = :'p_patient_id'::uuid;

set role service_role;
insert into public.external_data_sources (organisation_id, name, source_type, external_reference)
values ('20000000-0000-0000-0000-000000000001', 'Synthetic laboratory feed', 'lab', 'lab-test-feed')
returning id as source_id
\gset ingest_
insert into public.external_import_batches (source_id, external_run_id, status, row_count)
values (:'ingest_source_id'::uuid, 'run-001', 'processing', 1)
returning id as batch_id
\gset ingest_
insert into public.external_import_records (batch_id, external_record_id, record_type, payload, content_hash)
values (:'ingest_batch_id'::uuid, 'lab-record-001', 'test', '{"test":"HbA1c","value":"7.1"}'::jsonb, repeat('a', 64));
select count(*) as imported_record_count
from public.external_import_records
where batch_id = :'ingest_batch_id'::uuid;
select id as outbox_event_id from public.outbox_events order by created_at limit 1
\gset delivery_
insert into public.notification_deliveries (outbox_event_id, recipient_id, channel, status)
values (:'delivery_outbox_event_id'::uuid, '10000000-0000-0000-0000-000000000002', 'in_app', 'pending');
select count(*) as delivery_ledger_count
from public.notification_deliveries
where outbox_event_id = :'delivery_outbox_event_id'::uuid;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', false);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","email":"patient@careloop.test","role":"authenticated"}', false);
select public.register_notification_endpoint('push', 'ExpoPushToken[synthetic]', 'Local test device') as endpoint_id
\gset endpoint_
select count(*) as endpoint_count
from public.notification_endpoints
where id = :'endpoint_endpoint_id'::uuid and recipient_id = auth.uid();
select public.revoke_notification_endpoint(:'endpoint_endpoint_id'::uuid) as endpoint_revoked;
select count(*) as revoked_endpoint_count
from public.notification_endpoints
where id = :'endpoint_endpoint_id'::uuid and revoked_at is not null;

select 'integration_pass' as result;
rollback;
