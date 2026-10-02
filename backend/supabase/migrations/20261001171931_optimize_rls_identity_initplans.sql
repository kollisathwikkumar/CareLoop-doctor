-- Cache request-scoped identity values as statement initplans instead of
-- re-evaluating auth/current-user helpers for each row checked by RLS.
alter policy memberships_read on public.care_team_memberships
  using (
    profile_id = (select auth.uid())
    or care_team_id in (
      select id from public.care_teams
      where organisation_id = public.current_organisation_id()
    )
  );

alter policy profiles_self_or_staff_read on public.profiles
  using (
    id = (select auth.uid())
    or organisation_id = public.current_organisation_id()
    or public.current_profile_role() = 'platform_admin'
  );

alter policy profiles_self_update on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy patients_read_authorized on public.patients
  using (
    auth_user_id = (select auth.uid())
    or public.can_access_patient(id)
    or (
      public.is_staff_user()
      and organisation_id = public.current_organisation_id()
      and (
        public.current_profile_role() in ('org_admin', 'platform_admin')
        or (public.current_profile_role() = 'doctor' and assigned_doctor_id = (select auth.uid()))
        or (public.current_profile_role() in ('staff', 'care_coordinator') and assigned_staff_id = (select auth.uid()))
      )
    )
  );

alter policy follow_ups_patient_insert on public.follow_up_events
  with check (
    (select public.current_patient_id()) = patient_id
    and recorded_by = (select auth.uid())
  );

alter policy messages_insert_authorized on public.care_team_messages
  with check (
    sender_id = (select auth.uid())
    and public.can_access_patient(patient_id)
    and (public.is_staff_user() or (select public.current_patient_id()) = patient_id)
  );

alter policy activity_insert_authorized on public.activity_log
  with check (
    actor_id = (select auth.uid())
    and (
      public.is_staff_user()
      or ((select public.current_patient_id()) = patient_id and entity_type = 'message')
    )
    and (patient_id is null or public.can_access_patient(patient_id))
  );

alter policy notifications_recipient_read on public.notifications
  using (recipient_id = (select auth.uid()));

alter policy notifications_recipient_update on public.notifications
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));
