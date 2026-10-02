import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { DateTimeField, Field, localDateTimeToIso, Notice, PrimaryButton, Section, SelectField, StaffShell, STAFF_COLORS } from '@/components/staff-ui';
import {
  createAppointment,
  createCarePlan,
  createConnectionInvitation,
  createFollowUp,
  createMedication,
  createReport,
  createTest,
  getPatient,
  getReportUrl,
  listAppointments,
  listCarePlans,
  listFollowUps,
  listMedications,
  listProfiles,
  listReports,
  listTests,
  uploadReportFile,
  updatePatient,
  type Appointment,
  type CarePlan,
  type FollowUpEvent,
  type Medication,
  type Patient,
  type Report,
  type StaffProfile,
  type Test,
} from '@/lib/staff';

export default function StaffPatientDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const patientId = Array.isArray(id) ? id[0] : id;
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [plans, setPlans] = useState<CarePlan[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpEvent[]>([]);
  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const [appointmentAt, setAppointmentAt] = useState('');
  const [appointmentPurpose, setAppointmentPurpose] = useState('');
  const [appointmentStatus, setAppointmentStatus] = useState('upcoming');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [testName, setTestName] = useState('');
  const [testDate, setTestDate] = useState('');
  const [testStatus, setTestStatus] = useState('pending');
  const [testNotes, setTestNotes] = useState('');
  const [reportTest, setReportTest] = useState('');
  const [reportName, setReportName] = useState('');
  const [reportPath, setReportPath] = useState('');
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [medicationName, setMedicationName] = useState('');
  const [medicationDosage, setMedicationDosage] = useState('');
  const [medicationInstructions, setMedicationInstructions] = useState('');
  const [medicationStart, setMedicationStart] = useState('');
  const [medicationEnd, setMedicationEnd] = useState('');
  const [medicationStatus, setMedicationStatus] = useState<'current' | 'past'>('current');
  const [planTitle, setPlanTitle] = useState('');
  const [planGoal, setPlanGoal] = useState('');
  const [planActions, setPlanActions] = useState('');
  const [planReviewDate, setPlanReviewDate] = useState('');
  const [planOwner, setPlanOwner] = useState('');
  const [followUpOutcome, setFollowUpOutcome] = useState('');
  const [followUpNextSteps, setFollowUpNextSteps] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!patientId) return;
    const [nextPatient, nextAppointments, nextTests, nextReports, nextMedications, nextPlans, nextFollowUps, nextProfiles] = await Promise.all([
      getPatient(patientId), listAppointments(patientId), listTests(patientId), listReports(patientId), listMedications(patientId), listCarePlans(patientId), listFollowUps(patientId), listProfiles(),
    ]);
    setPatient(nextPatient); setAppointments(nextAppointments); setTests(nextTests); setReports(nextReports); setMedications(nextMedications); setPlans(nextPlans); setFollowUps(nextFollowUps); setProfiles(nextProfiles);
    if (!reportTest && nextTests[0]) setReportTest(nextTests[0].id);
  };

  useEffect(() => {
    if (!patientId) return;
    void Promise.all([
      getPatient(patientId), listAppointments(patientId), listTests(patientId), listReports(patientId), listMedications(patientId), listCarePlans(patientId), listFollowUps(patientId), listProfiles(),
    ]).then(([nextPatient, nextAppointments, nextTests, nextReports, nextMedications, nextPlans, nextFollowUps, nextProfiles]) => {
      setPatient(nextPatient); setAppointments(nextAppointments); setTests(nextTests); setReports(nextReports); setMedications(nextMedications); setPlans(nextPlans); setFollowUps(nextFollowUps); setProfiles(nextProfiles);
      if (!reportTest && nextTests[0]) setReportTest(nextTests[0].id);
    }).catch((reason: Error) => setMessage(reason.message)).finally(() => setLoading(false));
  }, [patientId, reportTest]);

  const run = async (action: () => Promise<void>, success: string) => {
    setMessage(''); setBusy(true);
    try { await action(); await refresh(); setMessage(success); } catch (reason) { setMessage((reason as Error).message); } finally { setBusy(false); }
  };

  const pickReportFile = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      setMessage('File picking is available from the web workspace. You can enter a storage path manually here.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) { setReportFile(file); setReportName(file.name); setReportPath(''); }
    };
    input.click();
  };

  if (loading) return <StaffShell title="Patient record"><ActivityIndicator color={STAFF_COLORS.blue} /></StaffShell>;
  if (!patient) return <StaffShell title="Patient record"><Notice error message={message || 'Patient not found.'} /></StaffShell>;

  const profileLabels = Object.fromEntries(profiles.map((profile) => [profile.id, profile.full_name]));
  return (
    <StaffShell title={`${patient.first_name} ${patient.last_name}`}>
      <Pressable onPress={() => router.replace('/staff/patients')}><Text style={styles.back}>‹ Back to patients</Text></Pressable>
      {message ? <Notice error={message.includes('error') || message.includes('not found')} message={message} /> : null}
      <Section title="Patient overview" action={<PrimaryButton label="Save allocation" onPress={() => void run(async () => { await updatePatient(patient.id, { assigned_doctor_id: patient.assigned_doctor_id, assigned_staff_id: patient.assigned_staff_id }); }, 'Patient record updated.')} />}>
        <View style={styles.overview}><View style={styles.avatar}><Text style={styles.avatarText}>{patient.first_name[0]}{patient.last_name[0]}</Text></View><View style={styles.overviewCopy}><Text style={styles.patientName}>{patient.first_name} {patient.last_name}</Text><Text style={styles.meta}>{patient.condition || 'No care area recorded'} · {patient.phone || 'No phone'}</Text><Text style={styles.meta}>{patient.email || 'No email'} · DOB {patient.date_of_birth || 'Not recorded'}</Text></View></View>
        <View style={styles.row}><SelectField inline label="Responsible doctor" onChange={(value) => setPatient({ ...patient, assigned_doctor_id: value || null })} optionLabels={profileLabels} options={['', ...profiles.filter((profile) => profile.role === 'doctor').map((profile) => profile.id)]} value={patient.assigned_doctor_id || ''} /><SelectField inline label="Responsible staff" onChange={(value) => setPatient({ ...patient, assigned_staff_id: value || null })} optionLabels={profileLabels} options={['', ...profiles.filter((profile) => profile.role === 'staff').map((profile) => profile.id)]} value={patient.assigned_staff_id || ''} /></View>
      </Section>

      <Section title="Patient app connection">
        <Text style={styles.helper}>Generate a temporary code for this patient’s CareLoop app connection. The database invitation expires after 24 hours.</Text>
        <PrimaryButton label="Generate connection code" onPress={() => void run(async () => { const invite = await createConnectionInvitation(patient.id); setMessage(`Connection code: ${invite.code}`); }, 'Connection code created.')} />
      </Section>

      <Section title="Appointments & follow-ups"><View style={styles.row}><DateTimeField inline kind="datetime-local" label="Date and time *" onChangeText={setAppointmentAt} placeholder="Choose date and time" value={appointmentAt} /><Field inline label="Purpose *" onChangeText={setAppointmentPurpose} placeholder="Follow-up review" value={appointmentPurpose} /></View><SelectField label="Status" onChange={setAppointmentStatus} options={['upcoming', 'completed', 'missed', 'cancelled', 'overdue']} value={appointmentStatus} /><Field label="Notes" multiline onChangeText={setAppointmentNotes} placeholder="Preparation or next steps" value={appointmentNotes} /><PrimaryButton disabled={busy} label="Add appointment" onPress={() => void run(async () => { if (!appointmentAt || !appointmentPurpose) throw new Error('Appointment date/time and purpose are required.'); await createAppointment({ patient_id: patient.id, doctor_id: patient.assigned_doctor_id, scheduled_at: localDateTimeToIso(appointmentAt), purpose: appointmentPurpose, status: appointmentStatus as Appointment['status'], notes: appointmentNotes }); setAppointmentAt(''); setAppointmentPurpose(''); setAppointmentNotes(''); }, 'Appointment saved.')} />{appointments.map((appointment) => <DataRow key={appointment.id} title={appointment.purpose} detail={`${appointment.scheduled_at} · ${appointment.status}`} />)}<View style={styles.subForm}><Field label="Follow-up outcome" onChangeText={setFollowUpOutcome} placeholder="Reached patient / no answer" value={followUpOutcome} /><Field label="Next steps" multiline onChangeText={setFollowUpNextSteps} placeholder="Call again tomorrow" value={followUpNextSteps} /><PrimaryButton disabled={busy} label="Record follow-up attempt" onPress={() => void run(async () => { if (!followUpOutcome) throw new Error('Add an outcome before saving.'); await createFollowUp({ patient_id: patient.id, appointment_id: appointments[0]?.id ?? null, outcome: followUpOutcome, next_steps: followUpNextSteps }); setFollowUpOutcome(''); setFollowUpNextSteps(''); }, 'Follow-up recorded.')} /></View>{followUps.map((event) => <DataRow key={event.id} title={event.outcome} detail={`${event.attempted_at}${event.next_steps ? ` · ${event.next_steps}` : ''}`} />)}</Section>

      <Section title="Tests & reports"><View style={styles.row}><Field inline label="Exact test name *" onChangeText={setTestName} placeholder="HbA1c" value={testName} /><DateTimeField inline kind="date" label="Test date *" onChangeText={setTestDate} placeholder="Choose test date" value={testDate} /></View><SelectField label="Test status" onChange={setTestStatus} options={['pending', 'completed', 'overdue']} value={testStatus} /><Field label="Notes" multiline onChangeText={setTestNotes} placeholder="Clinical notes" value={testNotes} /><PrimaryButton disabled={busy} label="Add test" onPress={() => void run(async () => { if (!testName || !testDate) throw new Error('Test name and date are required.'); await createTest({ patient_id: patient.id, name: testName, test_date: testDate, status: testStatus as Test['status'], notes: testNotes }); setTestName(''); setTestDate(''); setTestNotes(''); }, 'Test added.')} />{tests.map((test) => <DataRow key={test.id} title={test.name} detail={`${test.test_date} · ${test.status}${test.notes ? ` · ${test.notes}` : ''}`} />)}<View style={styles.subForm}><SelectField label="Attach report to test" onChange={setReportTest} options={tests.map((test) => test.id)} optionLabels={Object.fromEntries(tests.map((test) => [test.id, test.name]))} value={reportTest} /><Field label="Report file name" onChangeText={setReportName} placeholder="hba1c-report.pdf" value={reportName} /><Field label="Report URL or Supabase Storage path" onChangeText={setReportPath} placeholder="https://… or careloop-reports/…" value={reportPath} /><View style={styles.fileActions}><PrimaryButton label={reportFile ? `Selected: ${reportFile.name}` : 'Choose report file'} onPress={pickReportFile} secondary /><PrimaryButton disabled={busy} label="Save report" onPress={() => void run(async () => { if (!reportTest) throw new Error('Select a test first.'); if (reportFile) await uploadReportFile(patient.id, reportTest, reportFile); else { if (!reportName || !reportPath) throw new Error('Choose a file or provide report file details.'); await createReport({ patient_id: patient.id, test_id: reportTest, file_path: reportPath, file_name: reportName, mime_type: null }); } setReportName(''); setReportPath(''); setReportFile(null); }, 'Report saved.')} /></View></View>{reports.map((report) => <ReportRow key={report.id} report={report} />)}</Section>

      <Section title="Medications"><View style={styles.row}><Field inline label="Medication name *" onChangeText={setMedicationName} placeholder="Metformin" value={medicationName} /><Field inline label="Dosage *" onChangeText={setMedicationDosage} placeholder="500 mg" value={medicationDosage} /></View><Field label="Instructions *" onChangeText={setMedicationInstructions} placeholder="After breakfast" value={medicationInstructions} /><View style={styles.row}><DateTimeField inline kind="date" label="Start date *" onChangeText={setMedicationStart} placeholder="Choose start date" value={medicationStart} /><DateTimeField inline kind="date" label="End date" onChangeText={setMedicationEnd} placeholder="Choose end date" value={medicationEnd} /></View><SelectField label="Medication state" onChange={(value) => setMedicationStatus(value as 'current' | 'past')} options={['current', 'past']} value={medicationStatus} /><PrimaryButton disabled={busy} label="Add medication" onPress={() => void run(async () => { if (!medicationName || !medicationDosage || !medicationInstructions || !medicationStart) throw new Error('Complete medication name, dosage, instructions, and start date.'); await createMedication({ patient_id: patient.id, name: medicationName, dosage: medicationDosage, instructions: medicationInstructions, start_date: medicationStart, end_date: medicationEnd || null, status: medicationStatus }); setMedicationName(''); setMedicationDosage(''); setMedicationInstructions(''); setMedicationStart(''); setMedicationEnd(''); setMedicationStatus('current'); }, 'Medication added.')} />{medications.map((medication) => <DataRow key={medication.id} title={`${medication.name} · ${medication.dosage}`} detail={`${medication.instructions} · ${medication.status}`} />)}</Section>

      <Section title="Care plans"><Field label="Plan title *" onChangeText={setPlanTitle} placeholder="Recovery follow-up" value={planTitle} /><Field label="Goal *" onChangeText={setPlanGoal} placeholder="Maintain stable readings" value={planGoal} /><Field label="Actions *" multiline onChangeText={setPlanActions} placeholder="Weekly check-in and appointment review" value={planActions} /><View style={styles.row}><DateTimeField inline kind="date" label="Review date *" onChangeText={setPlanReviewDate} placeholder="Choose review date" value={planReviewDate} /><SelectField inline label="Responsible team member" onChange={setPlanOwner} optionLabels={profileLabels} options={['', ...profiles.map((profile) => profile.id)]} value={planOwner} /></View><PrimaryButton disabled={busy} label="Create care plan" onPress={() => void run(async () => { if (!planTitle || !planGoal || !planActions || !planReviewDate) throw new Error('Complete the care plan title, goal, actions, and review date.'); await createCarePlan({ patient_id: patient.id, title: planTitle, goal: planGoal, actions: planActions, review_date: planReviewDate, status: 'active', responsible_profile_id: planOwner || null }); setPlanTitle(''); setPlanGoal(''); setPlanActions(''); setPlanReviewDate(''); }, 'Care plan created.')} />{plans.map((plan) => <DataRow key={plan.id} title={plan.title} detail={`${plan.goal} · review ${plan.review_date} · ${plan.status}`} />)}</Section>
    </StaffShell>
  );
}

function DataRow({ title, detail }: { title: string; detail: string }) {
  return <View style={styles.dataRow}><Text style={styles.dataTitle}>{title}</Text><Text style={styles.dataDetail}>{detail}</Text></View>;
}

function ReportRow({ report }: { report: Report }) {
  const [opening, setOpening] = useState(false);
  const open = async () => {
    setOpening(true);
    try { const url = report.file_path.startsWith('http') ? report.file_path : await getReportUrl(report.file_path); await Linking.openURL(url); } finally { setOpening(false); }
  };
  return <Pressable onPress={() => void open()} style={styles.dataRow}><Text style={styles.dataTitle}>{report.file_name}</Text><Text style={styles.dataDetail}>{opening ? 'Opening…' : 'Open report'} · Test {report.test_id}</Text></Pressable>;
}

const styles = StyleSheet.create({
  back: { color: STAFF_COLORS.blue, fontSize: 14, fontWeight: '700', marginBottom: 16 },
  overview: { alignItems: 'center', flexDirection: 'row', marginBottom: 18 },
  avatar: { alignItems: 'center', backgroundColor: '#E8F5FF', borderRadius: 36, height: 72, justifyContent: 'center', width: 72 },
  avatarText: { color: STAFF_COLORS.blue, fontSize: 20, fontWeight: '800' },
  overviewCopy: { marginLeft: 16 },
  patientName: { color: STAFF_COLORS.navy, fontSize: 23, fontWeight: '800' },
  meta: { color: STAFF_COLORS.muted, fontSize: 14, marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  helper: { color: STAFF_COLORS.muted, fontSize: 14, lineHeight: 21, marginBottom: 14 },
  subForm: { borderTopColor: '#EDF2F7', borderTopWidth: 1, marginTop: 20, paddingTop: 18 },
  fileActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dataRow: { borderTopColor: '#EDF2F7', borderTopWidth: 1, marginTop: 14, paddingTop: 12 },
  dataTitle: { color: STAFF_COLORS.navy, fontSize: 14, fontWeight: '800' },
  dataDetail: { color: STAFF_COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
});
