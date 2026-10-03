# CareLoop Doctor

CareLoop Doctor is the web workspace for doctors and care teams. It brings patient follow-up work into one place so staff can see what needs attention and coordinate the next step. The dashboard is built with Expo Router and React Native Web; it is not a separate demo website.

## What is included

- **Overview:** patient and follow-up summaries, continuity measures calculated from recorded CareLoop activity, and the follow-up queue.
- **Patients:** patient directory, records, care-team assignment, and patient detail views.
- **Appointments:** schedule and track appointments and follow-up visits.
- **Care teams and messages:** coordinate staff work and communicate with connected patients.
- **Tests and reports:** record investigations and associate uploaded report files with the correct test.
- **Medications and care plans:** keep the patient's recorded treatment and review plan together.
- **Patient connection:** create QR invitations that the patient app can redeem.
- **Data workflows:** backend contracts for importing external records are present, but direct EMR, laboratory, registry, and spreadsheet adapters still need to be implemented and configured.

The application reads and writes records through the configured Supabase project and authenticated workflows. It does not ship seeded patient examples, demo accounts, or a local JSON data backend. An empty workspace means there are no matching records in that project or the signed-in staff member does not have access under its policies.

## Run the staff dashboard

Requirements: Node.js 20+ and npm.

1. Copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the CareLoop Supabase project values. Configure the same project for the patient app.
3. Install packages: `npm ci`.
4. Start the web app: `npm run web` and open the staff dashboard. The root route opens the dashboard; signed-out users are sent to staff sign-in.

For a device or simulator, run `npm start`, then select a platform in Expo. `npm run build` exports the web app; it needs the public Supabase environment variables at build time.

## Supabase backend

The `backend/` directory contains the database migrations, generated types, Edge Functions, and backend tests. Start with [`backend/README.md`](backend/README.md) and review [`backend/docs/IMPLEMENTATION_STATUS.md`](backend/docs/IMPLEMENTATION_STATUS.md) for implemented workflows and outstanding integration work.

Useful checks:

```sh
npm test
npm run typecheck
npm run lint
cd backend && npm test
```

Local database integration tests require the Supabase CLI and Docker. Follow the backend guide and run integration tests against a local database, not production.

## Integrations currently on hold

The app and backend include notification workflow/outbox contracts, but production SMS delivery and phone OTP need provider accounts and secrets. Those paid-provider integrations are intentionally not enabled or represented as working. Configure them only when the team is ready. External hospital-system adapters are also future integration work; the current import boundary alone does not connect an EMR or lab system.

## Configuration and security

The frontend uses only the Supabase publishable (or legacy anon) key. Never put a service-role key in the app or commit `.env` files, credentials, real patient data, or local Supabase state. Supabase Row Level Security (RLS) is part of the authorization boundary; deploy the documented migrations and policies before connecting real users.
