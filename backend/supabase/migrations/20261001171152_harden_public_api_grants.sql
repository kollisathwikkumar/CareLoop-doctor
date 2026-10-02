-- Remove Supabase's permissive default ACLs from public API roles.
-- The Patient app has no DELETE path; table writes stay limited to the grants
-- explicitly recreated below, with RLS enforcing the row-level boundary.
revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
-- PostgreSQL grants EXECUTE to PUBLIC globally by default. A per-schema REVOKE
-- cannot cancel that global grant, so revoke PUBLIC globally, then the direct
-- Supabase API-role defaults in public.
alter default privileges for role postgres
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- Restore only the Data API operations exercised by CareLoop clients.
grant select, insert, update on public.patients to authenticated;
grant select, insert, update on public.appointments, public.tests, public.reports,
  public.medications, public.care_plans, public.follow_up_events to authenticated;
grant select on public.follow_up_tasks, public.follow_up_task_events to authenticated;
grant select, insert, update on public.appointment_responses, public.care_journey_events,
  public.reminders, public.care_team_messages to authenticated;
grant select, insert, update on public.activity_log to authenticated;
grant update on public.profiles to authenticated;
grant select on public.profiles, public.organisations, public.care_teams,
  public.care_team_memberships, public.patient_care_team_connections,
  public.connection_consents, public.connection_invitations, public.patient_groups,
  public.patient_group_members, public.notifications to authenticated;
grant insert on public.connection_invitations, public.patient_groups to authenticated;
grant insert, update on public.patient_group_members to authenticated;
