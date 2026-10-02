# CareLoop backend security review

**Security-sensitive:** yes
**Scope:** SQL migration, RLS, Auth triggers, invitation tokens, follow-up task lifecycle, private storage, and outbox worker
**Status:** static review complete; real Supabase integration review remains a deployment gate

## OWASP-oriented checks

| Category | Result | Evidence |
|---|---|---|
| Broken access control | PASS WITH NEGATIVE CROSS-ORG TESTS | RLS on every domain table; tenant-scoped org-admin policies; integration tests prove cross-organisation team, membership, profile, group, and connection-invitation isolation |
| Cryptographic failures | PASS with transition note | Staff tokens are stored as SHA-256 hashes; connection invitations retain a compatibility `code` column until client cutover and also store `code_hash` |
| Injection | PASS | SQL uses typed parameters and server-side functions; no user input is concatenated into SQL |
| Insecure design | PASS | Consent is atomic, one active connection is enforced, patient responses are guarded, demo data is not part of the migration |
| Security misconfiguration | PASS in code | Private report bucket, no service key in the mobile client, privileged outbox RPCs require `service_role`, worker endpoint requires `OUTBOX_WORKER_TOKEN` |
| Vulnerable components | PENDING | Run the Supabase CLI/dependency audit in the deployment environment |
| Authentication failures | PASS WITH PRIVILEGE-ESCALATION TESTS | Profile protection trigger is invoker-security; self-promotion is denied; patient account linking is available only through invitation redemption |
| Data integrity failures | PASS | Check constraints, foreign keys, idempotency key, transaction-scoped invitation redemption, outbox locking |
| Logging/monitoring failures | PASS in code | Audit events and activity log are provided; sensitive data is not placed in outbox payloads by the migration functions |
| SSRF | PENDING | The outbox webhook URL must be allowlisted in the deployment environment before enabling delivery |

### Tenant-boundary security review (2026-10-01)

**Security-sensitive:** yes — database RLS policies, tenant context, and invitation authorization.

| OWASP area | Status | Evidence |
|---|---|---|
| A01 Broken access control | FIXED | Org-admin `USING` and `WITH CHECK` clauses now scope teams, memberships, and profile updates to the caller organisation; patient-group mutations cannot change organisation; patient identity/account-link fields are protected; connection invitations require the team and patient to share an organisation. |
| A02 Sensitive data exposure | PASS | Cross-organisation fixtures prove team/member/profile rows are not exposed; no patient payload was added to logs. |
| A03 Injection | PASS | SQL statements remain typed and parameterized; identifiers use UUID columns. |
| A04 Insecure design | FIXED | `patient_groups` now fills omitted `organisation_id` from the signed-in user's profile, matching the existing Patient app create-group payload while rejecting cross-org assignments. |
| A05 Security misconfiguration | PASS | RLS remains enabled; policies are explicitly scoped and migrations are linted. |
| A06 Vulnerable components | NOT RECHECKED | No dependencies added; dependency audit remains a release check. |
| A07 Authentication failures | PASS | Staff actor identity is checked on legacy invitation inserts; patient OTP alone still creates only a pending profile. |
| A08 Data integrity | PASS | Integration tests cover group tenant context and invitation organisation invariants. |
| A09 Logging/monitoring | PASS WITH OPERATIONS GATE | Existing audit/outbox behavior remains; production alerts and operational response remain a release gate. |
| A10 SSRF | N/A FOR SQL CHANGE | Outbox-specific SSRF controls are documented in the preceding review section. |

The local Postgres integration test includes two organisations and asserts denied cross-org reads/writes, org-admin self-promotion denial, prevention of prelinked patient inserts and direct patient-link changes, and same-organisation assignment success before exercising the Patient app group-creation shape.

### Outbox worker security review (2026-10-01)

**Security-sensitive:** yes — server-side webhook request path.

| OWASP area | Status | Evidence |
|---|---|---|
| A01 Broken access control | PASS | Existing worker requires exact bearer token; new configuration is validated before an event batch is claimed. |
| A02 Sensitive data exposure | PASS | Provider request contains only the outbox event fields; service-role credentials are used only for internal RPCs. |
| A03 Injection | PASS | Fixed RPC names and JSON request bodies; webhook target is parsed as a URL and never interpolated into SQL. |
| A04 Insecure design | PASS | Delivery requires explicit exact-host configuration; invalid configuration leaves events unclaimed. |
| A05 Security misconfiguration | PASS WITH HOSTED CONFIG GATE | HTTPS/default port, no credentials/fragments/redirects; production allowlist and network egress must be configured. |
| A06 Vulnerable components | NOT RECHECKED | No dependencies were added; the repository-level dependency audit remains a release check. |
| A07 Authentication failures | PASS | Worker bearer-token requirement is unchanged; notification provider receives no worker credential. |
| A08 Data integrity | PASS | Existing claim/complete/fail RPC transaction flow remains intact; HTTP timeout bounds delivery attempts. |
| A09 Logging/monitoring | PASS WITH OPERATIONS GATE | Provider errors return status-only messages; hosted delivery, retry, and dead-letter alerts remain required. |
| A10 SSRF | FIXED IN CODE; NETWORK EGRESS STILL REQUIRED | Exact allowlist, public DNS hostname validation, HTTPS/default port only, IP/local host rejection, and redirect refusal. Restrict hosted egress to approved provider hosts. |

Tests cover allowlisted success and rejection of cleartext, unknown host, credentials, non-default port, fragments, wildcard, IP, and local/internal hostnames. They do not prove DNS resolution cannot be redirected to a private address; enforce outbound network policy in the hosted runtime as a second boundary.

## Required follow-up before production

- Remove the transition-compatible plaintext `connection_invitations.code` column after the Patient app uses `create_connection_invitation`.
- Configure the exact provider hostname in `NOTIFICATION_WEBHOOK_ALLOWED_HOSTS` and verify retry/dead-letter behavior in staging.
- Run negative RLS tests across organisations and patient accounts against real Supabase.

### Patient appointment write-path review (2026-10-01)

**Security-sensitive:** yes — patient RLS-compatible appointment mutation guard.

A live negative test found that a patient could directly change `scheduled_at` and staff `notes` on their own appointment, bypassing the audited appointment-response RPC. The trigger now rejects patient changes to appointment identity, scheduling, status, purpose, notes, creator, and creation timestamp; patient responses continue through `respond_to_appointment`, while staff scheduling updates remain allowed. Local integration tests cover both rejected patient writes and accepted staff scheduling writes.

### Patient-app contract and cross-tenant relationship review (2026-10-01)

Integration tests now replay the current Patient app's database write shapes: patient rescheduling through direct `appointments` update followed by `follow_up_events` insert, and staff `patient_group_members` upsert. The appointment guard permits only the app's confirmation/reschedule fields, creates response/journey/audit/outbox records for the update, and rejects patient edits to staff notes. Care-team memberships now require an active profile whose organisation and role match the team membership; group members must be accessible to the caller and share the group's organisation. Baseline tests reproduced all three failures before the guard changes.

### Message integrity and actual API-path verification (2026-10-01)

Care-team message UPDATE is now limited to the read receipt: IDs, patient, sender, body, and creation time are immutable after send. Local PostgREST smoke checks use actual patient OTP and staff password sessions to exercise authenticated reads/writes, patient isolation, appointment rescheduling, follow-up insertion, staff patient/appointment/test/medication/care-plan/group/invitation creation, private report upload, and signed report URL generation. The service-role token is confined to local synthetic fixture setup and is not returned to either application.

### Connection-code entropy review (2026-10-01)

The existing staff client still posts a client-generated connection code directly to PostgREST. The insert trigger now replaces authenticated-client values with a database-generated 8-byte random code, hashes that exact code for redemption, and returns the generated value in the app's existing insert response. The server invitation RPC uses the same 64-bit format. The local PostgREST workflow verifies the code substitution, hash agreement, redemption into a new authenticated patient session, consent creation, and patient withdrawal. This preserves the current app contract while removing its weak client-side code as the redemption secret.

### Patient-group assignment integrity review (2026-10-01)

`patient_groups.assigned_doctor_id` and `assigned_staff_id` now validate assignment semantics, not just organisation equality: doctors must be active `doctor` profiles; staff assignees must be active `staff` or `care_coordinator` profiles. SQL regression cases reject a staff profile assigned as doctor, a doctor assigned as staff, and an inactive assignee. The real staff PostgREST smoke also creates a group with its active doctor assigned.

### Role-change stale authorization review (2026-10-01)

`can_access_patient()` now requires an active doctor profile for `assigned_doctor_id`, an active staff/care-coordinator profile for `assigned_staff_id`, and a care-team membership role matching the current profile role. The direct patient-row RLS policy applies the same assignment-role checks. A live integration regression changes an assigned staff profile to doctor after a patient connection exists and proves both the helper and direct patient read deny access through the stale assignment/membership.

### Profile care-team context review (2026-10-01)

Profile updates now reject a `primary_care_team_id` outside the profile's organisation. The check applies to self-service and organisation-admin profile updates before privilege-field branches return. Local RLS integration reproduces and denies an org admin assigning their own profile to another organisation's team.

### Active connection and invitation lifecycle review (2026-10-01)

A reproduced regression showed that an already connected patient could be issued another care-team invitation. Invitation issuance now serializes on the patient row and rejects active connections in both the RPC and the compatibility insert trigger. Redemption uses the same patient-first lock order and raises if the unique active-connection insert loses, which rolls back the consent, invitation state, audit, and outbox changes atomically. The local SQL integration test proves the RPC and legacy PostgREST insert are denied after connection; 20 static contract/security tests pass. Remote deployment remains unverified.

The authenticated REST journey also now verifies that an already-redeemed code cannot report success after the patient withdraws. Baseline reproduction returned HTTP 200 with the linked patient ID after withdrawal; the corrected function requires a still-active matching connection and consent, and returns HTTP 400 otherwise. Withdrawal takes the patient-row lock before rechecking/updating the connection so withdrawal and idempotent redemption serialize consistently.

### Outbox worker interruption review (2026-10-01)

Baseline SQL integration left a claimed event permanently in `processing`: re-claiming after aging `claimed_at` returned zero rows and `attempts` remained 1. The claim RPC now recovers leases older than 10 minutes, indexes processing lease timestamps, and moves expired events with exhausted attempts to `dead_letter`. Real local Postgres integration verifies both recovery and terminal dead-letter behavior; remote worker timing/operations remain to be verified in staging.

The fencing review reproduced an old worker finalizing an event after a newer worker reclaimed it. Complete/fail RPCs now require the attempt generation returned by claim and return `false` for a stale generation; local Postgres verifies stale success and failure callbacks cannot mutate the current attempt. The Edge Function passes that generation on both callbacks and reports stale claims separately.

The worker's missing-secret path now returns a structured JSON 500 instead of an unhandled runtime error. Supabase's local Edge Runtime compiled/served the changed worker; live requests verified method rejection (405), absent/wrong worker token (401), and missing provider allowlist configuration (JSON 500). Provider delivery and real hosted secrets remain staging gates.

### Outbox tenant attribution review (2026-10-01)

Baseline integration found that appointment-response events used an appointment UUID to look up `patients.id`, leaving `outbox_events.organisation_id` null. The enqueue function now requires a separate patient-attribution UUID, validates that it exists, and uses it to derive the tenant. Local PostgreSQL verifies both appointment-response write paths retain the patient's organisation.

### Follow-up task lifecycle review (2026-10-01)

The new staff queue exposes task and event rows as read-only to authenticated callers; mutations go through narrow `SECURITY DEFINER` RPCs that revalidate current staff access to the patient and any assigned owner. Creation is idempotent and writes the task, event, audit, and outbox record in one transaction. Updates lock the row and require the observed `updated_at`, enforce a finite state machine, and require closure evidence. Appointment-missed/overdue generation runs transactionally and uses deterministic request keys. Local SQL and authenticated PostgREST tests prove idempotent retry, stale-write rejection, required closure note, generated task attribution, patient read denial, and patient write denial. The follow-up queue schema/RPCs exist in the earlier production baseline, but this lifecycle is only locally verified; recent local hardening migrations are not yet on the remote project and production-auth end-to-end behavior remains unverified.

### Public Data API grant hardening review (2026-10-01)

**Security-sensitive:** yes — exposed-schema table/function privileges and future-object defaults.

The local Supabase `postgres` default ACL initially granted `anon` and `authenticated` broad table access, including `TRUNCATE`, and granted future functions to `PUBLIC`. RLS does not govern `TRUNCATE`, so relying on policies alone was insufficient. The additive migration revokes all current table/sequence ACLs from `anon` and `authenticated`, restores only the Patient app's explicit CRUD/select allowlist, removes direct `DELETE`/`TRUNCATE`/`REFERENCES`/`TRIGGER` access, and configures future public tables/sequences/functions closed by default. A global `PUBLIC` function-execute default is revoked at the global role level because a schema-scoped REVOKE cannot cancel it. Real local Postgres probes test current relations and create/drop a future-table and future-function probe; the authenticated REST workflow still passes. Supabase security advisors report no issues. No remote database was changed.

### RLS request-identity performance review (2026-10-01)

The Supabase performance advisor identified nine policies that re-evaluated `auth.uid()` or the current-patient identity lookup per row. The additive migration uses statement-level scalar subqueries for those identity values without changing the allow/deny predicates. The existing local cross-tenant, patient-role, appointment, follow-up and message RLS/PostgREST integration cases still pass. The advisor count changed from 9 `auth_rls_initplan` warnings to 0; security advisors remain clean. The follow-up RLS policy consolidation splits broad `FOR ALL` admin/staff policies into command-specific write policies and combines the two appointment, profile, and follow-up insert access branches with explicit OR predicates. This preserves the intended authorization sets and avoids turning a SELECT policy into a write grant. The local integration journey still passes; the warning-level performance advisor now reports no findings (the 30 multiple-permissive-policy duplicates are also cleared).

### Foreign-key query/delete performance review (2026-10-01)

The local informational performance advisor identified 53 missing foreign-key indexes. The additive migration supplies complete B-tree indexes for those references and three more found by an independent `pg_constraint`/`pg_index` catalog assertion; composite keys receive indexes in the constraint's column order, and full indexes cover references that had only partial unique indexes. One wider `reports(test_id, patient_id)` index covers both its composite FK and its single-column `test_id` FK. The post-reset integration check requires every public FK to have a valid, ready, non-partial B-tree index with the FK columns as leading key columns. The index migration and full local integration suite pass. Existing `unused_index` informational results come from the local test database's tiny synthetic workload and are not treated as production workload evidence.
