import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { DateTimeField, Field, localDateTimeToIso, Notice, PrimaryButton, Section, SelectField, StaffShell, STAFF_COLORS } from '@/components/staff-ui';
import { createAppointment, listAppointments, listPatients, listProfiles, type Appointment, type Patient, type StaffProfile } from '@/lib/staff';

export default function StaffAppointmentsScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [patient, setPatient] = useState('');
  const [doctor, setDoctor] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [purpose, setPurpose] = useState('');
  const [status, setStatus] = useState('upcoming');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { void Promise.all([listAppointments(), listPatients(), listProfiles()]).then(([nextAppointments, nextPatients, nextProfiles]) => { setAppointments(nextAppointments); setPatients(nextPatients); setProfiles(nextProfiles); }).catch((reason: Error) => setMessage(reason.message)).finally(() => setLoading(false)); }, []);

  const submit = async () => {
    setMessage('');
    if (!patient || !scheduledAt || !purpose) { setMessage('Patient, date/time, and purpose are required.'); return; }
    try {
      const appointment = await createAppointment({ patient_id: patient, doctor_id: doctor || null, scheduled_at: localDateTimeToIso(scheduledAt), purpose, status: status as Appointment['status'], notes });
      setAppointments((value) => [...value, appointment]); setPatient(''); setScheduledAt(''); setPurpose(''); setNotes(''); setMessage('Appointment scheduled.');
    } catch (reason) { setMessage((reason as Error).message); }
  };

  const patientLabels = Object.fromEntries(patients.map((item) => [item.id, `${item.first_name} ${item.last_name}`]));
  const doctorLabels = Object.fromEntries(profiles.filter((profile) => profile.role === 'doctor').map((profile) => [profile.id, profile.full_name]));
  return <StaffShell title="Appointments & follow-ups">
    {message ? <Notice error={!message.endsWith('.') || message.includes('required')} message={message} /> : null}
    <Section title="Schedule appointment"><SelectField label="Patient *" onChange={setPatient} optionLabels={patientLabels} options={['', ...patients.map((item) => item.id)]} value={patient} /><View style={styles.row}><DateTimeField inline kind="datetime-local" label="Date and time *" onChangeText={setScheduledAt} placeholder="Choose date and time" value={scheduledAt} /><Field inline label="Purpose *" onChangeText={setPurpose} placeholder="Follow-up review" value={purpose} /></View><View style={styles.row}><SelectField inline label="Doctor" onChange={setDoctor} optionLabels={doctorLabels} options={['', ...Object.keys(doctorLabels)]} value={doctor} /><SelectField inline label="Status" onChange={setStatus} options={['upcoming', 'completed', 'missed', 'cancelled', 'overdue']} value={status} /></View><Field label="Notes" multiline onChangeText={setNotes} placeholder="Preparation or next steps" value={notes} /><PrimaryButton label="Schedule" onPress={() => void submit()} /></Section>
    <Section title="Appointment queue">{loading ? <ActivityIndicator color={STAFF_COLORS.blue} /> : appointments.length === 0 ? <Text style={styles.empty}>No appointments recorded.</Text> : appointments.map((appointment) => <View key={appointment.id} style={styles.rowItem}><Text style={styles.title}>{patientLabels[appointment.patient_id] || 'Patient'}</Text><Text style={styles.detail}>{appointment.scheduled_at} · {appointment.purpose} · {appointment.status}</Text></View>)}</Section>
  </StaffShell>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  rowItem: { borderTopColor: '#EDF2F7', borderTopWidth: 1, paddingVertical: 14 },
  title: { color: STAFF_COLORS.navy, fontSize: 15, fontWeight: '800' },
  detail: { color: STAFF_COLORS.muted, fontSize: 13, marginTop: 4 },
  empty: { color: STAFF_COLORS.muted },
});
