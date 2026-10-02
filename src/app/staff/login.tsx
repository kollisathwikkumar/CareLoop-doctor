import { Link, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { Field, Notice, PrimaryButton, STAFF_COLORS } from '@/components/staff-ui';
import { getCurrentStaff, signInStaff } from '@/lib/staff';

export default function StaffLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setMessage('');
    if (!email.trim() || !password) {
      setMessage('Enter your registered email and password.');
      return;
    }
    setBusy(true);
    const { error } = await signInStaff(email, password);
    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }
    const profile = await getCurrentStaff();
    setBusy(false);
    if (!profile) {
      setMessage('Your account is not activated for the care-team workspace yet. An organisation administrator must assign it to a care team.');
      return;
    }
    router.replace('/staff/dashboard');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.center}>
        <View style={styles.card}>
          <View style={styles.brandRow}><View style={styles.brandIcon}><Ionicons name="heart-outline" size={20} color="#FFFFFF" /></View><Text style={styles.brand}>CareLoop</Text></View>
          <Text style={styles.eyebrow}>CARE-TEAM WORKSPACE</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to manage patients, appointments, tests, and follow-ups.</Text>
          {message ? <Notice error message={message} /> : null}
          <Field keyboardType="email-address" label="Work email" onChangeText={setEmail} placeholder="you@clinic.org" value={email} />
          <Field label="Password" onChangeText={setPassword} placeholder="Your password" secureTextEntry value={password} />
          <PrimaryButton disabled={busy} label={busy ? 'Signing in…' : 'Sign in'} onPress={() => void submit()} />
          <View style={styles.footerRow}><Text style={styles.footerText}>New to CareLoop?</Text><Link href="/staff/signup" style={styles.link}>Create a staff account</Link></View>
          <Text style={styles.patientNote}>Patient app remains available at the normal app entry point.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: STAFF_COLORS.pale, flex: 1 },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#FFFFFF', borderColor: STAFF_COLORS.border, borderRadius: 20, borderWidth: 1, maxWidth: 480, padding: 36, width: '100%' },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  brandIcon: { alignItems: 'center', backgroundColor: STAFF_COLORS.blue, borderRadius: 10, height: 34, justifyContent: 'center', width: 34 },
  brand: { color: STAFF_COLORS.navy, fontSize: 23, fontWeight: '800', letterSpacing: -0.6 },
  eyebrow: { color: STAFF_COLORS.blue, fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginTop: 38 },
  title: { color: STAFF_COLORS.navy, fontSize: 32, fontWeight: '800', letterSpacing: -1, marginTop: 9 },
  subtitle: { color: STAFF_COLORS.muted, fontSize: 15, lineHeight: 22, marginBottom: 22, marginTop: 8 },
  footerRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 22 },
  footerText: { color: STAFF_COLORS.muted, fontSize: 14 },
  link: { color: STAFF_COLORS.blue, fontSize: 14, fontWeight: '700' },
  patientNote: { borderTopColor: STAFF_COLORS.border, borderTopWidth: 1, color: STAFF_COLORS.muted, fontSize: 11, lineHeight: 18, marginTop: 28, paddingTop: 17 },
});
