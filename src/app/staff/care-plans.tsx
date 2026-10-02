import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DateTimeField, Field, Notice, PrimaryButton, Section, SelectField, StaffShell, STAFF_COLORS } from '@/components/staff-ui';
import { createCarePlan, listCarePlans, listPatients, listProfiles, type CarePlan, type Patient, type StaffProfile } from '@/lib/staff';

type PlanRow = CarePlan & { patientName: string; ownerName: string };

export default function StaffCarePlansScreen() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [patientId, setPatientId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [actions, setActions] = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = async () => { const [nextPatients, nextProfiles] = await Promise.all([listPatients(), listProfiles()]); const entries = await Promise.all(nextPatients.map(async (patient) => ({ patient, plans: await listCarePlans(patient.id) }))); const ownerLabels = Object.fromEntries(nextProfiles.map((profile) => [profile.id, profile.full_name])); setPatients(nextPatients); setProfiles(nextProfiles); setPlans(entries.flatMap(({ patient, plans: items }) => items.map((item) => ({ ...item, patientName: `${patient.first_name} ${patient.last_name}`, ownerName: ownerLabels[item.responsible_profile_id || ''] || 'Unassigned' })))); if (!patientId && nextPatients[0]) setPatientId(nextPatients[0].id); };
  useEffect(() => {
    void (async () => {
      try { await refresh(); } catch (reason) { setMessage((reason as Error).message); } finally { setLoading(false); }
    })();
    // The screen owns this initial data load; refresh is also used by create actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const activeCount = useMemo(() => plans.filter((plan) => plan.status === 'active').length, [plans]);
  const submit = async () => { setMessage(''); if (!patientId || !title.trim() || !goal.trim() || !actions.trim() || !reviewDate.trim()) { setMessage('Patient, title, goal, actions, and review date are required.'); return; } setBusy(true); try { await createCarePlan({ patient_id: patientId, title: title.trim(), goal: goal.trim(), actions: actions.trim(), review_date: reviewDate.trim(), status: 'active', responsible_profile_id: ownerId || null }); setTitle(''); setGoal(''); setActions(''); setReviewDate(''); setOwnerId(''); await refresh(); setMessage('Care plan created.'); } catch (reason) { setMessage((reason as Error).message); } finally { setBusy(false); } };
  const patientLabels = Object.fromEntries(patients.map((patient) => [patient.id, `${patient.first_name} ${patient.last_name}`]));
  const profileLabels = Object.fromEntries(profiles.map((profile) => [profile.id, profile.full_name]));
  return <StaffShell title="Care plans">
    {message ? <Notice message={message} error={message.includes('required')} /> : null}
    <View style={styles.summary}><View><Text style={styles.eyebrow}>CONTINUITY OF CARE</Text><Text style={styles.heroTitle}>Care plans</Text><Text style={styles.heroCopy}>Turn goals into visible actions with a clear review date and owner.</Text></View><View style={styles.metric}><Text style={styles.metricValue}>{activeCount}</Text><Text style={styles.metricLabel}>active plans</Text></View></View>
    <Section title="Create care plan"><View style={styles.row}><SelectField inline label="Patient *" onChange={setPatientId} optionLabels={patientLabels} options={['', ...patients.map((patient) => patient.id)]} value={patientId} /><Field inline label="Plan title *" onChangeText={setTitle} placeholder="Recovery follow-up" value={title} /></View><Field label="Goal *" onChangeText={setGoal} placeholder="Maintain stable readings" value={goal} /><Field label="Actions *" multiline onChangeText={setActions} placeholder="Weekly check-in and appointment review" value={actions} /><View style={styles.row}><DateTimeField inline kind="date" label="Review date *" onChangeText={setReviewDate} placeholder="Choose review date" value={reviewDate} /><SelectField inline label="Responsible team member" onChange={setOwnerId} optionLabels={profileLabels} options={['', ...profiles.map((profile) => profile.id)]} value={ownerId} /></View><PrimaryButton disabled={busy} label={busy ? 'Saving…' : 'Create care plan'} onPress={() => void submit()} /></Section>
    <Section title="Plan board"><ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.tableInner}><View style={styles.listHeader}><Text style={styles.heading}>Plan</Text><Text style={styles.heading}>Patient</Text><Text style={styles.heading}>Owner</Text><Text style={styles.heading}>Review</Text></View>{loading ? <ActivityIndicator color={STAFF_COLORS.blue} /> : plans.length === 0 ? <Text style={styles.empty}>No care plans created yet.</Text> : plans.map((plan) => <View key={plan.id} style={styles.planRow}><View style={styles.planMain}><Text style={styles.title}>{plan.title}</Text><Text style={styles.detail}>{plan.goal}</Text><Text style={styles.actions}>{plan.actions}</Text></View><Text style={styles.tableText}>{plan.patientName}</Text><Text style={styles.tableText}>{plan.ownerName}</Text><View><Text style={styles.review}>{plan.review_date}</Text><Text style={styles.status}>{plan.status}</Text></View></View>)}</View></ScrollView></Section>
  </StaffShell>;
}

const styles = StyleSheet.create({ tableInner: { minWidth: 720, width: '100%' }, summary: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: STAFF_COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 18, padding: 22 }, eyebrow: { color: STAFF_COLORS.blue, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, heroTitle: { color: STAFF_COLORS.navy, fontSize: 23, fontWeight: '800', marginTop: 5 }, heroCopy: { color: STAFF_COLORS.muted, fontSize: 13, marginTop: 5 }, metric: { alignItems: 'flex-end' }, metricValue: { color: STAFF_COLORS.navy, fontSize: 28, fontWeight: '800' }, metricLabel: { color: STAFF_COLORS.muted, fontSize: 12 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, listHeader: { borderBottomColor: '#E8EEF5', borderBottomWidth: 1, flexDirection: 'row', gap: 16, paddingBottom: 9 }, heading: { color: '#91A0B3', flex: 1, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }, planRow: { borderBottomColor: '#EDF2F7', borderBottomWidth: 1, flexDirection: 'row', gap: 16, minHeight: 84, paddingVertical: 14 }, planMain: { flex: 1.3 }, title: { color: STAFF_COLORS.navy, fontSize: 14, fontWeight: '800' }, detail: { color: STAFF_COLORS.muted, fontSize: 13, marginTop: 4 }, actions: { color: '#526274', fontSize: 12, lineHeight: 17, marginTop: 5 }, tableText: { color: '#526274', flex: 1, fontSize: 13 }, review: { color: STAFF_COLORS.navy, fontSize: 13, fontWeight: '700' }, status: { color: STAFF_COLORS.blue, fontSize: 11, marginTop: 4, textTransform: 'capitalize' }, empty: { color: STAFF_COLORS.muted, paddingVertical: 12 } });
