# Local backend testing evidence

## Environment

- Supabase CLI: `2.119.0`
- Local runtime: Colima Docker
- Postgres: Supabase local container
- Migrations: all checked-in SQL migrations through `20261001173329_add_foreign_key_covering_indexes.sql`

## Commands and results

```text
npm test
27 tests passed, 0 failed

npm run test:integration
supabase db reset --no-seed
Applying migration 0001_careloop_backend.sql...
integration_pass
phone_otp_request=PASS
phone_otp_verification=PASS
auth_profile_trigger_and_pending_role=PASS
patient_postgrest_contract=PASS
staff_postgrest_workflow=PASS
connection_invitation_e2e=PASS
follow_up_task_api_lifecycle_and_auto_creation=PASS
exit status = 0

supabase db lint --local
No schema errors found
exit status = 0
```

The integration run executes against the local Supabase/Postgres stack. SQL fixtures verify staff invitation acceptance, cross-organisation denial for teams, memberships, profiles, groups and connection invitations; org-admin self-promotion denial; prevention of prelinked patient creation and direct account/org reassignment; valid same-org allocation; Patient-app-shaped group creation and patient creation, invitation redemption and idempotent retry, consent, one active connection, patient-scoped reads, appointment response guards, journey events, and transactional outbox claiming/completion. The Auth API smoke test calls the same phone OTP request and SMS verification endpoints used by the Patient app, then confirms the Auth user receives exactly one `pending` profile and no staff privilege merely by verifying a phone number. Unit tests also validate the outbox webhook hostname allowlist and reject unsafe URL forms.

The Patient API contract tests scan all `.ts`/`.tsx` files under the sibling Patient app's `src` directory and confirm that generated backend types include every discovered table and RPC. Regenerate the types from the local schema with `npm run gen:types` after changing migrations. If the app lives elsewhere, set `CARELOOP_PATIENT_SRC` to that `src` path before running `npm test`.

`auth.sms.test_otp` and the placeholder Twilio provider in the local-only `supabase/config.toml` are test fixtures. Configure real provider credentials and approved auth settings separately in each hosted environment; do not use the local placeholder provider in production.

The appointment security regression test confirms patient attempts to directly edit appointment time or staff notes are denied, while the preceding staff scheduling update remains allowed. Patient responses still pass through `respond_to_appointment`.

Additional negative checks prove an organisation admin cannot attach an external-organisation profile to a local care team, and a staff member cannot add an inaccessible or cross-organisation patient to a group. Positive fixtures preserve the Patient app's direct appointment-reschedule plus follow-up insertion and group membership write shapes; the schedule mutation is recorded in the response, journey, audit, and outbox tables.

The integration runner additionally performs authenticated PostgREST and Storage calls using local synthetic accounts. It validates patient-only reads, cross-patient filtering, denied patient staff-note edits, appointment reschedule auditing, patient follow-up inserts, staff CRUD shapes, private PDF report upload, and signed report access. It also verifies that a redeemed invitation code is rejected after the patient withdraws the connection. The local service-role key is used only to seed synthetic records in the smoke test.

The invitation PostgREST check confirms the backend replaces the short client-provided code with a random server-issued code, stores the matching hash, and returns the generated code. A second synthetic OTP user redeems the invitation, reads their linked record and consent, then withdraws the connection. The local-only Auth test fixture includes a dedicated OTP for that second synthetic phone account.

Patient-group regression fixtures reject staff-as-doctor, doctor-as-staff, and inactive-profile assignments. The authenticated staff PostgREST test confirms a valid active doctor assignment succeeds.

The RLS suite changes an assigned staff profile to doctor while a connection and old staff membership still exist, then verifies the stale assignment/membership no longer grants `can_access_patient` or a direct patient row.

The integration SQL checks PostgreSQL catalogs after migration replay and fails if any public foreign key lacks a valid, ready, non-partial B-tree index whose leading key columns cover the foreign key. This catches missing single-column and composite indexes in the real local database rather than relying only on migration text.

Profile update tests also attempt to assign an organisation admin's `primary_care_team_id` to a foreign organisation and verify the update is rejected.

The outbox integration seeds synthetic events, claims them, ages `claimed_at` to simulate worker interruption, and verifies that a fresh claim recovers one while an exhausted event transitions to `dead_letter`. It then submits completion and failure for the stale attempt and confirms both return false while the newer attempt remains processing; completion with the current attempt succeeds. The recovery window is 10 minutes. The local Edge Runtime also compiled and served `process-outbox`; GET, missing/incorrect worker token, and missing provider configuration returned the expected 405, 401, and JSON 500 responses.

Appointment response outbox events are checked for the correct organisation attribution when the aggregate ID is an appointment rather than a patient.

### Staff follow-up task queue

The SQL/RLS fixture and authenticated REST journey create and replay a task using the same idempotency key and assert a single task/creation event. They advance `open → in_progress → completed`, verify stale timestamps fail with SQLSTATE `40001`, require a closure note, and verify actor/time/note plus event history. A missed appointment creates one assigned high-priority task with `priority_source=appointment_missed`. Patient sessions see no task rows and cannot create or mutate staff tasks. This lifecycle test is local-only. The follow-up schema/RPC exists in the earlier production baseline, but recent local RLS/index migrations are not yet on the remote project and production-auth end-to-end behavior remains unverified.

### Data API grants and default ACLs

Fresh local migration replay verifies `anon` has no table privileges, `authenticated` has no direct `DELETE`/`TRUNCATE`/`REFERENCES`/`TRIGGER` privileges, and required Patient app operations still have explicit grants (including invitation inserts and group-member upserts). A temporary table and function created by the migration test prove new public objects do not inherit Data API table access or function execution. `supabase db advisors --local --type security --level info` reports no issues.

### RLS policy overlap and request-identity evaluation

The latest migration wraps `auth.uid()` and patient-identity lookups in scalar subqueries on the nine policies flagged by Supabase's `auth_rls_initplan` advisor. SQL contract checks assert the rewrites; the fresh local SQL/RLS and authenticated API journeys pass unchanged. `supabase db advisors --local --type performance --level warn` now reports `auth_rls_initplan=0` (down from 9). An additive policy consolidation also reduces multiple-permissive-policy advisor findings from 30 to 0 while preserving the separate read and write predicates; local integration verifies the unchanged patient and staff workflows. A catalog-backed assertion verifies full B-tree coverage for every public foreign key. The warning-level performance advisor reports no findings.
