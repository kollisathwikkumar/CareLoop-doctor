-- Remove Supabase advisor duplicate-permissive-policy findings without changing
-- which authenticated actors may read or mutate the underlying rows. Policies
-- with FOR ALL are split so SELECT authorization never becomes a write grant.

-- Patient responses and staff appointment changes remain guarded by the same
-- row predicates; the trigger still limits the columns patients can change.
drop policy if exists appointments_staff_update on public.appointments;
drop policy if exists appointments_patient_response_compat on public.appointments;
create policy appointments_update_authorized on public.appointments
for update
using (
  (public.is_staff_user() and public.can_access_patient(patient_id))
  or (public.current_patient_id() = patient_id)
)
with check (
  (public.is_staff_user() and public.can_access_patient(patient_id))
  or (public.current_patient_id() = patient_id)
);

-- A caller may update their own profile or a profile within the admin's
-- organization/platform scope, exactly as the previous policies allowed.
drop policy if exists profiles_self_update on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_update_authorized on public.profiles
for update
using (
  id = (select auth.uid())
  or public.current_profile_role() = 'platform_admin'
  or (
    public.current_profile_role() = 'org_admin'
    and organisation_id = public.current_organisation_id()
  )
)
with check (
  id = (select auth.uid())
  or public.current_profile_role() = 'platform_admin'
  or (
    public.current_profile_role() = 'org_admin'
    and organisation_id = public.current_organisation_id()
  )
);

-- Read access remains separate; only the previous admin-write ALL policies are
-- split into commands to prevent admin write policies overlapping SELECT.
drop policy if exists care_teams_admin_write on public.care_teams;
create policy care_teams_admin_insert on public.care_teams
for insert with check (
  public.current_profile_role() = 'platform_admin'
  or (public.current_profile_role() = 'org_admin' and organisation_id = public.current_organisation_id())
);
create policy care_teams_admin_update on public.care_teams
for update
using (
  public.current_profile_role() = 'platform_admin'
  or (public.current_profile_role() = 'org_admin' and organisation_id = public.current_organisation_id())
)
with check (
  public.current_profile_role() = 'platform_admin'
  or (public.current_profile_role() = 'org_admin' and organisation_id = public.current_organisation_id())
);
create policy care_teams_admin_delete on public.care_teams
for delete using (
  public.current_profile_role() = 'platform_admin'
  or (public.current_profile_role() = 'org_admin' and organisation_id = public.current_organisation_id())
);

drop policy if exists memberships_admin_write on public.care_team_memberships;
create policy care_team_memberships_admin_insert on public.care_team_memberships
for insert with check (
  public.current_profile_role() = 'platform_admin'
  or (
    public.current_profile_role() = 'org_admin'
    and exists (
      select 1 from public.care_teams t
      where t.id = care_team_id and t.organisation_id = public.current_organisation_id()
    )
  )
);
create policy care_team_memberships_admin_update on public.care_team_memberships
for update
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
create policy care_team_memberships_admin_delete on public.care_team_memberships
for delete using (
  public.current_profile_role() = 'platform_admin'
  or (
    public.current_profile_role() = 'org_admin'
    and exists (
      select 1 from public.care_teams t
      where t.id = care_team_id and t.organisation_id = public.current_organisation_id()
    )
  )
);

-- The staff insert rule and patient self-reported insert rule are expressed as
-- one OR predicate; neither branch's actor/patient checks are relaxed.
drop policy if exists follow_ups_staff_insert on public.follow_up_events;
drop policy if exists follow_ups_patient_insert on public.follow_up_events;
create policy follow_ups_insert_authorized on public.follow_up_events
for insert with check (
  (public.is_staff_user() and public.can_access_patient(patient_id))
  or (
    public.current_patient_id() = patient_id
    and recorded_by = (select auth.uid())
  )
);

-- Staff SELECT is already covered by reminders_read_authorized. Split writes
-- from the old ALL policy, retaining the original mutation predicates.
drop policy if exists reminders_staff_write on public.reminders;
create policy reminders_staff_insert on public.reminders
for insert with check (public.is_staff_user() and public.can_access_patient(patient_id));
create policy reminders_staff_update on public.reminders
for update
using (public.is_staff_user() and public.can_access_patient(patient_id))
with check (public.is_staff_user() and public.can_access_patient(patient_id));
create policy reminders_staff_delete on public.reminders
for delete using (public.is_staff_user() and public.can_access_patient(patient_id));
