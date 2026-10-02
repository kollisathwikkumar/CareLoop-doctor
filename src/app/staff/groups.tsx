import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { addPatientToGroup, createGroup, listGroups, listPatients, listProfiles, type Group, type Patient, type StaffProfile } from '@/lib/staff';
import { Field, Notice, PrimaryButton, Section, SelectField, StaffShell, STAFF_COLORS } from '@/components/staff-ui';

export default function StaffGroupsScreen() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [doctor, setDoctor] = useState('');
  const [staff, setStaff] = useState('');
  const [patient, setPatient] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void Promise.all([listGroups(), listPatients(), listProfiles()]).then(([nextGroups, nextPatients, nextProfiles]) => { setGroups(nextGroups); setPatients(nextPatients); setProfiles(nextProfiles); }).catch((reason: Error) => setMessage(reason.message)).finally(() => setLoading(false)); }, []);

  const submit = async () => {
    setMessage('');
    if (!name.trim()) { setMessage('Group name is required.'); return; }
    setSaving(true);
    try {
      const group = await createGroup({ name: name.trim(), description: description || null, assigned_doctor_id: doctor || null, assigned_staff_id: staff || null });
      if (patient) await addPatientToGroup(group.id, patient);
      setGroups((value) => [...value, group].sort((a, b) => a.name.localeCompare(b.name)));
      setName(''); setDescription(''); setDoctor(''); setStaff(''); setPatient(''); setMessage('Group created and allocation saved.');
    } catch (reason) { setMessage((reason as Error).message); } finally { setSaving(false); }
  };

  const profileLabels = Object.fromEntries(profiles.map((profile) => [profile.id, profile.full_name]));
  const patientLabels = Object.fromEntries(patients.map((item) => [item.id, `${item.first_name} ${item.last_name}`]));
  return <StaffShell title="Groups & allocation">
    {message ? <Notice error={!message.includes('saved') && !message.includes('created')} message={message} /> : null}
    <Section title="Create patient group"><Field label="Group name *" onChangeText={setName} placeholder="Hypertension follow-up" value={name} /><Field label="Description" multiline onChangeText={setDescription} placeholder="Patients needing monthly review" value={description} /><View style={styles.row}><SelectField inline label="Assign doctor" onChange={setDoctor} optionLabels={profileLabels} options={['', ...profiles.filter((profile) => profile.role === 'doctor').map((profile) => profile.id)]} value={doctor} /><SelectField inline label="Assign staff" onChange={setStaff} optionLabels={profileLabels} options={['', ...profiles.filter((profile) => profile.role === 'staff').map((profile) => profile.id)]} value={staff} /></View><SelectField label="Add a patient" onChange={setPatient} optionLabels={patientLabels} options={['', ...patients.map((item) => item.id)]} value={patient} /><PrimaryButton disabled={saving} label={saving ? 'Saving…' : 'Create group'} onPress={() => void submit()} /></Section>
    <Section title="Existing groups">{loading ? <ActivityIndicator color={STAFF_COLORS.blue} /> : groups.length === 0 ? <Text style={styles.empty}>No groups created yet.</Text> : groups.map((group) => <View key={group.id} style={styles.groupRow}><Text style={styles.groupName}>{group.name}</Text><Text style={styles.groupDescription}>{group.description || 'No description'}</Text><Text style={styles.groupMeta}>Doctor: {profileLabels[group.assigned_doctor_id || ''] || 'Unassigned'} · Staff: {profileLabels[group.assigned_staff_id || ''] || 'Unassigned'}</Text></View>)}</Section>
  </StaffShell>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  groupRow: { borderTopColor: '#EDF2F7', borderTopWidth: 1, paddingVertical: 14 },
  groupName: { color: STAFF_COLORS.navy, fontSize: 16, fontWeight: '800' },
  groupDescription: { color: STAFF_COLORS.muted, fontSize: 14, marginTop: 4 },
  groupMeta: { color: STAFF_COLORS.blue, fontSize: 13, marginTop: 6 },
  empty: { color: STAFF_COLORS.muted },
});
