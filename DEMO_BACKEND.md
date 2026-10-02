# CareLoop connected demo

The doctor website and the iOS patient app now use the same small local demo API. The app is the patient-facing demo; the website no longer embeds a duplicate patient app view.

## Start it

1. In the CareLoop website folder, start the API: `npm run demo:api`.
2. In another terminal in the website folder, start the doctor site: `npm run dev`. Vite prints the local URL (often `http://localhost:5174` if port 5173 is busy).
3. In a terminal in `/Users/chipichipi/Documents/CareLoop Patient/CareLoopPatient`, run `npm run simulator`. The script boots the iPhone simulator, finds the Mac's current network address, and starts Expo in LAN mode.

Keep the API running while the website and simulator are in use. The patient simulator polls the API for changes about every 1.8 seconds. The doctor website also listens for API change events.

## Demo flow

1. Open Ramesh Kumar (`CL-1042`) in the doctor's patient worklist.
2. Choose **Create intervention**, enter a next action, and add it to the worklist.
3. The API stores the action for `CL-1042`; the same patient’s iOS app displays it in **CARE TEAM UPDATE**. Appointment changes and patient confirmations/reschedule requests use that same patient record.
4. Open **Messages** on the website or patient app. Text and image messages use the same patient-specific conversation; new messages appear on the other client through API polling and server-sent events. The Ramesh thread includes a shortcut to his coordination-summary PDF and call actions.
5. **Reset demo** restores the fictional sample patients, their initial next steps, and the starter message.

The API runs on port `4317` and persists fictional demo state, including messages and small image attachments, in `server/data/demo-state.json`. It listens on the Mac's local network interface so the iOS simulator can reach it; CORS is limited to the local Vite origins. It has no login/authentication and is intended only for a local demonstration with synthetic sample records; do not put real patient data into it or deploy it as a production backend.

## Implementation/security notes

- The API only accepts a fixed set of patient update fields, caps JSON bodies, and returns JSON with `nosniff` and `no-store` headers. The browser CORS allowlist contains only local Vite origins.
- Web production dependency audit: 0 vulnerabilities. The existing Expo app's production dependency audit reports 14 moderate transitive advisories in Expo/query-string and xcode/uuid chains; npm's suggested automatic fix would make breaking Expo version changes, so the current SDK versions were left intact for the simulator demo.
