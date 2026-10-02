import { Link } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, STAFF_COLORS } from '@/components/staff-ui';

export default function StaffIndex() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.brandRow}><View style={styles.brandIcon}><Ionicons name="heart-outline" size={20} color="#FFFFFF" /></View><Text style={styles.brand}>CareLoop</Text></View>
        <Text style={styles.eyebrow}>THE CARE-TEAM WORKSPACE</Text>
        <Text style={styles.title}>One place for every patient follow-up.</Text>
        <Text style={styles.subtitle}>A simple care-management workspace for administrators, doctors, and clinic staff.</Text>
        <View style={styles.actions}>
          <Link asChild href="/staff/dashboard"><PrimaryButton label="Open workspace" onPress={() => undefined} /></Link>
          <Link asChild href="/staff/signup"><PrimaryButton label="Create staff account" onPress={() => undefined} secondary /></Link>
        </View>
        <View style={styles.featureGrid}>
          <Feature icon="people-outline" title="Patient records" body="Appointments, tests, reports, medicines, and plans." />
          <Feature icon="git-network-outline" title="Team allocation" body="Assign patients to the right doctor or care team." />
          <Feature icon="link-outline" title="Patient connection" body="Generate a secure code for the CareLoop patient app." />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Feature({ icon, title, body }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }) {
  return <View style={styles.feature}><Ionicons name={icon} size={23} color={STAFF_COLORS.blue} /><Text style={styles.featureTitle}>{title}</Text><Text style={styles.featureBody}>{body}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: STAFF_COLORS.pale, flex: 1 },
  hero: { alignSelf: 'center', maxWidth: 1120, padding: 36, paddingTop: 46, width: '100%' },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 74 },
  brandIcon: { alignItems: 'center', backgroundColor: STAFF_COLORS.blue, borderRadius: 10, height: 34, justifyContent: 'center', width: 34 },
  brand: { color: STAFF_COLORS.navy, fontSize: 23, fontWeight: '800' },
  eyebrow: { color: STAFF_COLORS.blue, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: STAFF_COLORS.navy, fontSize: 48, fontWeight: '800', letterSpacing: -1.8, lineHeight: 55, marginTop: 16, maxWidth: 720 },
  subtitle: { color: STAFF_COLORS.muted, fontSize: 18, lineHeight: 28, marginTop: 16, maxWidth: 650 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 28 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 76 },
  feature: { backgroundColor: '#FFFFFF', borderColor: STAFF_COLORS.border, borderRadius: 14, borderWidth: 1, flex: 1, minWidth: 220, padding: 22 },
  featureTitle: { color: STAFF_COLORS.navy, fontSize: 16, fontWeight: '800', marginTop: 19 },
  featureBody: { color: STAFF_COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
});
