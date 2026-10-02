# CareLoop Doctor

Care-team dashboard for patient follow-up, appointments, worklists, messaging, and reports.

## Run the local demo

Requirements: Node.js 20+ and npm.

1. Install dependencies: `npm ci`
2. Start the local demo API in one terminal: `npm run demo:api`
3. Start the dashboard in another terminal: `npm run dev`
4. Open the local URL printed by Vite.

The demo API stores generated demonstration state under `server/data/demo-state.json`; that local file is ignored by Git and is intentionally not part of this repository. Bundled patient examples and reports are synthetic demo content. This demo API is not a production patient-data service.

## Verify a production bundle

`npm run build`
