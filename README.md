# CareLoop Doctor

Care-team web dashboard for patient follow-up, appointments, care teams, tests and reports, medications, care plans, QR-based patient connection, and staff/patient messaging.

## Run the dashboard

Requirements: Node.js 20+ and npm.

1. Copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Supabase project settings. Use only the publishable/anon client key; never put a service-role key in this app.
3. Install with `npm ci`.
4. Run `npm run web` and open the `/staff` route. The root route opens the dashboard; signed-out users are directed to staff sign-in.

The dashboard uses the Supabase client and authenticated staff workflows. It does not contain demo users, seeded patient examples, fake browser storage, or a local JSON API. Data shown comes from the configured Supabase project and its row-level security policies.

## Backend

The `backend/` directory contains the Supabase migrations, Edge Function, generated database types, and contract/integration tests. See [`backend/README.md`](backend/README.md) and [`backend/docs/IMPLEMENTATION_STATUS.md`](backend/docs/IMPLEMENTATION_STATUS.md).

Run backend contract tests with `cd backend && npm test`. Local database integration tests require the Supabase CLI and Docker; follow `backend/README.md` before resetting a local database. Production notification delivery and phone OTP require provider secrets configured in Supabase; those secrets are intentionally not committed.

## Security

RLS is the authorization boundary. The frontend uses only the public publishable key. Do not commit `.env` files, credentials, patient data, service-role keys, or local Supabase state.
