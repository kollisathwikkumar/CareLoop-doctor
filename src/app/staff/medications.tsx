import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DateTimeField, Field, Notice, PrimaryButton, Section, SelectField, StaffShell, STAFF_COLORS } from '@/components/staff-ui';
import { createMedication, listMedications, listPatients, type Medication, type Patient } from '@/lib/staff';

type MedicationRow = Medication & { patientName: string };

export default function StaffMedicationsScreen() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [patientId, setPatientId] = useState('');
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [instructions, setInstructions] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<'current' | 'past'>('current');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = async () => { const nextPatients = await listPatients(); const entries = await Promise.all(nextPatients.map(async (patient) => ({ patient, medications: await listMedications(patient.id) }))); setPatients(nextPatients); setMedications(entries.flatMap(({ patient, medications: items }) => items.map((item) => ({ ...item, patientName: `${patient.first_name} ${patient.last_name}` })))); if (!patientId && nextPatients[0]) setPatientId(nextPatients[0].id); };
  useEffect(() => {
    void (async () => {
      try { await refresh(); } catch (reason) { setMessage((reason as Error).message); } finally { setLoading(false); }
    })();
    // The screen owns this initial data load; refresh is also used by create actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const currentCount = useMemo(() => medications.filter((item) => item.status === 'current').length, [medications]);
  const run = async () => { setMessage(''); if (!patientId || !name.trim() || !dosage.trim() || !instructions.trim() || !startDate.trim()) { setMessage('Patient, medication name, dosage, instructions, and start date are required.'); return; } setBusy(true); try { await createMedication({ patient_id: patientId, name: name.trim(), dosage: dosage.trim(), instructions: instructions.trim(), start_date: startDate.trim(), end_date: endDate.trim() || null, status }); setName(''); setDosage(''); setInstructions(''); setStartDate(''); setEndDate(''); setStatus('current'); await refresh(); setMessage('Medication added.'); } catch (reason) { setMessage((reason as Error).message); } finally { setBusy(false); } };
  const patientLabels = Object.fromEntries(patients.map((patient) => [patient.id, `${patient.first_name} ${patient.last_name}`]));
  return <StaffShell title="Medications">
    {message ? <Notice message={message} error={message.includes('required')} /> : null}
    <View style={styles.summary}><View><Text style={styles.eyebrow}>MEDICATIONS</Text><Text style={styles.heroTitle}>Medication workspace</Text><Text style={styles.heroCopy}>Keep current and past medicines clear for every care team.</Text></View><View style={styles.metric}><Text style={styles.metricValue}>{currentCount}</Text><Text style={styles.metricLabel}>current medicines</Text></View></View>
    <Section title="Add medication"><View style={styles.row}><SelectField inline label="Patient *" onChange={setPatientId} optionLabels={patientLabels} options={['', ...patients.map((patient) => patient.id)]} value={patientId} /><Field inline label="Medication name *" onChangeText={setName} placeholder="Metformin" value={name} /></View><View style={styles.row}><Field inline label="Dosage *" onChangeText={setDosage} placeholder="500 mg" value={dosage} /><Field inline label="Instructions *" onChangeText={setInstructions} placeholder="After breakfast" value={instructions} /></View><View style={styles.row}><DateTimeField inline kind="date" label="Start date *" onChangeText={setStartDate} placeholder="Choose start date" value={startDate} /><DateTimeField inline kind="date" label="End date" onChangeText={setEndDate} placeholder="Choose end date" value={endDate} /><SelectField inline label="Medication state" onChange={(value) => setStatus(value as 'current' | 'past')} options={['current', 'past']} value={status} /></View><PrimaryButton disabled={busy} label={busy ? 'Saving…' : 'Add medication'} onPress={() => void run()} /></Section>
    <Section title="Medication list"><ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.tableInner}><View style={styles.listHeader}><Text style={styles.heading}>Medicine</Text><Text style={styles.heading}>Patient</Text><Text style={styles.heading}>Schedule</Text><Text style={styles.heading}>State</Text></View>{loading ? <ActivityIndicator color={STAFF_COLORS.blue} /> : medications.length === 0 ? <Text style={styles.empty}>No medications recorded yet.</Text> : medications.map((item) => <View key={item.id} style={styles.medRow}><View style={styles.medMain}><Text style={styles.title}>{item.name}</Text><Text style={styles.detail}>{item.dosage}</Text></View><Text style={styles.tableText}>{item.patientName}</Text><Text style={styles.tableText}>{item.instructions}{item.end_date ? ` · until ${item.end_date}` : ''}</Text><View style={[styles.pill, item.status === 'current' ? styles.current : styles.past]}><Text style={styles.pillText}>{item.status}</Text></View></View>)}</View></ScrollView></Section>
  </StaffShell>;
}

const styles = StyleSheet.create({ tableInner: { minWidth: 720, width: '100%' }, summary: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: STAFF_COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 18, padding: 22 }, eyebrow: { color: STAFF_COLORS.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, heroTitle: { color: STAFF_COLORS.navy, fontSize: 23, fontWeight: '800', marginTop: 5 }, heroCopy: { color: STAFF_COLORS.muted, fontSize: 13, marginTop: 5 }, metric: { alignItems: 'flex-end' }, metricValue: { color: STAFF_COLORS.navy, fontSize: 28, fontWeight: '800' }, metricLabel: { color: STAFF_COLORS.muted, fontSize: 12 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, listHeader: { borderBottomColor: '#E8EEF5', borderBottomWidth: 1, flexDirection: 'row', gap: 16, paddingBottom: 9 }, heading: { color: '#91A0B3', flex: 1, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }, medRow: { alignItems: 'center', borderBottomColor: '#EDF2F7', borderBottomWidth: 1, flexDirection: 'row', gap: 16, minHeight: 68 }, medMain: { flex: 1 }, title: { color: STAFF_COLORS.navy, fontSize: 14, fontWeight: '800' }, detail: { color: STAFF_COLORS.muted, fontSize: 12, marginTop: 3 }, tableText: { color: '#526274', flex: 1, fontSize: 13 }, pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }, current: { backgroundColor: '#E7F8F0' }, past: { backgroundColor: '#F1F3F6' }, pillText: { color: STAFF_COLORS.navy, fontSize: 11, fontWeight: '800', textTransform: 'capitalize' }, empty: { color: STAFF_COLORS.muted, paddingVertical: 12 } });
