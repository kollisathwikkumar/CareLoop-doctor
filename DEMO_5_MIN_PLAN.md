# CareLoop — full 5-minute demo plan

## Outcome and audience story

Show one complete continuity-of-care loop across the **doctor website** and the **real CareLoop iOS app in Simulator**:

**Spot a patient falling behind → review a unified last-known-care view → assign an intervention → show it in that patient's app → capture the patient's response → show the response back on that patient's doctor record.**

The through-line is **CL-1042 · Ramesh Kumar · Diabetes care**. This is a fictional demonstration record. Present the app and doctor website as two separate product surfaces connected by the demo API. Do not show an embedded patient preview, login screen, desktop, other apps, recording controls, or unrelated browser tabs.

## Five-minute, narration-paced run of show

| Time | Duration | Product shot and exact action | Narration |
|---|---:|---|---|
| 0:00–0:15 | 15s | **Website — Care team overview.** Begin on the overview with its title, priority counts, unified-coordination summary, and worklist visible. Keep the cursor still for the opening beat. | “CareLoop helps care teams keep people connected to care. The challenge is not just a missed appointment; it is seeing who is falling behind and coordinating the next useful action.” |
| 0:15–0:40 | 25s | **Website — Overview/worklist.** Slowly reveal the prioritized worklist: priority reason, days since activity, next expected review, owner, and response. Briefly point to high-priority Ramesh and the unassigned overdue patient. | “The overview turns follow-up gaps into a practical worklist. The team can see why a patient needs attention, how long it has been since activity, when the next review is due, and who owns the work.” |
| 0:40–1:00 | 20s | **Website — Priority worklist.** Open the full worklist; pause on high, medium, and on-track examples to demonstrate transparent prioritization rather than a black-box score. | “Prioritization is a workflow cue based on recorded follow-up activity—not a clinical prediction. That helps staff focus effort while keeping the reason visible.” |
| 1:00–1:30 | 30s | **Website — Ramesh patient record.** Open **Ramesh Kumar · CL-1042** by selecting the patient. Keep name and ID visible. Point to care program, last activity, overdue next review, assignment, response, and next action. | “For Ramesh, the record shows the diabetes program, the last known activity, the review that is due, the assigned doctor, and the next action. The patient ID keeps the update attached to the right person.” |
| 1:30–1:55 | 25s | **Website — Unified last-known activity.** Move through the representative appointment, investigation/lab, treatment milestone, and previous-contact entries. Pause on their demo-source labels. | “The coordination view brings representative appointment, investigation, treatment, and contact information together. In this demo these are sample records, not live hospital-system integrations.” |
| 1:55–2:10 | 15s | **Website — Patient report.** Show the synthetic report panel and PDF preview briefly; keep the fictional-demo label visible. | “The team can also review the patient’s associated demonstration report without leaving the follow-up context.” |
| 2:10–2:35 | 25s | **Website — Create intervention.** Use **Create intervention** and enter a concise next step such as **‘Call Ramesh to confirm diabetes review’**; assign the existing care-team owner and save. Show the new action on CL-1042. | “The doctor records a concrete follow-up action and assigns an owner. CareLoop saves it against Ramesh’s record so the team and patient app can stay in sync.” |
| 2:35–3:00 | 25s | **iOS Simulator — Patient Home.** Cut to the actual app, not a website mockup. Show **Ramesh / CL-1042**, the appointment, and the updated **Care Team Update**. Hold long enough to read the action. | “Now we switch to the real patient app in the iOS Simulator. The same patient sees the next step from the doctor website in their Care Team Update.” |
| 3:00–3:25 | 25s | **iOS Simulator — Patient response.** Use **Request reschedule**; choose one offered date/time and submit. Show the request confirmation. If the demo flow is configured for attendance confirmation instead, use **I’ll attend** and keep the narration aligned with the visible response. | “The patient can respond from the app. Here, Ramesh requests a new time; the response is sent for the care team to review.” |
| 3:25–3:55 | 30s | **Website — Return to CL-1042.** Show the matching response/status and updated appointment or next action on Ramesh’s record. Pause on the same patient name and ID to make the relationship unmistakable. | “Back on the doctor website, the response appears on the same CL-1042 record. The team can see what the patient did and determine the next step without searching across separate screens.” |
| 3:55–4:20 | 25s | **Website — Team actions.** Open Team actions. Show owner, due state, patient association, and action status; briefly demonstrate assignment or marking an action as contacted only if it is cleanly reversible in the demo. | “Team actions make ownership and progress visible. Staff can coordinate the work, record contact, and keep overdue follow-up from disappearing into an inbox.” |
| 4:20–4:40 | 20s | **Website — Patients/search.** Open Patients, use search or the patient list, and return to Ramesh’s record. Briefly show that the record is selected by patient identity. | “The patient list gives the team a direct route to each patient’s coordination record and current follow-up context.” |
| 4:40–5:00 | 20s | **Closing sequence.** End on Ramesh’s doctor record with the action and response visible; insert a short final iOS app shot if the edit can cut cleanly. Finish on the CareLoop product UI. | “CareLoop closes the loop: teams identify follow-up gaps, coordinate an intervention, patients receive a clear next step, and their response returns to the care team.” |

## Capture/edit recipe

1. Reset demo data before the take and verify the doctor site says **Demo backend connected** and **iOS app sync on**.
2. Record only the Chrome window containing CareLoop for website scenes and only the **iPhone 18 Pro Simulator window** for patient scenes. Use separate clips; do not capture the full desktop.
3. Capture in scene order where practical: overview/worklist, Ramesh record/report/intervention, iOS update/response, doctor response/team actions, patient list, ending shot.
4. Use calm pointer movement; pause 1–2 seconds after navigation and after every saved state change. Avoid rapid scrolling, accidental hover menus, and browser/Simulator switching during a clip.
5. In the edit, order clips to the table, trim dead time, and use simple cuts or short dissolves. Add readable captions and narration timed to each scene. Keep the on-screen patient ID visible at the two handoff points.
6. Export **1920×1080, 16:9, H.264 MP4**, with narration clear above any interface audio. Target exactly 5:00; let the narration determine scene duration and use brief silent holds to reach the target.
7. Reset demo data after recording so the next presentation starts clean.

## Capturia camera choreography

Use screen-space motion (cursor-led Smart Zoom), not a webcam or physical camera. Keep the frame on the active product window. In Capturia, choose **Window** capture and select **Google Chrome / CareLoop** for website clips and **iPhone 18 Pro** for app clips. Do not choose **Entire screen**, Mission Control, or a desktop preview. Turn **Disable auto-zoom after recording** off so zoom beats are retained; leave webcam and microphone off during capture and add narration/captions in editing.

| Beat | Framing / movement | Hold / transition |
|---|---|---|
| Overview opening | Start wide on the CareLoop overview; move the cursor slowly from the page title to the priority summary, then ease toward the worklist. | Hold the opening frame 2 seconds; no zoom until the first statistic. |
| Worklist | Smart Zoom to the patient/priority columns; pan down one row at a time to Ramesh, then briefly to the overdue unassigned example. | Pause 1 second per row; zoom back to a medium-wide view before opening the record. |
| Patient record | Click Ramesh; zoom gently into the name and CL-1042, then pan across next review, owner, response, and next action. | Hold each key value 1–2 seconds; avoid fast sweeping cursor moves. |
| Fragmented activity / report | Pull back to show the unified-activity heading, then make one measured downward pan through appointment, investigation, milestone, contact, and report. | Pause at the demo-source label and synthetic-report label; cut rather than scroll rapidly. |
| Intervention entry | Zoom to the action form; guide cursor through action, owner, and Save. After save, hold on the updated action. | Let the save confirmation finish; do not zoom during typing. |
| Patient app | Hard cut to the iPhone 18 Pro window. Start wide on the app Home screen; slow zoom to the Care Team Update and patient identity. | Hold on the new action; cursor motion is not needed in the simulator capture. |
| Patient response | Zoom to the response controls, select the planned response, then hold on the confirmation state. | Keep the confirmation visible for 2 seconds before cutting back. |
| Closed loop | Cut to the CL-1042 website record; zoom to the matching response/status, then pull back to include the next action. | Hold long enough to read patient ID and status together. |
| Team actions / patient list | Medium-wide website framing; gently pan across owner and due/status columns, then use a short cursor-led move to the patient search. | No rapid page-wide zoom; finish on the Ramesh record. |
| Ending | Compose a stable medium-wide shot with patient name, ID, response, and action visible; optional final cut to the app's matching update. | Hold 3 seconds, then fade to CareLoop title. |

## Claims and exclusions

- Say **“demo coordination view”** or **“representative source records”**; do not imply real EMR, lab, or treatment-register connections.
- Describe priority as based on visible follow-up activity; do not call it medical risk prediction or diagnosis.
- Use only the fictional demo patients and synthetic report. Do not show credentials, real patient information, development tools, terminal output, desktop notifications, or unrelated apps.
- Do not show a login page or an embedded website patient-app preview; the patient experience is the iOS Simulator app.
