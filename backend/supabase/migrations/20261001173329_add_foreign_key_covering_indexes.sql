-- Cover every public foreign key with a valid, non-partial B-tree index.
-- Wider leading-column indexes also cover the corresponding single-column FK.
create index if not exists careloop_fk_activity_log_actor_id_idx on public.activity_log (actor_id);
create index if not exists careloop_fk_appointment_responses_appointment_id_idx on public.appointment_responses (appointment_id);
create index if not exists careloop_fk_appointment_responses_responded_by_idx on public.appointment_responses (responded_by);
create index if not exists careloop_fk_appointments_created_by_idx on public.appointments (created_by);
create index if not exists careloop_fk_appointments_doctor_id_idx on public.appointments (doctor_id);
create index if not exists careloop_fk_audit_events_actor_id_idx on public.audit_events (actor_id);
create index if not exists careloop_fk_audit_events_organisation_id_idx on public.audit_events (organisation_id);
create index if not exists careloop_fk_audit_events_patient_id_idx on public.audit_events (patient_id);
create index if not exists careloop_fk_care_journey_events_created_by_idx on public.care_journey_events (created_by);
create index if not exists careloop_fk_care_plans_created_by_idx on public.care_plans (created_by);
create index if not exists careloop_fk_care_plans_patient_id_idx on public.care_plans (patient_id);
create index if not exists careloop_fk_care_plans_responsible_profile_id_idx on public.care_plans (responsible_profile_id);
create index if not exists careloop_fk_care_team_memberships_profile_id_idx on public.care_team_memberships (profile_id);
create index if not exists careloop_fk_care_team_messages_sender_id_idx on public.care_team_messages (sender_id);
create index if not exists careloop_fk_care_teams_created_by_idx on public.care_teams (created_by);
create index if not exists careloop_fk_connection_consents_care_team_id_idx on public.connection_consents (care_team_id);
create index if not exists careloop_fk_connection_consents_consented_by_idx on public.connection_consents (consented_by);
create index if not exists careloop_fk_connection_consents_patient_id_idx on public.connection_consents (patient_id);
create index if not exists careloop_fk_connection_invitations_care_team_id_idx on public.connection_invitations (care_team_id);
create index if not exists careloop_fk_connection_invitations_created_by_idx on public.connection_invitations (created_by);
create index if not exists careloop_fk_connection_invitations_redeemed_by_idx on public.connection_invitations (redeemed_by);
create index if not exists careloop_fk_follow_up_events_appointment_id_idx on public.follow_up_events (appointment_id);
create index if not exists careloop_fk_follow_up_events_recorded_by_idx on public.follow_up_events (recorded_by);
create index if not exists careloop_fk_follow_up_task_events_actor_id_idx on public.follow_up_task_events (actor_id);
create index if not exists careloop_fk_follow_up_task_events_patient_id_idx on public.follow_up_task_events (patient_id);
create index if not exists careloop_fk_follow_up_task_events_task_id_patient_id_idx on public.follow_up_task_events (task_id, patient_id);
create index if not exists careloop_fk_follow_up_tasks_appointment_id_patient_id_idx on public.follow_up_tasks (appointment_id, patient_id);
create index if not exists careloop_fk_follow_up_tasks_closed_by_idx on public.follow_up_tasks (closed_by);
create index if not exists careloop_fk_medications_created_by_idx on public.medications (created_by);
create index if not exists careloop_fk_medications_patient_id_idx on public.medications (patient_id);
create index if not exists careloop_fk_notifications_patient_id_idx on public.notifications (patient_id);
create index if not exists careloop_fk_outbox_events_organisation_id_idx on public.outbox_events (organisation_id);
create index if not exists careloop_fk_patient_care_team_connections_care_team_id_idx on public.patient_care_team_connections (care_team_id);
create index if not exists careloop_fk_patient_care_team_connections_created_by_idx on public.patient_care_team_connections (created_by);
create index if not exists careloop_fk_patient_group_members_patient_id_idx on public.patient_group_members (patient_id);
create index if not exists careloop_fk_patient_groups_assigned_doctor_id_idx on public.patient_groups (assigned_doctor_id);
create index if not exists careloop_fk_patient_groups_assigned_staff_id_idx on public.patient_groups (assigned_staff_id);
create index if not exists careloop_fk_patient_groups_created_by_idx on public.patient_groups (created_by);
create index if not exists careloop_fk_patients_assigned_doctor_id_idx on public.patients (assigned_doctor_id);
create index if not exists careloop_fk_patients_assigned_staff_id_idx on public.patients (assigned_staff_id);
create index if not exists careloop_fk_profiles_organisation_id_idx on public.profiles (organisation_id);
create index if not exists careloop_fk_profiles_primary_care_team_id_idx on public.profiles (primary_care_team_id);
create index if not exists careloop_fk_reminders_appointment_id_idx on public.reminders (appointment_id);
create index if not exists careloop_fk_reminders_approved_by_idx on public.reminders (approved_by);
create index if not exists careloop_fk_reminders_created_by_idx on public.reminders (created_by);
create index if not exists careloop_fk_reminders_patient_id_idx on public.reminders (patient_id);
create index if not exists careloop_fk_reports_test_id_patient_id_idx on public.reports (test_id, patient_id);
create index if not exists careloop_fk_reports_uploaded_by_idx on public.reports (uploaded_by);
create index if not exists careloop_fk_staff_invitations_accepted_by_idx on public.staff_invitations (accepted_by);
create index if not exists careloop_fk_staff_invitations_care_team_id_idx on public.staff_invitations (care_team_id);
create index if not exists careloop_fk_staff_invitations_created_by_idx on public.staff_invitations (created_by);
create index if not exists careloop_fk_tests_created_by_idx on public.tests (created_by);
-- These references also need complete indexes: existing one-active/pending
-- partial unique indexes do not cover every row for referential checks.
create index if not exists careloop_fk_connection_invitations_patient_id_idx
  on public.connection_invitations (patient_id);
create index if not exists careloop_fk_follow_up_tasks_created_by_idx
  on public.follow_up_tasks (created_by);
create index if not exists careloop_fk_patient_care_team_connections_patient_id_idx
  on public.patient_care_team_connections (patient_id);
