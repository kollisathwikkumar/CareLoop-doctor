# CareLoop Doctor

Care-team dashboard for patient follow-up, appointments, worklists, messaging, and reports.

## Local development

Requirements: Node.js 20+ and npm.

1. Install dependencies with `npm ci`.
2. Start the local API with `npm run api`.
3. In another terminal, start the dashboard with `npm run dev`.
4. Open the local URL printed by Vite.

The dashboard and API start with empty patient, care-team, message, and report lists. Records appear only after they are entered or returned by the connected API. Old demo browser storage is not read. Local API state is stored in `server/data/live-state.json` and is not committed.

The included local API is a development integration bridge; it has no authentication or production-grade patient-data safeguards. Do not deploy it or use it for real patient records.

## Production build

Run `npm run build`.
