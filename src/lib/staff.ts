import { supabase } from '@/lib/supabase';

export type StaffRole = 'doctor' | 'staff' | 'care_coordinator' | 'org_admin' | 'platform_admin';
export type StaffInvitationRole = 'doctor' | 'staff' | 'care_coordinator' | 'org_admin';
export type AppointmentStatus = 'upcoming' | 'completed' | 'missed' | 'cancelled' | 'overdue';
export type TestStatus = 'pending' | 'completed' | 'overdue';

export type StaffProfile = {
  id: string;
  role: StaffRole;
  full_name: string;
  email: string;
  phone: string | null;
  age: number | null;
  specialty: string | null;
  department: string | null;
  workplace: string | null;
  experience_years: number | null;
  location: string | null;
  staff_code: string;
};

export type Patient = {
  id: string;
  auth_user_id: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  phone: string | null;
  email: string | null;
  condition: string | null;
  notes: string | null;
  assigned_doctor_id: string | null;
  assigned_staff_id: string | null;
  created_at: string;
};

export type Appointment = {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  scheduled_at: string;
  purpose: string;
  status: AppointmentStatus;
  notes: string | null;
};

export type Test = {
  id: string;
  patient_id: string;
  name: string;
  test_date: string;
  status: TestStatus;
  notes: string | null;
};

export type Medication = {
  id: string;
  patient_id: string;
  name: string;
  dosage: string;
  instructions: string;
  start_date: string;
  end_date: string | null;
  status: 'current' | 'past';
};

export type CarePlan = {
  id: string;
  patient_id: string;
  title: string;
  goal: string;
  actions: string;
  responsible_profile_id: string | null;
  review_date: string;
  status: 'active' | 'completed' | 'paused';
};

export type FollowUpEvent = {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  attempted_at: string;
  outcome: string;
  next_steps: string | null;
};

export type Report = {
  id: string;
  patient_id: string;
  test_id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  created_at: string;
};

export type Group = {
  id: string;
  name: string;
  description: string | null;
  assigned_doctor_id: string | null;
  assigned_staff_id: string | null;
  created_by: string;
};

export type DashboardSummary = {
  patients: number;
  appointments: number;
  followUpsDue: number;
  overdueAppointments: number;
  pendingTests: number;
  recentUpdates: number;
};

export type FollowUpQueueItem = {
  task_id: string;
  patient_id: string;
  patient_code: string | null;
  patient_first_name: string;
  patient_last_name: string;
  appointment_id: string | null;
  appointment_scheduled_at: string | null;
  appointment_status: AppointmentStatus | null;
  reason: string;
  due_at: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  priority_source: string;
  owner_id: string | null;
  owner_name: string | null;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  next_action: string;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
};

export type StaffChatMessage = {
  id: string;
  patient_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type ConnectionInvitation = {
  code: string;
  qr_payload: string;
  expires_at: string;
};

const STAFF_ROLES: readonly StaffRole[] = ['doctor', 'staff', 'care_coordinator', 'org_admin', 'platform_admin'];

function getStaffAuthRedirectUrl(): string | undefined {
  const configuredUrl = process.env.EXPO_PUBLIC_STAFF_AUTH_REDIRECT_URL?.trim();
  if (configuredUrl) return configuredUrl;
  if (typeof window !== 'undefined' && window.location.origin) return `${window.location.origin}/staff/dashboard`;
  return undefined;
}

export async function getCurrentStaff(): Promise<StaffProfile | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data, error } = await supabase.from('profiles').select('*').eq('id', userData.user.id).in('role', [...STAFF_ROLES]).eq('active', true).maybeSingle();
  if (error) throw error;
  return (data as StaffProfile | null) ?? null;
}

export async function signUpStaff(input: {
  accountType: 'doctor' | 'staff';
  fullName: string;
  email: string;
  password: string;
  phone: string;
  age: number;
  specialty?: string;
  department?: string;
  workplace: string;
  experienceYears: number;
  location: string;
}) {
  const emailRedirectTo = getStaffAuthRedirectUrl();
  return supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
      data: {
        account_type: input.accountType,
        full_name: input.fullName.trim(),
        phone: input.phone.trim(),
        age: String(input.age),
        specialty: input.specialty?.trim() ?? '',
        department: input.department?.trim() ?? '',
        workplace: input.workplace.trim(),
        experience_years: String(input.experienceYears),
        location: input.location.trim(),
      },
    },
  });
}

export async function resendStaffConfirmation(email: string) {
  const emailRedirectTo = getStaffAuthRedirectUrl();
  return supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    ...(emailRedirectTo ? { options: { emailRedirectTo } } : {}),
  });
}

export async function signInStaff(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
}

export async function signOutStaff() {
  return supabase.auth.signOut();
}

export async function createStaffInvitation(input: {
  careTeamId: string;
  email: string;
  role: StaffInvitationRole;
  ttlHours?: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_staff_invitation', {
    target_care_team_id: input.careTeamId,
    target_email: input.email.trim().toLowerCase(),
    target_role: input.role,
    invitation_ttl_hours: input.ttlHours ?? 72,
  });
  if (error) throw error;
  return String(data);
}

export async function acceptStaffInvitation(token: string): Promise<string> {
  const normalizedToken = token.trim();
  if (normalizedToken.length < 32) throw new Error('Enter a valid staff invitation token.');
  const { data, error } = await supabase.rpc('accept_staff_invitation', { invitation_token: normalizedToken });
  if (error) throw error;
  return String(data);
}

export async function listProfiles(): Promise<StaffProfile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('full_name');
  if (error) throw error;
  return (data ?? []) as StaffProfile[];
}

export async function listPatients(search = ''): Promise<Patient[]> {
  let query = supabase.from('patients').select('*').order('created_at', { ascending: false });
  if (search.trim()) {
    const value = search.trim().replaceAll(',', ' ');
    query = query.or(`first_name.ilike.%${value}%,last_name.ilike.%${value}%,phone.ilike.%${value}%,condition.ilike.%${value}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Patient[];
}

export async function getPatient(patientId: string): Promise<Patient> {
  const { data, error } = await supabase.from('patients').select('*').eq('id', patientId).single();
  if (error) throw error;
  return data as Patient;
}

export async function createPatient(input: Partial<Patient> & Pick<Patient, 'first_name' | 'last_name'>): Promise<Patient> {
  const { data, error } = await supabase.from('patients').insert(input).select().single();
  if (error) throw error;
  const patient = data as Patient;
  await logActivity(patient.id, 'patient.created', 'patient', patient.id, `Created patient ${patient.first_name} ${patient.last_name}`);
  return patient;
}

export async function updatePatient(patientId: string, input: Partial<Patient>): Promise<Patient> {
  const { data, error } = await supabase.from('patients').update(input).eq('id', patientId).select().single();
  if (error) throw error;
  const patient = data as Patient;
  await logActivity(patient.id, 'patient.updated', 'patient', patient.id, 'Updated patient record');
  return patient;
}

export async function listAppointments(patientId?: string): Promise<Appointment[]> {
  let query = supabase.from('appointments').select('*').order('scheduled_at');
  if (patientId) query = query.eq('patient_id', patientId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Appointment[];
}

export async function createAppointment(input: Omit<Appointment, 'id'> & { created_by?: string }): Promise<Appointment> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('appointments').insert({ ...input, created_by: userData.user?.id }).select().single();
  if (error) throw error;
  const appointment = data as Appointment;
  await logActivity(appointment.patient_id, 'appointment.created', 'appointment', appointment.id, `Scheduled ${appointment.purpose}`);
  return appointment;
}

export async function updateAppointment(id: string, patientId: string, input: Partial<Appointment>): Promise<Appointment> {
  const { data, error } = await supabase.from('appointments').update(input).eq('id', id).select().single();
  if (error) throw error;
  const appointment = data as Appointment;
  await logActivity(patientId, 'appointment.updated', 'appointment', id, `Updated appointment to ${appointment.status}`);
  return appointment;
}

export async function listTests(patientId: string): Promise<Test[]> {
  const { data, error } = await supabase.from('tests').select('*').eq('patient_id', patientId).order('test_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Test[];
}

export async function createTest(input: Omit<Test, 'id'>): Promise<Test> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('tests').insert({ ...input, created_by: userData.user?.id }).select().single();
  if (error) throw error;
  const test = data as Test;
  await logActivity(test.patient_id, 'test.created', 'test', test.id, `Added test ${test.name}`);
  return test;
}

export async function listReports(patientId: string): Promise<Report[]> {
  const { data, error } = await supabase.from('reports').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Report[];
}

export async function createReport(input: Omit<Report, 'id' | 'created_at'>): Promise<Report> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('reports').insert({ ...input, uploaded_by: userData.user?.id }).select().single();
  if (error) throw error;
  return data as Report;
}

export async function uploadReportFile(patientId: string, testId: string, file: File): Promise<Report> {
  const filePath = `${patientId}/${testId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
  const { error: uploadError } = await supabase.storage.from('careloop-reports').upload(filePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (uploadError) throw uploadError;
  return createReport({ patient_id: patientId, test_id: testId, file_path: filePath, file_name: file.name, mime_type: file.type || null });
}

export async function listStaffChatMessages(patientId: string): Promise<StaffChatMessage[]> {
  const [messages, legacy] = await Promise.all([
    supabase.from('care_team_messages').select('id, patient_id, sender_id, body, created_at').eq('patient_id', patientId).order('created_at', { ascending: true }).limit(60),
    supabase.from('activity_log').select('id, patient_id, actor_id, summary, created_at').eq('patient_id', patientId).eq('entity_type', 'message').order('created_at', { ascending: true }).limit(60),
  ]);
  if (messages.error) throw messages.error;
  if (legacy.error) throw legacy.error;
  const current = (messages.data ?? []) as StaffChatMessage[];
  const prior = ((legacy.data ?? []) as { id: string; patient_id: string; actor_id: string | null; summary: string; created_at: string }[])
    .map((row): StaffChatMessage => ({ id: `legacy-${row.id}`, patient_id: row.patient_id, sender_id: row.actor_id ?? '', body: row.summary, created_at: row.created_at }));
  return [...current, ...prior].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-60);
}

export async function sendStaffChatMessage(patientId: string, body: string): Promise<StaffChatMessage> {
  const trimmedBody = body.trim();
  if (!trimmedBody) throw new Error('Write a message or attach a report first.');
  if (trimmedBody.length > 4000) throw new Error('Message must be 4,000 characters or fewer.');
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('Sign in is required to message a patient.');
  const { data, error } = await supabase.from('care_team_messages')
    .insert({ patient_id: patientId, sender_id: userData.user.id, body: trimmedBody })
    .select('id, patient_id, sender_id, body, created_at')
    .single();
  if (error) throw error;
  return data as StaffChatMessage;
}

export async function getReportUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from('careloop-reports').createSignedUrl(filePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function listMedications(patientId: string): Promise<Medication[]> {
  const { data, error } = await supabase.from('medications').select('*').eq('patient_id', patientId).order('status').order('start_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Medication[];
}

export async function createMedication(input: Omit<Medication, 'id'>): Promise<Medication> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('medications').insert({ ...input, created_by: userData.user?.id }).select().single();
  if (error) throw error;
  const medication = data as Medication;
  await logActivity(medication.patient_id, 'medication.created', 'medication', medication.id, `Added medication ${medication.name}`);
  return medication;
}

export async function listCarePlans(patientId: string): Promise<CarePlan[]> {
  const { data, error } = await supabase.from('care_plans').select('*').eq('patient_id', patientId).order('review_date');
  if (error) throw error;
  return (data ?? []) as CarePlan[];
}

export async function createCarePlan(input: Omit<CarePlan, 'id'>): Promise<CarePlan> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('care_plans').insert({ ...input, created_by: userData.user?.id }).select().single();
  if (error) throw error;
  const plan = data as CarePlan;
  await logActivity(plan.patient_id, 'care_plan.created', 'care_plan', plan.id, `Added care plan ${plan.title}`);
  return plan;
}

export async function listFollowUps(patientId: string): Promise<FollowUpEvent[]> {
  const { data, error } = await supabase.from('follow_up_events').select('*').eq('patient_id', patientId).order('attempted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FollowUpEvent[];
}

export async function createFollowUp(input: Omit<FollowUpEvent, 'id' | 'attempted_at'> & { attempted_at?: string }): Promise<FollowUpEvent> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('follow_up_events').insert({ ...input, attempted_at: input.attempted_at ?? new Date().toISOString(), recorded_by: userData.user?.id }).select().single();
  if (error) throw error;
  const event = data as FollowUpEvent;
  await logActivity(event.patient_id, 'follow_up.created', 'follow_up', event.id, `Recorded follow-up: ${event.outcome}`);
  return event;
}

export async function listGroups(): Promise<Group[]> {
  const { data, error } = await supabase.from('patient_groups').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as Group[];
}

export async function createGroup(input: Omit<Group, 'id' | 'created_by'>): Promise<Group> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('patient_groups').insert({ ...input, created_by: userData.user?.id }).select().single();
  if (error) throw error;
  return data as Group;
}

export async function addPatientToGroup(groupId: string, patientId: string): Promise<void> {
  const { error } = await supabase.from('patient_group_members').upsert({ group_id: groupId, patient_id: patientId });
  if (error) throw error;
}

export async function createConnectionInvitation(patientId: string): Promise<ConnectionInvitation> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('Sign in is required to create a patient connection.');
  const { data: membership, error: membershipError } = await supabase.from('care_team_memberships')
    .select('care_team_id')
    .eq('profile_id', userData.user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership?.care_team_id) throw new Error('Your account is not assigned to an active care team.');
  const { data, error } = await supabase.rpc('create_connection_qr_invitation', {
    target_patient_id: patientId,
    target_care_team_id: membership.care_team_id,
    invitation_ttl_hours: 24,
  });
  if (error) throw error;
  const invitation = Array.isArray(data) ? data[0] : data;
  if (!invitation?.code || !invitation.qr_payload || !invitation.expires_at) {
    throw new Error('The invitation service returned an incomplete QR connection invitation.');
  }
  return invitation as ConnectionInvitation;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [patients, appointments, tests, activity] = await Promise.all([
    supabase.from('patients').select('id', { count: 'exact', head: true }),
    supabase.from('appointments').select('id, status, scheduled_at'),
    supabase.from('tests').select('id, status'),
    supabase.from('activity_log').select('id', { count: 'exact', head: true }),
  ]);
  if (patients.error) throw patients.error;
  if (appointments.error) throw appointments.error;
  if (tests.error) throw tests.error;
  if (activity.error) throw activity.error;
  const appointmentRows = (appointments.data ?? []) as Pick<Appointment, 'status' | 'scheduled_at'>[];
  const testRows = (tests.data ?? []) as Pick<Test, 'status'>[];
  const now = Date.now();
  return {
    patients: patients.count ?? 0,
    appointments: appointmentRows.length,
    followUpsDue: appointmentRows.filter((row) => row.status === 'upcoming' && new Date(row.scheduled_at).getTime() - now < 7 * 86400000).length,
    overdueAppointments: appointmentRows.filter((row) => row.status === 'overdue' || (row.status === 'upcoming' && new Date(row.scheduled_at).getTime() < now)).length,
    pendingTests: testRows.filter((row) => row.status === 'pending' || row.status === 'overdue').length,
    recentUpdates: activity.count ?? 0,
  };
}

export async function listFollowUpQueue(options: { status?: FollowUpQueueItem['status']; ownerId?: string; dueBefore?: string; limit?: number } = {}): Promise<FollowUpQueueItem[]> {
  const { data, error } = await supabase.rpc('list_follow_up_queue', {
    target_status: options.status ?? null,
    target_owner_id: options.ownerId ?? null,
    due_before: options.dueBefore ?? null,
    result_limit: options.limit ?? 100,
  });
  if (error) throw error;
  return (data ?? []) as FollowUpQueueItem[];
}

export async function logActivity(patientId: string | null, action: string, entityType: string, entityId: string | null, summary: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  await supabase.from('activity_log').insert({ patient_id: patientId, actor_id: userData.user?.id, action, entity_type: entityType, entity_id: entityId, summary });
}
