import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Field, Notice, PrimaryButton, Section, SelectField, StaffShell, STAFF_COLORS } from '@/components/staff-ui';
import { createPatient, listPatients, listProfiles, type Patient, type StaffProfile } from '@/lib/staff';

const tabs = ['All patients', 'Needs follow-up', 'Recently added'];

export default function StaffPatientsScreen() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('All patients');
  const [showForm, setShowForm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [condition, setCondition] = useState('');
  const [doctor, setDoctor] = useState('');
  const [staff, setStaff] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = async (term = search) => {
    setLoading(true);
    try {
      setPatients(await listPatients(term));
    } catch (reason) {
      setMessage((reason as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([listPatients(), listProfiles()])
      .then(([nextPatients, nextProfiles]) => {
        setPatients(nextPatients);
        setProfiles(nextProfiles);
      })
      .catch((reason: Error) => setMessage(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    setMessage('');
    if (!firstName.trim() || !lastName.trim()) {
      setMessage('First name and last name are required.');
      return;
    }
    setSaving(true);
    try {
      await createPatient({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dateOfBirth || null,
        phone: phone || null,
        email: email || null,
        condition: condition || null,
        notes: null,
        assigned_doctor_id: doctor || null,
        assigned_staff_id: staff || null,
        auth_user_id: null,
        created_at: new Date().toISOString(),
      });
      setFirstName('');
      setLastName('');
      setDateOfBirth('');
      setPhone('');
      setEmail('');
      setCondition('');
      setDoctor('');
      setStaff('');
      setShowForm(false);
      setMessage('Patient created and allocated.');
      await refresh('');
    } catch (reason) {
      setMessage((reason as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const doctors = profiles.filter((profile) => profile.role === 'doctor');
  const team = profiles.filter((profile) => profile.role === 'staff');
  const visiblePatients = useMemo(() => {
    if (activeTab === 'Recently added') return patients.slice(0, 3);
    if (activeTab === 'Needs follow-up') return patients.filter((patient) => patient.condition || patient.notes);
    return patients;
  }, [activeTab, patients]);

  return (
    <StaffShell title="Patients">
      {message ? <Notice message={message} error={!message.includes('created')} /> : null}

      <View style={styles.heroRow}>
        <View>
          <Text style={styles.eyebrow}>CARE DIRECTORY</Text>
          <Text style={styles.heroTitle}>Your patient panel</Text>
          <Text style={styles.heroCopy}>Keep every patient, care owner, and follow-up in one calm workspace.</Text>
        </View>
        <View style={styles.heroMetric}>
          <Text style={styles.heroMetricValue}>{patients.length}</Text>
          <Text style={styles.heroMetricLabel}>active records</Text>
        </View>
      </View>

      <Section title="Patient directory" action={<PrimaryButton label={showForm ? 'Close form' : 'Add patient'} onPress={() => setShowForm((value) => !value)} />}>
        <View style={styles.toolbar}>
          <View style={styles.tabRow}>
            {tabs.map((tab) => (
              <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && styles.activeTab]}>
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.searchWrap}>
            <Field label="Search" onChangeText={(value) => { setSearch(value); void refresh(value); }} placeholder="Search name, phone, or condition" value={search} />
          </View>
        </View>

        {showForm ? (
          <View style={styles.form}>
            <Text style={styles.formTitle}>Add a patient record</Text>
            <Text style={styles.formCopy}>Create the record first, then assign the care team responsible for follow-up.</Text>
            <View style={styles.row}>
              <Field inline label="First name *" onChangeText={setFirstName} placeholder="Asha" value={firstName} />
              <Field inline label="Last name *" onChangeText={setLastName} placeholder="Sharma" value={lastName} />
            </View>
            <View style={styles.row}>
              <Field inline label="Date of birth" onChangeText={setDateOfBirth} placeholder="1990-04-12" value={dateOfBirth} />
              <Field inline keyboardType="phone-pad" label="Phone" onChangeText={setPhone} placeholder="+91 98765 43210" value={phone} />
            </View>
            <View style={styles.row}>
              <Field inline keyboardType="email-address" label="Email" onChangeText={setEmail} placeholder="patient@example.com" value={email} />
              <Field inline label="Condition / care area" onChangeText={setCondition} placeholder="Follow-up care" value={condition} />
            </View>
            <View style={styles.row}>
              <SelectField inline label="Assign doctor" onChange={setDoctor} optionLabels={Object.fromEntries(doctors.map((profile) => [profile.id, profile.full_name]))} options={['', ...doctors.map((profile) => profile.id)]} value={doctor} />
              <SelectField inline label="Assign staff member" onChange={setStaff} optionLabels={Object.fromEntries(team.map((profile) => [profile.id, profile.full_name]))} options={['', ...team.map((profile) => profile.id)]} value={staff} />
            </View>
            <PrimaryButton disabled={saving} label={saving ? 'Saving…' : 'Create patient'} onPress={() => void submit()} />
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScroll}>
          <View style={styles.tableInner}>
            <View style={styles.listHeader}>
              <Text style={styles.listHeading}>Patient</Text>
              <Text style={styles.listHeading}>Care area</Text>
              <Text style={styles.listHeading}>Care team</Text>
              <Text style={styles.listHeading}>Status</Text>
            </View>
            {loading ? <ActivityIndicator color={STAFF_COLORS.blue} style={styles.loader} /> : visiblePatients.length === 0 ? <Text style={styles.empty}>No matching patients.</Text> : visiblePatients.map((patient) => <PatientRow key={patient.id} patient={patient} onPress={() => router.push({ pathname: '/staff/patients/[id]', params: { id: patient.id } })} />)}
          </View>
        </ScrollView>
      </Section>
    </StaffShell>
  );
}

function PatientRow({ patient, onPress }: { patient: Patient; onPress: () => void }) {
  const initials = `${patient.first_name[0] ?? ''}${patient.last_name[0] ?? ''}`;
  return (
    <Pressable onPress={onPress} style={styles.patientRow}>
      <View style={styles.patientCell}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <View style={styles.copy}><Text style={styles.name}>{patient.first_name} {patient.last_name}</Text><Text style={styles.meta}>{patient.phone || patient.email || 'Contact details not added'}</Text></View>
      </View>
      <Text style={styles.tableText}>{patient.condition || 'General care'}</Text>
      <Text style={styles.tableText}>Assigned team</Text>
      <View style={styles.statusPill}><Text style={styles.statusText}>Active</Text></View>
      <Ionicons name="chevron-forward" size={18} color={STAFF_COLORS.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroRow: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: STAFF_COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 18, paddingHorizontal: 22, paddingVertical: 18 },
  eyebrow: { color: STAFF_COLORS.blue, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { color: STAFF_COLORS.navy, fontSize: 23, fontWeight: '800', marginTop: 5 },
  heroCopy: { color: STAFF_COLORS.muted, fontSize: 13, marginTop: 5 },
  heroMetric: { alignItems: 'flex-end' },
  heroMetricValue: { color: STAFF_COLORS.navy, fontSize: 28, fontWeight: '800' },
  heroMetricLabel: { color: STAFF_COLORS.muted, fontSize: 12, marginTop: 2 },
  toolbar: { alignItems: 'flex-end', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tab: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  activeTab: { backgroundColor: '#E8F5FF' },
  tabText: { color: STAFF_COLORS.muted, fontSize: 13, fontWeight: '700' },
  activeTabText: { color: STAFF_COLORS.blue },
  searchWrap: { minWidth: 260, width: '34%' },
  form: { backgroundColor: '#F7FBFF', borderColor: '#DCEEFF', borderRadius: 14, borderWidth: 1, marginBottom: 18, padding: 16 },
  formTitle: { color: STAFF_COLORS.navy, fontSize: 16, fontWeight: '800' },
  formCopy: { color: STAFF_COLORS.muted, fontSize: 13, marginBottom: 14, marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  tableScroll: { flexGrow: 1 },
  tableInner: { minWidth: 710, width: '100%' },
  listHeader: { borderBottomColor: '#E8EEF5', borderBottomWidth: 1, flexDirection: 'row', gap: 16, paddingBottom: 9, paddingHorizontal: 4 },
  listHeading: { color: '#91A0B3', flex: 1, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  patientRow: { alignItems: 'center', borderBottomColor: '#EDF2F7', borderBottomWidth: 1, flexDirection: 'row', gap: 16, minHeight: 70, paddingHorizontal: 4 },
  patientCell: { alignItems: 'center', flex: 1.4, flexDirection: 'row' },
  avatar: { alignItems: 'center', backgroundColor: '#E8F5FF', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  avatarText: { color: STAFF_COLORS.blue, fontWeight: '800' },
  copy: { flex: 1, marginLeft: 12 },
  name: { color: STAFF_COLORS.navy, fontSize: 14, fontWeight: '800' },
  meta: { color: STAFF_COLORS.muted, fontSize: 12, marginTop: 4 },
  tableText: { color: '#526274', flex: 1, fontSize: 13 },
  statusPill: { backgroundColor: '#E7F8F0', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { color: '#15865A', fontSize: 11, fontWeight: '800' },
  chevron: { color: STAFF_COLORS.muted, fontSize: 25, width: 12 },
  loader: { paddingVertical: 24 },
  empty: { color: STAFF_COLORS.muted, paddingVertical: 20 },
});
