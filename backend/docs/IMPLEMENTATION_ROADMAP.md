# CareLoop Backend Implementation Roadmap

This roadmap is gated: each phase produces something reviewable before the next begins. The local backend baseline is now implemented in `supabase/migrations/0001_careloop_backend.sql`; production deployment still requires the gates below and does not alter either app.

## Phase 0 — Confirm the product boundary
**Tasks:** Confirm real Patient app, new Doctor dashboard, demo isolation, launch audience, first workflow, synthetic-data rule.
**Deliverables:** Approved system map, user roles, first-release acceptance criteria.
**Gate:** No unclear product ownership or demo/real-data boundary.

## Phase 1 — Decide identity and tenancy
**Tasks:** Define patient account linking, staff login, organisation/team structure, role matrix, account recovery, shared-phone/changed-phone behavior, patient-to-team cardinality.
**Deliverables:** Identity sequence diagrams and allow/deny permission matrix.
**Gate:** Each role’s access can be expressed as a testable rule.

## Phase 2 — Design workflows and domain records
**Tasks:** Specify invitation/consent lifecycle, follow-up event types, task ownership and closure, appointment response, notification content, withdrawal and transfer.
**Deliverables:** State diagrams, data dictionary, event ownership, API/function contracts.
**Gate:** No workflow relies on undocumented frontend-only state.

## Phase 3 — Create local backend foundation
**Tasks:** Initialize Supabase CLI project; establish local stack; define migration naming/review; create dev/staging/prod configuration boundaries; establish synthetic test fixtures.
**Deliverables:** Reproducible local database and clean migration replay.
**Gate:** Another developer can recreate the development schema from version control.

## Phase 4 — Implement database and authorization
**Tasks:** Create minimal schema, constraints, indexes, RLS grants/policies, protected function boundaries, audit/outbox foundations. Add positive and negative integration tests.
**Deliverables:** Schema contract, RLS matrix tests, threat-model review.
**Gate:** Cross-patient and cross-organisation access tests fail closed.

## Phase 5 — Implement identity and connection services
**Tasks:** Configure patient OTP and staff sign-in; implement staff membership provisioning; implement invitation issue/preview/accept/revoke with consent atomicity, token hashing, rate limits, and idempotency.
**Deliverables:** Tested service contracts and security-focused integration tests.
**Gate:** Invalid, expired, revoked, wrong-person, race, and retry tests pass.

## Phase 6 — Build the Doctor dashboard from scratch
**Tasks:** Establish app shell, staff session flow, organisation/team context, patient worklist, patient detail, invitation UI, follow-up queue, ownership/status changes.
**Deliverables:** Real dashboard against development backend; no fake success fallback.
**Gate:** UI cannot bypass RLS and uses role-scoped data.

## Phase 7 — Connect the existing Patient app
**Tasks:** Integrate approved auth/session flow and connection journey; then patient read models, appointment view/response, follow-up reminders/responses. Preserve unrelated frontend screens.
**Deliverables:** Patient app working against the same development Supabase project.
**Gate:** Complete two-app journey passes on real devices/test accounts.

## Phase 8 — Reliable notifications and realtime
**Tasks:** Implement transactional outbox processing, provider adapters, retries/backoff, delivery receipts, dead-letter/operator handling, minimal-content notifications, authorized realtime hints and refetch recovery.
**Deliverables:** Observable delivery pipeline and duplicate-safe consumers.
**Gate:** Provider outage/retry/reconnect tests do not lose or duplicate domain actions.

## Phase 9 — Production readiness
**Tasks:** Validate jurisdiction and hosting region, threat model, security advisor, load tests, query indexes, rate limits, secrets, backup restore, retention, monitoring, incident response, staged rollout and rollback.
**Deliverables:** Operational runbook, release evidence, and named owners.
**Gate:** Explicit go-live approval; a hackathon demo alone does not pass this gate.

## Build/test cadence for each phase

1. Agree on the smallest user-visible behavior.
2. Write authorization and failure-case tests first.
3. Implement only that behavior.
4. Test using synthetic accounts for patient, doctor, coordinator, admin, and denied callers.
5. Review migrations and security changes.
6. Demonstrate the complete workflow end to end.
7. Update the architecture decision record if a design choice changes.
