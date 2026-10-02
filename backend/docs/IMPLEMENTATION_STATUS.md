# Backend implementation status

## Delivered in this worktree

| Area | Evidence |
|---|---|
| Tenancy and roles | `supabase/migrations/0001_careloop_backend.sql` organisation, team, membership, and profile tables |
| Patient connectivity | `patients.auth_user_id`, connection invitations, consent, active connection constraint, `redeem_connection_code` |
| Current app data contract | Patient, appointment, test, report, medication, care-plan, follow-up, group, and activity tables match the current Supabase client calls |
| Authorization | RLS enabled on every exposed domain table, helper functions, staff/patient policies, privilege-field triggers |
| Storage | Private `careloop-reports` bucket and patient-scoped object policies |
| Audit and delivery | Audit events, transactional outbox, notifications, journey events, reminders, appointment responses, secure messages, claim/complete/fail RPCs, and `process-outbox` function |
| Follow-up task queue | Staff-only queue with patient/appointment relation, explainable priority source, owner, status, optimistic concurrency, required closure evidence, append-only task events, idempotent creation, audit/outbox writes, and missed/overdue appointment task generation |
| Dashboard worklist contract | `list_follow_up_queue` returns an authorised, ordered staff worklist read model with patient identity, appointment context, priority, owner, status, and overdue state |
| QR connectivity contract | `create_connection_qr_invitation` returns an expiring opaque `carelooppatient://connect?...` payload; `redeem_connection_qr_payload` validates and redeems it; `get_patient_connectivity_snapshot` supports post-redemption refresh |
| External data ingestion boundary | Organisation-scoped source registry, import batches, and quarantined records for EMR/lab/spreadsheet/register/API adapters; connector credentials stay in project/Edge Function secrets |
| Notification channel contract | User-owned email/SMS/push endpoints plus provider-neutral delivery ledger; existing transactional outbox remains the source of delivery work |
| Automated checks | `npm test`: 30 passing contract/security/connectivity tests including generated type-name checks for each Patient-app table/RPC; `npm run test:integration`: passing SQL/RLS workflows including cross-organisation deny cases, org-admin self-promotion denial, guarded patient account/organisation fields, app-compatible group creation, invitation isolation, active-connection invitation denial, stale-code rejection after withdrawal, follow-up task idempotency/lifecycle/automatic creation and patient denial, no anon table grants, no authenticated truncate/delete grants, closed-by-default future table/function ACL probes, abandoned outbox-claim recovery/dead-lettering, catalog-verified index coverage for every public foreign key, plus live local phone OTP and authenticated PostgREST journeys; `supabase db lint --local`: passing; local security advisors: no issues; warning-level local performance advisor has no findings; all public FKs have covering indexes; `auth_rls_initplan` reduced from 9 to 0 and multiple-permissive-policy findings from 30 to 0; Edge Function strict TypeScript check: passing; outbox webhook destination policy rejects unapproved/non-TLS destinations and redirects |

## Remote deployment parity (verified 2026-10-01)

The remote Supabase project now contains the local backend migrations through `20261001175407_harden_helper_execution`. Verified remotely: the QR creator/redeemer, patient connectivity snapshot, Doctor dashboard queue function, external ingestion tables, notification delivery ledger, and notification endpoint functions exist; the new tables have RLS enabled; anonymous execution of the QR creator and authorization helper is denied; authenticated execution of the QR creator is granted. Remote security advisors no longer report anonymous access to the helper functions. The remaining authenticated SECURITY DEFINER notices correspond to intentional authenticated RPC APIs that enforce their own role, ownership, or input checks. Performance notices are informational unused-index findings on a newly deployed schema without production workload.

## Deployment gate

Remote deployment is complete for the configured Supabase production project (`careloop-patient`, ref `jkazbhhjrlrkvygfyvtr`). The remote migration history contains the base backend, ACL hardening, RLS/performance migrations, the patient connectivity and ingestion contract, and helper-execution hardening. All 32 public tables have RLS enabled, the private `careloop-reports` bucket exists, and `process-outbox` is active with JWT verification disabled because it uses its own worker token.

Production Auth URL configuration is set for the native Patient app: site URL `carelooppatient://auth/callback` and the same URL in the redirect allowlist. The Patient app's `.env.local` already points to the remote project URL and uses the publishable key.

Production provider/function secrets remain pending until real provider values are supplied. Phone Auth is still disabled because the production Twilio Account SID, Auth Token, and Message Service SID are not present. The outbox worker still needs `NOTIFICATION_WEBHOOK_URL`, `NOTIFICATION_WEBHOOK_ALLOWED_HOSTS`, and a generated `OUTBOX_WORKER_TOKEN`. The doctor dashboard calls the staff Supabase APIs for authentication, patients, appointments, reports, chat, invitations, and follow-up queue. The newer opaque QR-payload redemption/snapshot flow, external source adapters, and provider-specific notification delivery still require integration/configuration.

The CareLoop Doctor web dashboard is now included at the repository root and uses the authenticated Supabase staff client for its dashboard, patient, appointment, report, care-team messaging, connection invitation, and follow-up queue workflows. No demo records or local JSON API are part of that app. Provider-dependent SMS/email/push delivery remains unconfigured until real provider secrets are added to Supabase.

The new follow-up queue has been exercised locally over SQL/RLS and authenticated PostgREST: create retries return the same task, stale updates fail, closure requires a note, missed appointments create a high-priority explainable task, and patient sessions cannot read or mutate staff tasks. The schema and RPCs are now present in the remote project; remote end-to-end verification remains pending the real Auth and notification provider values.

Next production verification:

1. Choose email Auth or supply production Twilio values and enable the selected Auth provider.
2. Replace the legacy code-based dashboard QR invitation with `create_connection_qr_invitation`, wire patient redemption to `redeem_connection_qr_payload`, and refresh the patient app through `get_patient_connectivity_snapshot`. The dashboard already calls `list_follow_up_queue`.
3. Configure a notification adapter and set the outbox function secrets if external delivery is required.
4. Add an EMR/lab/spreadsheet/register adapter that writes import batches and quarantined records through a service role.
5. Run the Patient app's Auth, QR/manual connection, consent, appointment response, report access, notification, and sign-out journeys against the remote environment.

### Appointment write guard

Patient accounts cannot directly edit appointment scheduling or staff notes; they use the audited `respond_to_appointment` RPC. Staff scheduling remains permitted. A live baseline integration test reproduced the direct-write issue, and the fixed integration suite now passes this negative patient test plus the positive staff update path.

### Patient app connectivity and tenant relationship guards

The local SQL integration fixture now mirrors the Patient app's direct reschedule/update + follow-up insert sequence. Patient schedule updates generate response, journey, audit, and outbox records; patient edits to staff notes are denied. `patient_group_members` app-shaped inserts/upserts are constrained to accessible patients in the group's organisation. Care-team membership provisioning requires an active same-organisation profile with matching membership/profile roles. Negative fixtures prove cross-organisation patient-group membership and external-profile team membership are denied.

### Authenticated PostgREST and Storage connectivity

`npm run test:integration` now verifies actual authenticated HTTP calls, not only SQL-role fixtures. It creates local synthetic patient/staff Auth sessions, proves cross-patient reads are filtered and patient edits to staff notes return HTTP 403, replays patient appointment reschedule/follow-up calls, and runs the staff API workflow across the app's patient, appointment, test, medication, care-plan, follow-up, group, connection-invitation, private report upload, and signed-download paths. Message-content immutability and read-receipt behavior are included in the SQL integration checks.

### Connection invitation end-to-end

Direct Patient app invitation inserts now receive a server-generated `CL-` + 16-hex-character code (8 random bytes); the trigger stores the SHA-256 of that generated code, not the client value. The local REST test verifies the response and hash, then a separate OTP-authenticated patient redeems it, receives the linked patient row and consent, and withdraws the connection. Local-only OTP fixtures now cover the second synthetic phone account.

### Patient-group assignment roles

Group doctor/staff fields enforce matching active profile roles at the database trigger. Local integration rejects role swaps and inactive assignments; the authenticated staff REST workflow confirms a same-organisation active doctor assignment succeeds.

### Role changes and stale access

Patient authorization now revalidates the caller's current active role against the patient's doctor/staff assignment and the caller's care-team membership role. A role-change integration fixture proves stale staff assignment and membership do not retain patient access after the account becomes a doctor.

### Profile/team context integrity

Profile `primary_care_team_id` is constrained to a care team in the same organisation. A local integration regression confirms an organisation admin cannot assign a cross-organisation primary team to their profile.

### Active connection invitation lifecycle

Invitation creation through both the server RPC and the Patient app's direct PostgREST insert is denied while a patient has an active care-team connection. Patient-row locking serializes invitation issuance and redemption; if a competing/stale invitation still loses the one-active-connection insert, redemption raises an error so the consent, redeemed status, audit, and outbox writes roll back together. Local integration verifies both invitation-creation paths are denied after connection.

Reusing a previously redeemed code after the patient withdraws now returns an invalid-invitation response instead of a false successful patient link. Withdrawal and redemption use patient-first row locking; the authenticated REST integration reproduces withdrawal followed by stale-code redemption and verifies the API rejects it.

### Outbox interruption recovery

`claim_outbox_events` reclaims processing rows whose 10-minute claim lease expired, increments attempts on reclaim, and dead-letters an expired row after the retry limit. A real local Postgres integration ages synthetic claimed rows to simulate worker interruption, then verifies one is reclaimed and an exhausted one is dead-lettered.

Completion and failure RPCs now require the attempt number returned by the claim. A worker from an expired claim cannot complete or requeue an event after a newer worker has reclaimed it; local Postgres regression verifies both stale completion and stale failure return false without altering the newer claim. The Edge Function passes the attempt generation to both RPCs and was launched through Supabase's local Edge Runtime; method, authentication, and missing-configuration responses were exercised.

Outbox events now receive patient attribution separately from the aggregate ID, so appointment-response events retain their organisation ID instead of looking up a patient using an appointment UUID. Local SQL integration verifies both patient-triggered and RPC-generated appointment events are organisation-attributed.
