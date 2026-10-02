import { Link, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Field, Notice, PrimaryButton, SelectField, STAFF_COLORS } from '@/components/staff-ui';
import { resendStaffConfirmation, signUpStaff } from '@/lib/staff';

export default function StaffSignupScreen() {
  const router = useRouter();
  const [role, setRole] = useState<'doctor' | 'staff'>('doctor');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [department, setDepartment] = useState('');
  const [workplace, setWorkplace] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [location, setLocation] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setMessage('');
    setConfirmationEmail('');
    const required = [fullName, email, phone, age, workplace, experienceYears, location, password, confirmPassword];
    if (required.some((value) => !value.trim())) {
      setMessage('Complete all required fields before creating your account.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMessage('Enter a valid work email address.');
      return;
    }
    if (password.length < 8) {
      setMessage('Password must contain at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }
    const ageNumber = Number(age);
    const experienceNumber = Number(experienceYears);
    if (!Number.isInteger(ageNumber) || ageNumber < 18 || !Number.isInteger(experienceNumber) || experienceNumber < 0) {
      setMessage('Enter a valid age and years of experience.');
      return;
    }
    setBusy(true);
    const { data, error } = await signUpStaff({ accountType: role, fullName, email, password, phone, age: ageNumber, specialty, department, workplace, experienceYears: experienceNumber, location });
    setBusy(false);
    if (error) {
      setMessage(error.message.includes('already registered') ? 'That email is already registered. Sign in instead.' : error.message);
      return;
    }
    if (!data.session) {
      setConfirmationEmail(email.trim().toLowerCase());
      setMessage('Account created. Check your email and use the confirmation link to open the dashboard.');
      return;
    }
    router.replace('/staff/dashboard');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.brandRow}><View style={styles.brandIcon}><Ionicons name="heart-outline" size={20} color="#FFFFFF" /></View><Text style={styles.brand}>CareLoop</Text></View>
            <Text style={styles.title}>Create a care-team account</Text>
            <Text style={styles.subtitle}>Register as a doctor or clinic staff member. Your unique staff code is created automatically.</Text>
            {message ? <Notice error={message.startsWith('Account created') ? false : true} message={message} /> : null}
            {confirmationEmail ? <View style={styles.resend}><Text style={styles.resendHint}>No email yet?</Text><PrimaryButton disabled={busy} label={busy ? 'Sending…' : 'Resend confirmation email'} onPress={() => { setBusy(true); void resendStaffConfirmation(confirmationEmail).then(({ error }) => setMessage(error ? error.message : 'Confirmation email resent. Check inbox and spam.')).finally(() => setBusy(false)); }} secondary /></View> : null}
            <SelectField label="Account type" onChange={(value) => setRole(value as 'doctor' | 'staff')} options={['doctor', 'staff']} value={role} />
            <View style={styles.row}><Field inline label="Full name *" onChangeText={setFullName} placeholder="Your full name" value={fullName} /><Field inline keyboardType="email-address" label="Work email *" onChangeText={setEmail} placeholder="you@clinic.org" value={email} /></View>
            <View style={styles.row}><Field inline keyboardType="phone-pad" label="Phone *" onChangeText={setPhone} placeholder="+91 98765 43210" value={phone} /><Field inline keyboardType="numeric" label="Age *" onChangeText={setAge} placeholder="34" value={age} /></View>
            <View style={styles.row}><Field inline label="Specialty" onChangeText={setSpecialty} placeholder="General Medicine" value={specialty} /><Field inline label="Department" onChangeText={setDepartment} placeholder="Outpatient care" value={department} /></View>
            <View style={styles.row}><Field inline label="Workplace *" onChangeText={setWorkplace} placeholder="City Care Hospital" value={workplace} /><Field inline keyboardType="numeric" label="Experience (years) *" onChangeText={setExperienceYears} placeholder="8" value={experienceYears} /></View>
            <Field label="Location *" onChangeText={setLocation} placeholder="Hyderabad" value={location} />
            <View style={styles.row}><Field inline label="Password *" onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry value={password} /><Field inline label="Confirm password *" onChangeText={setConfirmPassword} placeholder="Repeat password" secureTextEntry value={confirmPassword} /></View>
            <PrimaryButton disabled={busy} label={busy ? 'Creating account…' : 'Create account'} onPress={() => void submit()} />
            <View style={styles.footerRow}><Text style={styles.footerText}>Already registered?</Text><Link href="/staff/login" style={styles.link}>Sign in</Link></View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: STAFF_COLORS.pale, flex: 1 },
  flex: { flex: 1 },
  container: { alignItems: 'center', padding: 24, paddingVertical: 42 },
  card: { backgroundColor: '#FFFFFF', borderColor: STAFF_COLORS.border, borderRadius: 20, borderWidth: 1, maxWidth: 900, padding: 36, width: '100%' },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  brandIcon: { alignItems: 'center', backgroundColor: STAFF_COLORS.blue, borderRadius: 10, height: 34, justifyContent: 'center', width: 34 },
  brand: { color: STAFF_COLORS.navy, fontSize: 23, fontWeight: '800', letterSpacing: -0.6 },
  title: { color: STAFF_COLORS.navy, fontSize: 32, fontWeight: '800', letterSpacing: -1, marginTop: 36 },
  subtitle: { color: STAFF_COLORS.muted, fontSize: 15, lineHeight: 22, marginBottom: 22, marginTop: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  resend: { alignItems: 'flex-start', gap: 8, marginTop: 14 },
  resendHint: { color: STAFF_COLORS.muted, fontSize: 13 },
  footerRow: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 22 },
  footerText: { color: STAFF_COLORS.muted, fontSize: 14 },
  link: { color: STAFF_COLORS.blue, fontSize: 14, fontWeight: '700' },
});
