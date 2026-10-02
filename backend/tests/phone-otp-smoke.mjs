import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const apiUrl = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const phone = '+910000000001';
const authPhone = phone.replace(/^\+/, '');
const otp = '123456';

assert.ok(anonKey, 'SUPABASE_ANON_KEY must be set by the local integration runner');
assert.ok(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY must be set by the local integration runner');

async function restRequest(path, { method = 'GET', body, token = serviceRoleKey, prefer, expectedStatus, expectedStatuses, expectedCode } = {}) {
  const headers = {
    apikey: token === serviceRoleKey ? serviceRoleKey : anonKey,
    authorization: `Bearer ${token}`,
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (prefer) headers.prefer = prefer;
  const response = await fetch(`${apiUrl}/rest/v1/${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const responseText = response.status === 204 ? '' : await response.text();
  let responseBody = null;
  if (responseText) {
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }
  }
  if (expectedStatus !== undefined) {
    assert.equal(response.status, expectedStatus, `${method} ${path} returned HTTP ${response.status}: ${JSON.stringify(responseBody)}`);
  } else if (expectedStatuses !== undefined) {
    assert.ok(expectedStatuses.includes(response.status), `${method} ${path} returned HTTP ${response.status}: ${JSON.stringify(responseBody)}`);
  } else if (expectedCode !== undefined) {
    assert.ok(!response.ok, `${method} ${path} unexpectedly succeeded`);
    assert.equal(responseBody?.code, expectedCode, `${method} ${path} returned ${JSON.stringify(responseBody)}`);
  } else {
    assert.ok(response.ok, `${method} ${path} returned HTTP ${response.status}: ${JSON.stringify(responseBody)}`);
  }
  return responseBody;
}

const anonymousPatientRead = await restRequest('patients?select=id', {
  token: anonKey, expectedStatus: 401,
});
assert.equal(anonymousPatientRead.code, '42501', 'anon role must not have direct Patient table privileges');

async function authRequest(path, payload) {
  const response = await fetch(`${apiUrl}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  assert.equal(
    response.status,
    200,
    `${path} returned HTTP ${response.status}: ${body.error_code ?? body.msg ?? 'unknown Auth error'}`,
  );
  return body;
}

await authRequest('otp', { phone, create_user: true });
process.stdout.write('phone_otp_request=PASS\n');

const verified = await authRequest('verify', { phone, token: otp, type: 'sms' });
assert.ok(verified.access_token, 'OTP verification should return a user access token');
assert.equal(
  verified.user?.phone?.replace(/^\+/, ''),
  authPhone,
  'verified Auth user should retain the normalized phone digits',
);
process.stdout.write('phone_otp_verification=PASS\n');

const profileResponse = await fetch(
  `${apiUrl}/rest/v1/profiles?select=id,role,phone&id=eq.${encodeURIComponent(verified.user.id)}`,
  {
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${verified.access_token}`,
    },
  },
);
assert.equal(profileResponse.status, 200, `profile query returned HTTP ${profileResponse.status}`);
const profiles = await profileResponse.json();
assert.equal(profiles.length, 1, 'newly verified user should have exactly one profile');
assert.equal(profiles[0].id, verified.user.id);
assert.equal(profiles[0].role, 'pending', 'phone verification alone must not grant staff privileges');
assert.equal(profiles[0].phone?.replace(/^\+/, ''), authPhone);
process.stdout.write('auth_profile_trigger_and_pending_role=PASS\n');

const [organisation] = await restRequest('organisations?select=id', {
  method: 'POST',
  body: { name: 'Local REST Contract Org', slug: `local-rest-${verified.user.id.slice(0, 8)}` },
  prefer: 'return=representation',
});
const [patient] = await restRequest('patients?select=id,auth_user_id', {
  method: 'POST',
  body: {
    organisation_id: organisation.id,
    auth_user_id: verified.user.id,
    first_name: 'REST',
    last_name: 'Patient',
  },
  prefer: 'return=representation',
});
const [otherOrganisation] = await restRequest('organisations?select=id', {
  method: 'POST',
  body: { name: 'Other Local REST Org', slug: `other-rest-${verified.user.id.slice(0, 8)}` },
  prefer: 'return=representation',
});
const [otherPatient] = await restRequest('patients?select=id', {
  method: 'POST',
  body: { organisation_id: otherOrganisation.id, first_name: 'Other', last_name: 'Patient' },
  prefer: 'return=representation',
});
const scheduledAt = new Date(Date.now() + 2 * 86400000).toISOString();
const [appointment] = await restRequest('appointments?select=id,patient_id,scheduled_at,status', {
  method: 'POST',
  body: {
    patient_id: patient.id,
    scheduled_at: scheduledAt,
    purpose: 'PostgREST contract check',
    status: 'upcoming',
  },
  prefer: 'return=representation',
});

const patientRows = await restRequest(`patients?select=id,auth_user_id&id=eq.${patient.id}`, { token: verified.access_token });
assert.equal(patientRows.length, 1, 'authenticated patient should read only their linked patient record');
const foreignPatientRows = await restRequest(`patients?select=id&id=eq.${otherPatient.id}`, { token: verified.access_token });
assert.equal(foreignPatientRows.length, 0, 'authenticated patient must not read another organisation patient');
const patientDeleteError = await restRequest(`patients?id=eq.${patient.id}`, {
  method: 'DELETE', token: verified.access_token, expectedStatuses: [401, 403],
});
assert.equal(patientDeleteError.code, '42501', 'authenticated patient must not receive a direct-delete table grant');
const appointmentRows = await restRequest(`appointments?select=id,patient_id,scheduled_at,status&patient_id=eq.${patient.id}&order=scheduled_at`, { token: verified.access_token });
assert.equal(appointmentRows.length, 1, 'authenticated patient should read their own appointment');

const requestedAt = new Date(Date.now() + 5 * 86400000).toISOString();
await restRequest(`appointments?id=eq.${appointment.id}&patient_id=eq.${patient.id}`, {
  method: 'PATCH',
  token: verified.access_token,
  body: { scheduled_at: requestedAt, status: 'upcoming' },
  prefer: 'return=minimal',
});
const [responseRecord] = await restRequest(`appointment_responses?select=appointment_id,patient_id,response,requested_scheduled_at,responded_by&appointment_id=eq.${appointment.id}`, { token: verified.access_token });
assert.equal(responseRecord.response, 'reschedule_requested', 'patient app schedule PATCH should produce an audited reschedule response');
assert.equal(Date.parse(responseRecord.requested_scheduled_at), Date.parse(requestedAt));
assert.equal(responseRecord.responded_by, verified.user.id);
await restRequest(`appointments?id=eq.${appointment.id}&patient_id=eq.${patient.id}`, {
  method: 'PATCH',
  token: verified.access_token,
  body: { notes: 'Patient attempted to edit staff-only notes.' },
  prefer: 'return=minimal',
  expectedStatus: 403,
});

await restRequest('follow_up_events', {
  method: 'POST',
  token: verified.access_token,
  body: {
    patient_id: patient.id,
    appointment_id: appointment.id,
    attempted_at: new Date().toISOString(),
    outcome: 'Reschedule requested',
    next_steps: 'Please review the requested time.',
    recorded_by: verified.user.id,
  },
  prefer: 'return=minimal',
});
const followUps = await restRequest(`follow_up_events?select=id,patient_id,appointment_id,recorded_by&patient_id=eq.${patient.id}`, { token: verified.access_token });
assert.equal(followUps.length, 1, 'Patient app follow-up insert should persist through PostgREST');
assert.equal(followUps[0].appointment_id, appointment.id);
process.stdout.write('patient_postgrest_contract=PASS\n');

const staffPassword = `Local-${verified.user.id.slice(0, 8)}-Password!`;
const staffEmail = `doctor-${verified.user.id.slice(0, 8)}@careloop.test`;
const staffCreateResponse = await fetch(`${apiUrl}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({ email: staffEmail, password: staffPassword, email_confirm: true, user_metadata: { full_name: 'Local REST Doctor' } }),
});
const staffCreateBody = await staffCreateResponse.json();
assert.ok(staffCreateResponse.ok, `staff Auth fixture returned HTTP ${staffCreateResponse.status}: ${JSON.stringify(staffCreateBody)}`);
const staffUserId = staffCreateBody.id;
const [team] = await restRequest('care_teams?select=id', {
  method: 'POST',
  body: { organisation_id: organisation.id, name: 'Local REST Team' },
  prefer: 'return=representation',
});
await restRequest(`profiles?id=eq.${staffUserId}`, {
  method: 'PATCH',
  body: { role: 'doctor', organisation_id: organisation.id, primary_care_team_id: team.id, full_name: 'Local REST Doctor', active: true },
  prefer: 'return=minimal',
});
await restRequest('care_team_memberships', {
  method: 'POST',
  body: { care_team_id: team.id, profile_id: staffUserId, role: 'doctor' },
  prefer: 'return=minimal',
});
const staffSession = await authRequest('token?grant_type=password', { email: staffEmail, password: staffPassword });
assert.ok(staffSession.access_token, 'staff password login should return an access token');

const [staffPatient] = await restRequest('patients?select=id,organisation_id,assigned_doctor_id', {
  method: 'POST',
  token: staffSession.access_token,
  body: { first_name: 'Staff', last_name: 'Created', assigned_doctor_id: staffUserId },
  prefer: 'return=representation',
});
assert.equal(staffPatient.organisation_id, organisation.id, 'patient app staff insert should inherit authenticated organisation');
const [staffAppointment] = await restRequest('appointments?select=id,patient_id,status', {
  method: 'POST',
  token: staffSession.access_token,
  body: {
    patient_id: staffPatient.id,
    doctor_id: staffUserId,
    scheduled_at: new Date(Date.now() + 3 * 86400000).toISOString(),
    purpose: 'Staff API workflow',
    notes: 'Staff-only note',
    created_by: staffUserId,
  },
  prefer: 'return=representation',
});
const taskDueAt = new Date(Date.now() + 86400000).toISOString();
const taskRequest = {
  target_patient_id: staffPatient.id,
  task_reason: 'Review test results',
  target_due_at: taskDueAt,
  request_key: `rest-task-${staffPatient.id}`,
  task_priority: 'normal',
  priority_source: 'staff_created',
  owner_profile_id: staffUserId,
  target_appointment_id: staffAppointment.id,
  action_next: 'Call the patient after review',
};
const taskId = await restRequest('rpc/create_follow_up_task', {
  method: 'POST', token: staffSession.access_token, body: taskRequest,
});
const replayTaskId = await restRequest('rpc/create_follow_up_task', {
  method: 'POST', token: staffSession.access_token, body: taskRequest,
});
assert.equal(replayTaskId, taskId, 'task create retries should return the original task');
await restRequest('rpc/create_follow_up_task', {
  method: 'POST', token: staffSession.access_token, expectedCode: '22023',
  body: { ...taskRequest, task_reason: 'Different payload under the same key' },
});
await restRequest('rpc/create_follow_up_task', {
  method: 'POST', token: staffSession.access_token, expectedCode: '42501',
  body: { ...taskRequest, request_key: `rest-task-invalid-owner-${staffPatient.id}`, owner_profile_id: '00000000-0000-0000-0000-000000000099' },
});
await restRequest('follow_up_tasks', {
  method: 'POST', token: staffSession.access_token, expectedCode: '42501',
  body: { patient_id: staffPatient.id, reason: 'Direct insert must not work', due_at: taskDueAt, priority_source: 'test', next_action: 'test', created_by: staffUserId },
});
let [task] = await restRequest(`follow_up_tasks?select=id,patient_id,status,owner_id,updated_at&id=eq.${taskId}`, { token: staffSession.access_token });
assert.equal(task.status, 'open');
const taskEvents = await restRequest(`follow_up_task_events?select=event_type,to_status&task_id=eq.${taskId}`, { token: staffSession.access_token });
assert.equal(taskEvents.filter((event) => event.event_type === 'created').length, 1, 'idempotent retry should not duplicate creation events');
await restRequest('rpc/update_follow_up_task', {
  method: 'POST', token: staffSession.access_token,
  body: { task_id: taskId, expected_updated_at: task.updated_at, new_status: 'in_progress' },
});
await restRequest('rpc/update_follow_up_task', {
  method: 'POST', token: staffSession.access_token, expectedCode: '40001',
  body: { task_id: taskId, expected_updated_at: task.updated_at, new_status: 'completed', closure_note: 'stale attempt' },
});
([task] = await restRequest(`follow_up_tasks?select=id,status,updated_at&id=eq.${taskId}`, { token: staffSession.access_token }));
await restRequest('rpc/update_follow_up_task', {
  method: 'POST', token: staffSession.access_token, expectedCode: '22023',
  body: { task_id: taskId, expected_updated_at: task.updated_at, new_status: 'completed' },
});
await restRequest('rpc/update_follow_up_task', {
  method: 'POST', token: staffSession.access_token,
  body: { task_id: taskId, expected_updated_at: task.updated_at, new_status: 'completed', closure_note: 'Patient contacted; plan agreed' },
});
([task] = await restRequest(`follow_up_tasks?select=id,status,closure_note,closed_at,closed_by,updated_at&id=eq.${taskId}`, { token: staffSession.access_token }));
assert.equal(task.status, 'completed');
assert.equal(task.closure_note, 'Patient contacted; plan agreed');
assert.equal(task.closed_by, staffUserId);
const [missedAppointment] = await restRequest('appointments?select=id,patient_id,status', {
  method: 'POST', token: staffSession.access_token,
  body: { patient_id: staffPatient.id, doctor_id: staffUserId, scheduled_at: new Date(Date.now() - 86400000).toISOString(), purpose: 'Missed appointment test', created_by: staffUserId },
  prefer: 'return=representation',
});
await restRequest(`appointments?id=eq.${missedAppointment.id}`, {
  method: 'PATCH', token: staffSession.access_token, body: { status: 'missed' }, prefer: 'return=minimal',
});
const autoTasks = await restRequest(`follow_up_tasks?select=id,reason,priority,priority_source,owner_id,appointment_id&appointment_id=eq.${missedAppointment.id}`, { token: staffSession.access_token });
assert.equal(autoTasks.length, 1, 'missed appointment should automatically create one follow-up task');
assert.equal(autoTasks[0].priority_source, 'appointment_missed');
assert.equal(autoTasks[0].owner_id, staffUserId);
process.stdout.write('follow_up_task_api_lifecycle_and_auto_creation=PASS\n');
const [staffTest] = await restRequest('tests?select=id,patient_id', {
  method: 'POST',
  token: staffSession.access_token,
  body: {
    patient_id: staffPatient.id,
    name: 'REST contract test',
    test_date: new Date().toISOString().slice(0, 10),
    status: 'pending',
    created_by: staffUserId,
  },
  prefer: 'return=representation',
});
await restRequest('medications', {
  method: 'POST', token: staffSession.access_token, prefer: 'return=minimal',
  body: { patient_id: staffPatient.id, name: 'REST medication', dosage: '1 tablet', instructions: 'As directed', start_date: new Date().toISOString().slice(0, 10), created_by: staffUserId },
});
await restRequest('care_plans', {
  method: 'POST', token: staffSession.access_token, prefer: 'return=minimal',
  body: { patient_id: staffPatient.id, title: 'REST plan', goal: 'Follow up', actions: 'Review at next visit', responsible_profile_id: staffUserId, review_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), status: 'active', created_by: staffUserId },
});
await restRequest('follow_up_events', {
  method: 'POST', token: staffSession.access_token, prefer: 'return=minimal',
  body: { patient_id: staffPatient.id, appointment_id: staffAppointment.id, outcome: 'Staff API follow-up', recorded_by: staffUserId },
});
const [group] = await restRequest('patient_groups?select=id,organisation_id,assigned_doctor_id', {
  method: 'POST', token: staffSession.access_token, prefer: 'return=representation',
  body: { name: 'REST staff group', created_by: staffUserId, assigned_doctor_id: staffUserId },
});
assert.equal(group.organisation_id, organisation.id, 'staff group insert should inherit authenticated organisation');
assert.equal(group.assigned_doctor_id, staffUserId, 'active same-organisation doctor may be assigned to the group');
await restRequest('patient_group_members', {
  method: 'POST', token: staffSession.access_token, prefer: 'resolution=merge-duplicates,return=minimal',
  body: { group_id: group.id, patient_id: staffPatient.id },
});
const clientInvitationCode = `CL-${verified.user.id.slice(0, 8).toUpperCase()}`;
const [invitation] = await restRequest('connection_invitations?select=id,patient_id,care_team_id,created_by,code,expires_at', {
  method: 'POST', token: staffSession.access_token, prefer: 'return=representation',
  body: { patient_id: staffPatient.id, code: clientInvitationCode, created_by: staffUserId },
});
assert.equal(invitation.care_team_id, team.id, 'invitation should inherit the active staff care team');
assert.notEqual(invitation.code, clientInvitationCode, 'database should not retain the weak client-supplied invitation code');
assert.match(invitation.code, /^CL-[A-F0-9]{16}$/, 'database should replace the weak client invitation code with a 64-bit server-generated code');
const [storedInvitation] = await restRequest(`connection_invitations?id=eq.${invitation.id}&select=code_hash`);
assert.equal(storedInvitation.code_hash, createHash('sha256').update(invitation.code).digest('hex'), 'only the generated code should determine the stored redemption hash');

const reportPath = `${staffPatient.id}/${staffTest.id}/rest-contract.pdf`;
const uploadResponse = await fetch(`${apiUrl}/storage/v1/object/careloop-reports/${reportPath}`, {
  method: 'POST',
  headers: { apikey: anonKey, authorization: `Bearer ${staffSession.access_token}`, 'content-type': 'application/pdf' },
  body: '%PDF-1.4\nCareLoop test fixture\n%%EOF',
});
const uploadBody = await uploadResponse.text();
assert.ok(uploadResponse.ok, `staff report upload returned HTTP ${uploadResponse.status}: ${uploadBody}`);
await restRequest('reports?select=id,patient_id,test_id,file_path', {
  method: 'POST', token: staffSession.access_token, prefer: 'return=minimal',
  body: { patient_id: staffPatient.id, test_id: staffTest.id, file_path: reportPath, file_name: 'rest-contract.pdf', mime_type: 'application/pdf', uploaded_by: staffUserId },
});
const signedResponse = await fetch(`${apiUrl}/storage/v1/object/sign/careloop-reports/${reportPath}`, {
  method: 'POST',
  headers: { apikey: anonKey, authorization: `Bearer ${staffSession.access_token}`, 'content-type': 'application/json' },
  body: JSON.stringify({ expiresIn: 60 }),
});
const signedUrl = await signedResponse.json();
assert.ok(signedResponse.ok, `staff report signed URL returned HTTP ${signedResponse.status}: ${JSON.stringify(signedUrl)}`);
assert.ok(signedUrl.signedURL ?? signedUrl.signedUrl, 'private report download should return a signed URL');
process.stdout.write('staff_postgrest_workflow=PASS\n');

const recipientPhone = '+910000000002';
await authRequest('otp', { phone: recipientPhone, create_user: true });
const recipientSession = await authRequest('verify', { phone: recipientPhone, token: otp, type: 'sms' });
const redeemedPatientId = await restRequest('rpc/redeem_connection_code', {
  method: 'POST', token: recipientSession.access_token, body: { invitation_code: invitation.code },
});
assert.equal(redeemedPatientId, staffPatient.id, 'new patient account should redeem the staff-created invitation and link its patient record');
const linkedPatient = await restRequest(`patients?select=id,auth_user_id&id=eq.${staffPatient.id}`, { token: recipientSession.access_token });
assert.equal(linkedPatient[0]?.auth_user_id, recipientSession.user.id);
const [consent] = await restRequest(`connection_consents?select=patient_id,care_team_id,consented_by&patient_id=eq.${staffPatient.id}`, { token: recipientSession.access_token });
assert.equal(consent.consented_by, recipientSession.user.id, 'invitation redemption should create consent as the authenticating patient');
const patientVisibleTasks = await restRequest(`follow_up_tasks?select=id&id=eq.${taskId}`, { token: recipientSession.access_token });
assert.equal(patientVisibleTasks.length, 0, 'patient session should not read staff follow-up task rows');
await restRequest('rpc/update_follow_up_task', {
  method: 'POST', token: recipientSession.access_token, expectedCode: '42501',
  body: { task_id: taskId, expected_updated_at: task.updated_at, new_status: 'cancelled', closure_note: 'patient cannot manage staff queue' },
});
await restRequest('rpc/withdraw_connection', {
  method: 'POST', token: recipientSession.access_token, body: { target_connection_id: (await restRequest(`patient_care_team_connections?select=id&patient_id=eq.${staffPatient.id}`, { token: recipientSession.access_token }))[0].id },
});
const withdrawnConnections = await restRequest(`patient_care_team_connections?select=status&patient_id=eq.${staffPatient.id}`, { token: recipientSession.access_token });
assert.equal(withdrawnConnections[0]?.status, 'withdrawn', 'patient should be able to withdraw the linked care-team connection');
const staleRedemption = await restRequest('rpc/redeem_connection_code', {
  method: 'POST', token: recipientSession.access_token, body: { invitation_code: invitation.code }, expectedStatus: 400,
});
assert.match(staleRedemption.message, /connection is no longer active|request a new invitation/i);
process.stdout.write('connection_invitation_e2e=PASS\n');
