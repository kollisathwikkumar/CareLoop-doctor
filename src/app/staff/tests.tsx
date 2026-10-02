import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { DateTimeField, Field, Notice, PrimaryButton, Section, SelectField, StaffShell, STAFF_COLORS } from '@/components/staff-ui';
import { createReport, createTest, getReportUrl, listPatients, listReports, listTests, uploadReportFile, type Patient, type Report, type Test } from '@/lib/staff';

type TestRow = Test & { patientName: string };
type ReportRowData = Report & { patientName: string };

export default function StaffTestsScreen() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [reports, setReports] = useState<ReportRowData[]>([]);
  const [patientId, setPatientId] = useState('');
  const [testName, setTestName] = useState('');
  const [testDate, setTestDate] = useState('');
  const [testStatus, setTestStatus] = useState<Test['status']>('pending');
  const [testNotes, setTestNotes] = useState('');
  const [reportTest, setReportTest] = useState('');
  const [reportName, setReportName] = useState('');
  const [reportPath, setReportPath] = useState('');
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const nextPatients = await listPatients();
    const entries = await Promise.all(nextPatients.map(async (patient) => ({ patient, tests: await listTests(patient.id), reports: await listReports(patient.id) })));
    setPatients(nextPatients);
    setTests(entries.flatMap(({ patient, tests: patientTests }) => patientTests.map((test) => ({ ...test, patientName: `${patient.first_name} ${patient.last_name}` }))));
    setReports(entries.flatMap(({ patient, reports: patientReports }) => patientReports.map((report) => ({ ...report, patientName: `${patient.first_name} ${patient.last_name}` }))));
    if (!patientId && nextPatients[0]) setPatientId(nextPatients[0].id);
    if (!reportTest && entries.flatMap((entry) => entry.tests)[0]) setReportTest(entries.flatMap((entry) => entry.tests)[0].id);
  };

  useEffect(() => {
    void (async () => {
      try { await refresh(); } catch (reason) { setMessage((reason as Error).message); } finally { setLoading(false); }
    })();
    // The screen owns this initial data load; refresh is also used by create actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (action: () => Promise<void>, success: string) => {
    setMessage('');
    setBusy(true);
    try { await action(); await refresh(); setMessage(success); } catch (reason) { setMessage((reason as Error).message); } finally { setBusy(false); }
  };

  const patientLabels = Object.fromEntries(patients.map((patient) => [patient.id, `${patient.first_name} ${patient.last_name}`]));
  const selectedTest = tests.find((test) => test.id === reportTest);
  const pendingCount = useMemo(() => tests.filter((test) => test.status !== 'completed').length, [tests]);

  const pickFile = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') { setMessage('Choose a report from the web workspace or enter its storage path manually.'); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = () => { const file = input.files?.[0]; if (file) { setReportFile(file); setReportName(file.name); setReportPath(''); } };
    input.click();
  };

  return (
    <StaffShell title="Tests & reports">
      {message ? <Notice message={message} error={message.includes('required') || message.includes('Choose')} /> : null}
      <View style={styles.summary}><View><Text style={styles.eyebrow}>INVESTIGATIONS</Text><Text style={styles.heroTitle}>Tests and reports</Text><Text style={styles.heroCopy}>Track every investigation from request to uploaded result.</Text></View><View style={styles.metric}><Text style={styles.metricValue}>{pendingCount}</Text><Text style={styles.metricLabel}>need attention</Text></View></View>

      <Section title="Add investigation">
        <View style={styles.row}><SelectField inline label="Patient *" onChange={setPatientId} optionLabels={patientLabels} options={['', ...patients.map((patient) => patient.id)]} value={patientId} /><Field inline label="Exact test name *" onChangeText={setTestName} placeholder="HbA1c" value={testName} /></View>
        <View style={styles.row}><DateTimeField inline kind="date" label="Test date *" onChangeText={setTestDate} placeholder="Choose test date" value={testDate} /><SelectField inline label="Status" onChange={(value) => setTestStatus(value as Test['status'])} options={['pending', 'completed', 'overdue']} value={testStatus} /></View>
        <Field label="Notes" multiline onChangeText={setTestNotes} placeholder="Clinical notes or preparation instructions" value={testNotes} />
        <PrimaryButton disabled={busy} label="Add test" onPress={() => void run(async () => { if (!patientId || !testName.trim() || !testDate.trim()) throw new Error('Patient, exact test name, and test date are required.'); await createTest({ patient_id: patientId, name: testName.trim(), test_date: testDate.trim(), status: testStatus, notes: testNotes.trim() || null }); setTestName(''); setTestDate(''); setTestNotes(''); }, 'Test added.')} />
      </Section>

      <Section title="Test queue" action={<Text style={styles.sectionHint}>{tests.length} investigations</Text>}>
        {loading ? <ActivityIndicator color={STAFF_COLORS.blue} /> : tests.length === 0 ? <Text style={styles.empty}>No investigations recorded yet.</Text> : tests.map((test) => <View key={test.id} style={styles.dataRow}><View style={styles.rowBetween}><View><Text style={styles.dataTitle}>{test.name}</Text><Text style={styles.dataDetail}>{test.patientName} · {test.test_date}</Text></View><StatusPill status={test.status} /></View>{test.notes ? <Text style={styles.note}>{test.notes}</Text> : null}</View>)}
      </Section>

      <Section title="Upload a report">
        <Text style={styles.helper}>Attach each result to the exact test so the patient record and app show the right report history.</Text>
        <SelectField label="Attach report to test *" onChange={setReportTest} optionLabels={Object.fromEntries(tests.map((test) => [test.id, `${test.patientName} · ${test.name}`]))} options={['', ...tests.map((test) => test.id)]} value={reportTest} />
        <View style={styles.row}><Field inline label="Report file name" onChangeText={setReportName} placeholder="hba1c-report.pdf" value={reportName} /><Field inline label="Report URL or storage path" onChangeText={setReportPath} placeholder="https://… or careloop-reports/…" value={reportPath} /></View>
        <View style={styles.actions}><PrimaryButton label={reportFile ? `Selected: ${reportFile.name}` : 'Choose report file'} onPress={pickFile} secondary /><PrimaryButton disabled={busy} label="Save report" onPress={() => void run(async () => { if (!reportTest || !selectedTest) throw new Error('Select a test first.'); if (reportFile) await uploadReportFile(selectedTest.patient_id, reportTest, reportFile); else { if (!reportName.trim() || !reportPath.trim()) throw new Error('Choose a file or provide report file details.'); await createReport({ patient_id: selectedTest.patient_id, test_id: reportTest, file_path: reportPath.trim(), file_name: reportName.trim(), mime_type: null }); } setReportName(''); setReportPath(''); setReportFile(null); }, 'Report saved.')} /></View>
        {reports.length === 0 ? <Text style={styles.empty}>No reports uploaded yet.</Text> : reports.map((report) => <ReportItem key={report.id} report={report} />)}
      </Section>
    </StaffShell>
  );
}

function StatusPill({ status }: { status: string }) { return <View style={[styles.status, status === 'completed' ? styles.completed : status === 'overdue' ? styles.overdue : styles.pending]}><Text style={styles.statusText}>{status}</Text></View>; }
function ReportItem({ report }: { report: ReportRowData }) { const [opening, setOpening] = useState(false); const open = async () => { setOpening(true); try { const url = report.file_path.startsWith('http') ? report.file_path : await getReportUrl(report.file_path); if (url.startsWith('http')) await Linking.openURL(url); } finally { setOpening(false); } }; return <Pressable onPress={() => void open()} style={styles.dataRow}><Text style={styles.dataTitle}>{report.file_name}</Text><Text style={styles.dataDetail}>{report.patientName} · {opening ? 'Opening…' : 'Open report'}</Text></Pressable>; }

const styles = StyleSheet.create({
  summary: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: STAFF_COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 18, padding: 22 },
  eyebrow: { color: STAFF_COLORS.blue, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { color: STAFF_COLORS.navy, fontSize: 23, fontWeight: '800', marginTop: 5 },
  heroCopy: { color: STAFF_COLORS.muted, fontSize: 13, marginTop: 5 },
  metric: { alignItems: 'flex-end' }, metricValue: { color: STAFF_COLORS.navy, fontSize: 28, fontWeight: '800' }, metricLabel: { color: STAFF_COLORS.muted, fontSize: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, rowBetween: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sectionHint: { color: STAFF_COLORS.muted, fontSize: 13 }, helper: { color: STAFF_COLORS.muted, fontSize: 14, lineHeight: 21, marginBottom: 14 },
  dataRow: { borderTopColor: '#EDF2F7', borderTopWidth: 1, marginTop: 14, paddingTop: 13 }, dataTitle: { color: STAFF_COLORS.navy, fontSize: 14, fontWeight: '800' }, dataDetail: { color: STAFF_COLORS.muted, fontSize: 13, marginTop: 4 }, note: { color: '#526274', fontSize: 13, marginTop: 7 },
  status: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }, pending: { backgroundColor: '#FFF4DE' }, overdue: { backgroundColor: '#FFF0F1' }, completed: { backgroundColor: '#E7F8F0' }, statusText: { color: STAFF_COLORS.navy, fontSize: 11, fontWeight: '800', textTransform: 'capitalize' }, empty: { color: STAFF_COLORS.muted, paddingVertical: 10 },
});
