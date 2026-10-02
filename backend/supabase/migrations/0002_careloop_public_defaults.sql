-- CareLoop public API default privileges hardening.
-- Keep future public objects closed by default, then restore only the grants used by the app.

revoke all privileges on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.patients to authenticated;
grant select, insert, update on public.appointments, public.tests, public.reports, public.medications, public.care_plans, public.follow_up_events to authenticated;
grant select on public.follow_up_tasks, public.follow_up_task_events to authenticated;
grant select, insert, update on public.appointment_responses, public.care_journey_events, public.reminders, public.care_team_messages to authenticated;
grant select, insert, update on public.activity_log to authenticated;
grant select on public.profiles, public.organisations, public.care_teams, public.care_team_memberships, public.patient_care_team_connections, public.connection_consents, public.connection_invitations, public.patient_groups, public.patient_group_members, public.notifications to authenticated;
grant execute on function public.current_profile_role() to anon, authenticated;
grant execute on function public.current_organisation_id() to anon, authenticated;
grant execute on function public.current_patient_id() to anon, authenticated;
grant execute on function public.is_staff_user() to anon, authenticated;
grant execute on function public.can_access_patient(uuid) to anon, authenticated;
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
