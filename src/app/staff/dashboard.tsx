import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { Notice, Section, StaffShell, STAFF_COLORS } from '@/components/staff-ui';
import { decodeChatMessage, encodeChatMessage } from '@/lib/chat-message';
import { useStringTuneElement } from '@/lib/string-tune';
import { createConnectionInvitation, getCurrentStaff, getDashboardSummary, getReportUrl, listAppointments, listFollowUpQueue, listReports, listStaffChatMessages, listPatients, sendStaffChatMessage, type Appointment, type DashboardSummary, type FollowUpQueueItem, type Patient, type Report, type StaffChatMessage } from '@/lib/staff';

const EMPTY_SUMMARY: DashboardSummary = { patients: 0, appointments: 0, followUpsDue: 0, overdueAppointments: 0, pendingTests: 0, recentUpdates: 0 };

export default function StaffDashboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 820;
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [queue, setQueue] = useState<FollowUpQueueItem[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentStaffId, setCurrentStaffId] = useState('');
  const [connectionPatientId, setConnectionPatientId] = useState('');
  const [connectionCode, setConnectionCode] = useState('');
  const [connectionQr, setConnectionQr] = useState('');
  const [connectionExpiry, setConnectionExpiry] = useState('');
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [chatPatientId, setChatPatientId] = useState('');
  const [chatMessages, setChatMessages] = useState<StaffChatMessage[]>([]);
  const [chatReports, setChatReports] = useState<Report[]>([]);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void Promise.all([getDashboardSummary(), listFollowUpQueue({ limit: 12 }), listAppointments(), listPatients(), getCurrentStaff()])
      .then(([nextSummary, nextQueue, nextAppointments, nextPatients, nextStaff]) => {
        if (!active) return;
        setSummary(nextSummary);
        setQueue(nextQueue);
        setAppointments(nextAppointments);
        setPatients(nextPatients);
        setCurrentStaffId(nextStaff?.id ?? '');
        setConnectionPatientId((current) => current || nextPatients[0]?.id || '');
        setChatPatientId((current) => current || nextPatients[0]?.id || '');
      })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!chatPatientId) {
      return;
    }
    let active = true;
    void Promise.all([listStaffChatMessages(chatPatientId), listReports(chatPatientId)])
      .then(([nextMessages, nextReports]) => {
        if (!active) return;
        setChatMessages(nextMessages);
        setChatReports(nextReports);
        setSelectedReportId((current) => nextReports.some((report) => report.id === current) ? current : '');
      })
      .catch((reason: Error) => { if (active) setChatError(reason.message); })
      .finally(() => { if (active) setChatLoading(false); });
    return () => { active = false; };
  }, [chatPatientId]);

  const patientById = useMemo(() => new Map(patients.map((patient) => [patient.id, patient])), [patients]);
  const openQueue = queue.filter((item) => item.status === 'open' || item.status === 'in_progress');
  const overdueQueue = queue.filter((item) => item.is_overdue);
  const todayAppointments = appointments.filter((appointment) => appointment.status === 'upcoming').slice(0, 4);
  const connectionPatient = patients.find((patient) => patient.id === connectionPatientId);
  const chatPatient = patients.find((patient) => patient.id === chatPatientId);

  const generateConnectionQr = async (): Promise<void> => {
    if (!connectionPatientId || connectionBusy) return;
    setConnectionBusy(true);
    setError('');
    try {
      const invitation = await createConnectionInvitation(connectionPatientId);
      const qr = await QRCode.toDataURL(invitation.code, { errorCorrectionLevel: 'M', margin: 1, width: 192 });
      setConnectionCode(invitation.code);
      setConnectionQr(qr);
      setConnectionExpiry(invitation.expires_at);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setConnectionBusy(false);
    }
  };

  const refreshChat = async (): Promise<void> => {
    if (!chatPatientId) return;
    try {
      const [nextMessages, nextReports] = await Promise.all([listStaffChatMessages(chatPatientId), listReports(chatPatientId)]);
      setChatMessages(nextMessages);
      setChatReports(nextReports);
    } catch (reason) {
      setChatError((reason as Error).message);
    }
  };

  const sendChat = async (): Promise<void> => {
    const selectedReport = chatReports.find((report) => report.id === selectedReportId);
    if ((!chatDraft.trim() && !selectedReport) || !chatPatientId || chatBusy) return;
    setChatBusy(true);
    setChatError('');
    try {
      const body = encodeChatMessage({
        text: chatDraft,
        ...(selectedReport ? { attachment: { kind: 'report', name: selectedReport.file_name, filePath: selectedReport.file_path } } : {}),
      });
      await sendStaffChatMessage(chatPatientId, body);
      setChatDraft('');
      setSelectedReportId('');
      await refreshChat();
    } catch (reason) {
      setChatError((reason as Error).message);
    } finally {
      setChatBusy(false);
    }
  };

  return (
    <StaffShell title="Dashboard">
      {error ? <Notice error message={error} /> : null}
      <View style={[styles.hero, compact && styles.heroCompact]}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>TODAY’S CARE PRIORITIES · {new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()).toUpperCase()}</Text>
          <Text style={styles.heroTitle}>Keep every patient in the loop.</Text>
          <Text style={styles.heroBody}>A focused view of the patients, appointments, and follow-up actions that need your attention next.</Text>
        </View>
        <MagneticAction label="Open follow-up queue" onPress={() => router.push('/staff/appointments')} />
      </View>

      <View style={styles.metricRow}>
        <Metric label="Active patients" value={summary.patients} detail="in your care network" accent={STAFF_COLORS.blue} />
        <Metric label="Follow-ups due" value={openQueue.length || summary.followUpsDue} detail="open care actions" accent="#A2C83A" />
        <Metric label="Overdue" value={overdueQueue.length || summary.overdueAppointments} detail="need a response" accent="#C24845" />
        <Metric label="Reports to review" value={summary.pendingTests} detail="awaiting attention" accent="#8B70D8" />
      </View>

      <View style={styles.queueWrap}>
        <Section title="Follow-up queue" action={<Text style={styles.queueHint}>{openQueue.length} open · ordered by urgency</Text>}>
          <Text style={styles.sectionLead}>Prioritized by due date and urgency, with the next action and owner visible at a glance.</Text>
          {loading ? <ActivityIndicator color={STAFF_COLORS.blue} /> : openQueue.length === 0 ? <EmptyState label="No open follow-up tasks" /> : openQueue.map((item) => (
            <FollowUpRow key={item.task_id} item={item} onOpen={() => router.push({ pathname: '/staff/patients/[id]', params: { id: item.patient_id } })} />
          ))}
        </Section>
      </View>

      <View style={styles.columns}>
        <View style={styles.column}>
          <Section title="Upcoming appointments" action={<Text style={styles.queueHint}>{todayAppointments.length} shown</Text>}>
            {todayAppointments.length === 0 ? <EmptyState label="No upcoming appointments" /> : todayAppointments.map((appointment) => {
              const patient = patientById.get(appointment.patient_id);
              return <AppointmentRow key={appointment.id} appointment={appointment} patient={patient} onOpen={() => router.push({ pathname: '/staff/patients/[id]', params: { id: appointment.patient_id } })} />;
            })}
          </Section>
        </View>
        <View style={styles.column}>
          <Section title="Patient worklist" action={<Text style={styles.queueHint}>{patients.length} allocated</Text>}>
            {loading ? <ActivityIndicator color={STAFF_COLORS.blue} /> : patients.length === 0 ? <EmptyState label="No patients allocated yet" /> : patients.slice(0, 5).map((patient) => (
              <Pressable key={patient.id} onPress={() => router.push({ pathname: '/staff/patients/[id]', params: { id: patient.id } })} style={({ pressed }) => [styles.patientRow, pressed && styles.pressed]}>
                <Avatar name={`${patient.first_name} ${patient.last_name}`} />
                <View style={styles.patientCopy}><Text style={styles.patientName}>{patient.first_name} {patient.last_name}</Text><Text style={styles.patientMeta}>{patient.condition || 'Continuity review'} · {patient.phone || 'No phone'}</Text></View>
                <Ionicons name="arrow-forward" size={17} color={STAFF_COLORS.blue} />
              </Pressable>
            ))}
          </Section>
        </View>
      </View>

      <View style={styles.columns}>
        <View style={styles.column}>
          <Section title="Connect a patient">
            <Text style={styles.sectionLead}>Create a 24-hour QR invitation with a matching code for entry in the patient app.</Text>
            {patients.length === 0 ? <EmptyState label="Add a patient before creating a connection QR" /> : <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.patientChoices}>
                {patients.map((patient) => <PatientChoice key={patient.id} patient={patient} selected={patient.id === connectionPatientId} onPress={() => { setConnectionPatientId(patient.id); setConnectionCode(''); setConnectionQr(''); setConnectionExpiry(''); }} />)}
              </ScrollView>
              <View style={styles.qrPanel}>
                {connectionQr ? <Image accessibilityLabel={`Connection QR for ${connectionPatient ? `${connectionPatient.first_name} ${connectionPatient.last_name}` : 'patient'}`} source={{ uri: connectionQr }} style={styles.qrImage} /> : <View style={styles.qrPlaceholder}><Ionicons name="qr-code-outline" size={35} color={STAFF_COLORS.blue} /><Text style={styles.qrPlaceholderText}>QR invitation appears here</Text></View>}
                <View style={styles.qrCopy}>
                  <Text style={styles.qrTitle}>{connectionPatient ? `${connectionPatient.first_name} ${connectionPatient.last_name}` : 'Select a patient'}</Text>
                  <Text style={styles.patientMeta}>{connectionCode ? `Code · ${connectionCode}` : 'Private, one-time connection code'}</Text>
                  {connectionExpiry ? <Text style={styles.queueMeta}>Expires {new Date(connectionExpiry).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })}</Text> : null}
                  <Pressable accessibilityRole="button" disabled={!connectionPatientId || connectionBusy} onPress={() => void generateConnectionQr()} style={({ pressed }) => [styles.smallPrimary, (!connectionPatientId || connectionBusy) && styles.disabled, pressed && styles.pressed]}><Text style={styles.smallPrimaryText}>{connectionBusy ? 'Creating…' : connectionCode ? 'Generate new QR' : 'Generate QR'}</Text></Pressable>
                </View>
              </View>
            </>}
          </Section>
        </View>
        <View style={styles.column}>
          <Section title="Care team chat" action={<Pressable accessibilityRole="button" onPress={() => void refreshChat()} style={styles.refreshButton}><Ionicons name="refresh-outline" size={15} color={STAFF_COLORS.blue} /><Text style={styles.refreshText}>Refresh</Text></Pressable>}>
            <Text style={styles.sectionLead}>Message a patient and share reports already saved to their record.</Text>
            {patients.length === 0 ? <EmptyState label="Add a patient to start a conversation" /> : <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.patientChoices}>
                {patients.map((patient) => <PatientChoice key={patient.id} patient={patient} selected={patient.id === chatPatientId} onPress={() => { setChatMessages([]); setChatReports([]); setChatError(''); setChatLoading(true); setChatPatientId(patient.id); setSelectedReportId(''); setChatDraft(''); }} />)}
              </ScrollView>
              {chatError ? <Notice error message={chatError} /> : null}
              <ScrollView style={styles.chatMessages} contentContainerStyle={styles.chatMessageList} showsVerticalScrollIndicator>
                {chatLoading ? <ActivityIndicator color={STAFF_COLORS.blue} /> : chatMessages.length === 0 ? <EmptyState label={chatPatient ? `No messages with ${chatPatient.first_name} yet` : 'Select a patient'} /> : chatMessages.map((message) => <ChatBubble key={message.id} message={message} mine={message.sender_id === currentStaffId} />)}
              </ScrollView>
              {chatReports.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reportChoices}>{chatReports.map((report) => <Pressable key={report.id} accessibilityRole="button" accessibilityState={{ selected: report.id === selectedReportId }} onPress={() => setSelectedReportId((current) => current === report.id ? '' : report.id)} style={[styles.reportChoice, report.id === selectedReportId && styles.reportChoiceSelected]}><Ionicons name="document-text-outline" size={14} color={report.id === selectedReportId ? STAFF_COLORS.blue : '#68726B'} /><Text numberOfLines={1} style={[styles.reportChoiceText, report.id === selectedReportId && styles.reportChoiceTextSelected]}>{report.file_name}</Text></Pressable>)}</ScrollView> : null}
              <View style={styles.composer}>
                <TextInput accessibilityLabel={`Message ${chatPatient ? `${chatPatient.first_name} ${chatPatient.last_name}` : 'patient'}`} maxLength={1800} multiline onChangeText={setChatDraft} onSubmitEditing={() => void sendChat()} placeholder={selectedReportId ? 'Add a note with this report…' : 'Write a message…'} placeholderTextColor="#89939B" style={styles.chatInput} value={chatDraft} />
                <Pressable accessibilityRole="button" accessibilityLabel={selectedReportId ? 'Send message and report' : 'Send message'} disabled={chatBusy || (!chatDraft.trim() && !selectedReportId)} onPress={() => void sendChat()} style={({ pressed }) => [styles.sendButton, (chatBusy || (!chatDraft.trim() && !selectedReportId)) && styles.disabled, pressed && styles.pressed]}><Ionicons name="send" size={16} color="#FFFFFF" /></Pressable>
              </View>
              <Text style={styles.composerHint}>{selectedReportId ? 'Selected report will be included securely.' : 'Select a report above to share it in this conversation.'}</Text>
            </>}
          </Section>
        </View>
      </View>
    </StaffShell>
  );
}

function MagneticAction({ label, onPress }: { label: string; onPress: () => void }) {
  const attributes = useMemo(() => ({ string: 'magnetic', 'string-id': `button-${label.toLowerCase().replaceAll(' ', '-')}`, 'string-strength': '0.18', 'string-radius': '140' }), [label]);
  const ref = useStringTuneElement<View>(attributes, 'careloop-staff-magnetic');
  return <View ref={ref} collapsable={false}><Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{label}</Text><Ionicons name="arrow-forward" size={17} color="#FFFFFF" /></Pressable></View>;
}

function Metric({ label, value, detail, accent }: { label: string; value: number; detail: string; accent: string }) {
  return <View style={styles.metric}><View style={[styles.metricLine, { backgroundColor: accent }]} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricDetail}>{detail}</Text></View>;
}

function FollowUpRow({ item, onOpen }: { item: FollowUpQueueItem; onOpen: () => void }) {
  return <View style={styles.queueRow}>
    <View style={styles.queueMain}><View style={styles.queueTop}><Text style={styles.patientName}>{item.patient_first_name} {item.patient_last_name}</Text><PriorityBadge priority={item.priority} overdue={item.is_overdue} /></View><Text style={styles.patientMeta}>{item.reason} · {item.next_action}</Text><Text style={styles.queueMeta}>Due {formatDate(item.due_at)} · {item.owner_name || 'Unassigned'} · {item.priority_source.replaceAll('_', ' ')}</Text></View>
    <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}><Text style={styles.rowActionText}>Open patient</Text></Pressable>
  </View>;
}

function AppointmentRow({ appointment, patient, onOpen }: { appointment: Appointment; patient?: Patient; onOpen: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.appointmentRow, pressed && styles.pressed]}><Text style={styles.appointmentTime}>{formatTime(appointment.scheduled_at)}</Text><Avatar name={patient ? `${patient.first_name} ${patient.last_name}` : 'Patient'} /><View style={styles.patientCopy}><Text style={styles.patientName}>{patient ? `${patient.first_name} ${patient.last_name}` : 'Patient record'}</Text><Text style={styles.patientMeta}>{appointment.purpose}</Text></View><Text style={styles.statusText}>{appointment.status}</Text></Pressable>;
}

function PatientChoice({ patient, selected, onPress }: { patient: Patient; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.patientChoice, selected && styles.patientChoiceSelected]}><Text numberOfLines={1} style={[styles.patientChoiceText, selected && styles.patientChoiceTextSelected]}>{patient.first_name} {patient.last_name}</Text></Pressable>;
}

function ChatBubble({ message, mine }: { message: StaffChatMessage; mine: boolean }) {
  const content = decodeChatMessage(message.body);
  const openReport = async (): Promise<void> => {
    if (!content.attachment) return;
    try { await Linking.openURL(await getReportUrl(content.attachment.filePath)); } catch { /* Keep the conversation usable if a report has been removed. */ }
  };
  return <View style={[styles.chatRow, mine && styles.chatRowMine]}><View style={[styles.chatBubble, mine ? styles.chatBubbleMine : styles.chatBubblePatient]}>
    {content.attachment ? <Pressable accessibilityRole="link" onPress={() => void openReport()} style={styles.chatAttachment}><Ionicons name="document-text-outline" size={17} color={STAFF_COLORS.blue} /><Text numberOfLines={1} style={styles.chatAttachmentText}>{content.attachment.name}</Text><Ionicons name="arrow-down-circle-outline" size={16} color={STAFF_COLORS.blue} /></Pressable> : null}
    {content.text ? <Text style={[styles.chatText, mine && styles.chatTextMine]}>{content.text}</Text> : null}
    <Text style={[styles.chatTime, mine && styles.chatTimeMine]}>{new Date(message.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</Text>
  </View></View>;
}

function PriorityBadge({ priority, overdue }: { priority: FollowUpQueueItem['priority']; overdue: boolean }) {
  const label = overdue ? 'OVERDUE' : priority.toUpperCase();
  const tone = overdue || priority === 'urgent' ? styles.priorityUrgent : priority === 'high' ? styles.priorityHigh : priority === 'normal' ? styles.priorityNormal : styles.priorityLow;
  return <Text style={[styles.priorityBadge, tone]}>{label}</Text>;
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>;
}

function EmptyState({ label }: { label: string }) {
  return <View style={styles.empty}><Ionicons name="checkmark-circle-outline" size={20} color={STAFF_COLORS.green} /><Text style={styles.emptyText}>{label}</Text></View>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

const styles = StyleSheet.create({
  hero: { alignItems: 'flex-end', backgroundColor: STAFF_COLORS.navy, borderRadius: 17, flexDirection: 'row', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', marginBottom: 18, minHeight: 218, overflow: 'hidden', padding: 30, position: 'relative' },
  heroCompact: { alignItems: 'flex-start', padding: 22 },
  heroCopy: { maxWidth: 720, zIndex: 1 },
  eyebrow: { color: '#99C9F7', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 16 },
  heroTitle: { color: '#FFFFFF', fontSize: 38, fontWeight: '700', letterSpacing: -1.4, lineHeight: 43 },
  heroBody: { color: '#BDCCDB', fontSize: 14, lineHeight: 22, marginTop: 12, maxWidth: 530 },
  primaryButton: { alignItems: 'center', backgroundColor: STAFF_COLORS.blue, borderRadius: 9, flexDirection: 'row', gap: 11, minHeight: 46, paddingHorizontal: 16, paddingVertical: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  buttonArrow: { fontSize: 16 },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  metric: { backgroundColor: '#FFFFFF', borderColor: STAFF_COLORS.border, borderRadius: 13, borderWidth: 1, flex: 1, minWidth: 170, overflow: 'hidden', padding: 18 },
  metricLine: { height: 3, left: 0, position: 'absolute', right: 0, top: 0 },
  metricValue: { color: STAFF_COLORS.navy, fontSize: 31, fontWeight: '700', letterSpacing: -1.2, marginTop: 3 },
  metricLabel: { color: STAFF_COLORS.navy, fontSize: 13, fontWeight: '800', marginTop: 7 },
  metricDetail: { color: '#68726B', fontSize: 11, marginTop: 4 },
  queueWrap: { marginBottom: 2 },
  queueHint: { color: '#68726B', fontFamily: 'monospace', fontSize: 10, textTransform: 'uppercase' },
  sectionLead: { color: '#68726B', fontSize: 13, lineHeight: 19, marginBottom: 10 },
  queueRow: { alignItems: 'center', borderTopColor: '#DCE2DA', borderTopWidth: 1, flexDirection: 'row', gap: 16, paddingVertical: 17 },
  queueMain: { flex: 1, minWidth: 250 },
  queueTop: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  queueMeta: { color: '#68726B', fontFamily: 'monospace', fontSize: 10, marginTop: 8, textTransform: 'uppercase' },
  priorityBadge: { borderRadius: 4, fontFamily: 'monospace', fontSize: 9, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 5 },
  priorityUrgent: { backgroundColor: '#F6D8D6', color: '#A43835' },
  priorityHigh: { backgroundColor: '#F7E7B7', color: '#8D6100' },
  priorityNormal: { backgroundColor: '#DCE5FF', color: '#294DFF' },
  priorityLow: { backgroundColor: '#E5F0C6', color: '#638B1D' },
  rowAction: { borderColor: '#B7C3B5', borderRadius: 4, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 9 },
  rowActionText: { color: '#294DFF', fontSize: 11, fontWeight: '800' },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  column: { flex: 1, minWidth: 300 },
  appointmentRow: { alignItems: 'center', borderTopColor: '#DCE2DA', borderTopWidth: 1, flexDirection: 'row', paddingVertical: 14 },
  appointmentTime: { color: '#151816', fontFamily: 'monospace', fontSize: 11, width: 64 },
  statusText: { color: '#68726B', fontFamily: 'monospace', fontSize: 10, textTransform: 'uppercase' },
  patientRow: { alignItems: 'center', borderTopColor: '#DCE2DA', borderTopWidth: 1, flexDirection: 'row', paddingVertical: 13 },
  avatar: { alignItems: 'center', backgroundColor: '#DCE5FF', borderRadius: 19, height: 38, justifyContent: 'center', width: 38 },
  avatarText: { color: '#294DFF', fontSize: 11, fontWeight: '800' },
  patientCopy: { flex: 1, marginLeft: 11 },
  patientName: { color: '#151816', fontSize: 14, fontWeight: '800' },
  patientMeta: { color: '#68726B', fontSize: 12, lineHeight: 18, marginTop: 3 },
  patientChoices: { flexDirection: 'row', gap: 7, paddingBottom: 12 },
  patientChoice: { backgroundColor: '#F6F8FA', borderColor: STAFF_COLORS.border, borderRadius: 16, borderWidth: 1, maxWidth: 180, paddingHorizontal: 11, paddingVertical: 7 },
  patientChoiceSelected: { backgroundColor: '#E8F1FF', borderColor: '#AFC9F7' },
  patientChoiceText: { color: '#68726B', fontSize: 10, fontWeight: '700' },
  patientChoiceTextSelected: { color: STAFF_COLORS.blue },
  qrPanel: { alignItems: 'center', backgroundColor: '#F7FAFD', borderColor: STAFF_COLORS.border, borderRadius: 12, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 17, padding: 15 },
  qrImage: { backgroundColor: '#FFFFFF', height: 144, width: 144 },
  qrPlaceholder: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: STAFF_COLORS.border, borderRadius: 9, borderWidth: 1, height: 144, justifyContent: 'center', width: 144 },
  qrPlaceholderText: { color: '#68726B', fontSize: 9, marginTop: 9, textAlign: 'center' },
  qrCopy: { flex: 1, minWidth: 150 },
  qrTitle: { color: STAFF_COLORS.navy, fontSize: 14, fontWeight: '800' },
  smallPrimary: { alignSelf: 'flex-start', backgroundColor: STAFF_COLORS.blue, borderRadius: 8, marginTop: 12, minHeight: 36, paddingHorizontal: 12, paddingVertical: 10 },
  smallPrimaryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  refreshButton: { alignItems: 'center', flexDirection: 'row', gap: 5, padding: 3 },
  refreshText: { color: STAFF_COLORS.blue, fontSize: 10, fontWeight: '700' },
  chatMessages: { backgroundColor: '#F8FAFC', borderColor: STAFF_COLORS.border, borderRadius: 10, borderWidth: 1, maxHeight: 250, minHeight: 110 },
  chatMessageList: { gap: 8, padding: 10 },
  chatRow: { alignItems: 'flex-start', flexDirection: 'row' },
  chatRowMine: { justifyContent: 'flex-end' },
  chatBubble: { borderRadius: 13, maxWidth: '88%', paddingHorizontal: 10, paddingVertical: 8 },
  chatBubbleMine: { backgroundColor: STAFF_COLORS.blue, borderBottomRightRadius: 4 },
  chatBubblePatient: { backgroundColor: '#E9EEF3', borderBottomLeftRadius: 4 },
  chatText: { color: STAFF_COLORS.navy, fontSize: 11, lineHeight: 17 },
  chatTextMine: { color: '#FFFFFF' },
  chatTime: { color: '#68726B', fontSize: 8, marginTop: 4, textAlign: 'right' },
  chatTimeMine: { color: '#DCE9FF' },
  chatAttachment: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 8, flexDirection: 'row', gap: 7, marginBottom: 5, maxWidth: 230, padding: 8 },
  chatAttachmentText: { color: STAFF_COLORS.navy, flex: 1, fontSize: 10, fontWeight: '700' },
  reportChoices: { flexDirection: 'row', gap: 7, paddingTop: 10 },
  reportChoice: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: STAFF_COLORS.border, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 6, maxWidth: 210, paddingHorizontal: 9, paddingVertical: 7 },
  reportChoiceSelected: { backgroundColor: '#E8F1FF', borderColor: '#AFC9F7' },
  reportChoiceText: { color: '#68726B', fontSize: 9, maxWidth: 160 },
  reportChoiceTextSelected: { color: STAFF_COLORS.blue, fontWeight: '700' },
  composer: { alignItems: 'flex-end', flexDirection: 'row', gap: 8, marginTop: 10 },
  chatInput: { backgroundColor: '#FFFFFF', borderColor: STAFF_COLORS.border, borderRadius: 10, borderWidth: 1, color: STAFF_COLORS.navy, flex: 1, fontSize: 12, maxHeight: 90, minHeight: 42, paddingHorizontal: 11, paddingVertical: 10 },
  sendButton: { alignItems: 'center', backgroundColor: STAFF_COLORS.blue, borderRadius: 10, height: 42, justifyContent: 'center', width: 44 },
  composerHint: { color: '#68726B', fontSize: 9, marginTop: 6 },
  chevron: { color: '#294DFF', fontSize: 18 },
  empty: { alignItems: 'center', flexDirection: 'row', gap: 9, paddingVertical: 18 },
  emptyMark: { color: '#B6DF20', fontSize: 24 },
  emptyText: { color: '#68726B', fontSize: 13 },
  pressed: { opacity: 0.7 },
});
