# CareLoop Backend

This directory contains the Supabase/PostgreSQL backend for the CareLoop Patient app and the CareLoop Doctor dashboard in the repository root.

## Implemented backend

- `supabase/migrations/0001_careloop_backend.sql`
  - Organisation and care-team tenancy.
  - Patient identity linking and one active care-team connection per patient.
  - Staff profiles, memberships, and invitation acceptance.
  - App-compatible patient, appointment, test, report, medication, care-plan, follow-up, group, activity, and notification tables, plus journey events, reminders, appointment responses, and secure messages.
  - PostgreSQL constraints, indexes, updated-at triggers, authorization helper functions, and RLS policies.
  - Atomic connection-code redemption, staff invitations, appointment responses, connection withdrawal, audit writes, and transactional outbox writes.
  - Staff-only follow-up queue with idempotent task creation, optimistic-concurrency updates, audited status history, and automatic tasks for missed/overdue appointments.
  - Private `careloop-reports` storage bucket policies.
- `supabase/migrations/0002_careloop_public_defaults.sql` establishes closed-by-default Data API grants; the dated ACL hardening migration restores only the client-required grants. Future public tables/functions remain closed until explicitly granted.
- The dated RLS optimization migrations cache request identity per statement and consolidate overlapping policies without broadening write predicates.
- `20261001173329_add_foreign_key_covering_indexes.sql` adds leading-column B-tree coverage for public foreign keys, including composite keys and references not covered by partial indexes.
- `supabase/types/database.types.ts` is generated from the local schema and contract-tested against every table and RPC used by the current Patient app. Regenerate it after migrations with `npm run gen:types`.
- `supabase/functions/process-outbox/index.ts`
  - Claims outbox work with row locking.
  - Delivers through the configured notification webhook.
  - Completes successful work and retries failures with a dead-letter threshold.

## Dashboard and connectivity contracts

The doctor dashboard in the repository root now uses the Supabase-backed staff adapter for authentication, patient and appointment records, reports/storage, care-team chat, connection invitations, and the follow-up queue. The connection QR is generated from the server-created invitation code. The patient app redeems that invitation through the backend's consent/connection transaction.

- `create_connection_qr_invitation` creates a short-lived opaque mobile deep-link payload; it never places patient details in the QR value.
- `redeem_connection_qr_payload` validates and redeems the payload through the existing consent/connection transaction.
- `get_patient_connectivity_snapshot` returns the authenticated patient's active connection state for refresh after redemption.
- `list_follow_up_queue` provides the authorised Doctor dashboard worklist read model.
- `external_data_sources`, `external_import_batches`, and `external_import_records` define a quarantined ingestion boundary for EMR, lab, spreadsheet, register, and API adapters.
- `notification_endpoints` and `notification_deliveries` define provider-neutral email/SMS/push delivery state while credentials remain in project secrets.

- `supabase/config.toml`
  - Local Supabase service configuration and function settings.

## Patient app connectivity contract

The migration matches the current app calls in `CareLoop Patient/CareLoopPatient/src/lib/`:

- `profiles`, `patients`, `appointments`, `tests`, `reports`, `medications`, `care_plans`, `follow_up_events`, `patient_groups`, `patient_group_members`, and `activity_log` are available through the Supabase client.
- `redeem_connection_code`, `create_staff_invitation`, and `accept_staff_invitation` match the existing RPC names.
- `create_follow_up_task` and `update_follow_up_task` provide the planned staff follow-up workflow; table reads are RLS-scoped and client writes are restricted to these RPCs.
- Existing direct invitation creation remains transition-compatible; new server-created invitations use the hashed code path.
- Report files use the private `careloop-reports` bucket and patient-scoped paths.
- Patient access is limited to the linked patient record; staff access is limited by organisation, assignment, or active team membership.

## Apply locally

From this directory, with the Supabase CLI installed:

```sh
supabase start
supabase db reset
npm test
npm run test:integration
```

The migration is the source of truth. Do not apply it to a shared or production project until the local database and RLS integration checks pass.

## Deploy after approval

```sh
supabase login
supabase link --project-ref <SUPABASE_PROJECT_REF>
supabase db push
supabase functions deploy process-outbox --no-verify-jwt
supabase secrets set NOTIFICATION_WEBHOOK_URL=... OUTBOX_WORKER_TOKEN=...
```

The configured production project is `careloop-patient` (`jkazbhhjrlrkvygfyvtr`). The backend migration, public-default ACL hardening, and `process-outbox` Edge Function are deployed there. The native Auth site URL and redirect allowlist contain `carelooppatient://auth/callback`; provider and notification secrets still need the real production values below.

## Required function secrets

The outbox function needs:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (function runtime only; never in either app)
- `NOTIFICATION_WEBHOOK_URL`
- `OUTBOX_WORKER_TOKEN` (caller authorization for the public scheduler endpoint)
- `NOTIFICATION_WEBHOOK_ALLOWED_HOSTS` (comma-separated exact public provider hostnames; the worker requires HTTPS, default port, and rejects redirects)

Phone Auth additionally requires the production Twilio Account SID, Auth Token, and Message Service SID in Authentication → Sign In / Providers. These values are not stored in the repository.

The mobile app continues to use only its public Supabase key.

## Verification status

`npm test` runs the backend contract suite in `tests/`. `npm run test:integration` resets the local Supabase database, applies the migration, runs synthetic Auth/RLS/workflow/outbox checks against real Postgres, then requests and verifies local phone OTP through GoTrue and checks that the auth trigger creates a `pending` profile. The local test OTP and placeholder SMS provider are development fixtures; hosted environments need real provider configuration.

Architecture and phased delivery details remain in `docs/TARGET_ARCHITECTURE.md` and `docs/IMPLEMENTATION_ROADMAP.md`.
