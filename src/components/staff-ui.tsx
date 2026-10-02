import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname, useRouter } from 'expo-router';
import { createElement, useEffect, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';

import '@/global.css';
import { getCurrentStaff, signOutStaff, type StaffProfile } from '@/lib/staff';
import { useStringTuneElement, useStringTuneRuntime } from '@/lib/string-tune';

export const STAFF_COLORS = {
  navy: '#14243A',
  blue: '#2358C5',
  pale: '#F5F7F8',
  border: '#DEE5EA',
  muted: '#657489',
  green: '#287D68',
  red: '#BA4B51',
};

type IconName = ComponentProps<typeof Ionicons>['name'];
type StaffPath = '/staff/dashboard' | '/staff/patients' | '/staff/groups' | '/staff/appointments' | '/staff/tests' | '/staff/medications' | '/staff/care-plans';
type NavLink = { label: string; icon: IconName; path: StaffPath; match: (pathname: string) => boolean };

const EMPTY_ATTRIBUTES: Record<string, string> = {};
const NAV_LINKS: NavLink[] = [
  { label: 'Overview', icon: 'grid-outline', path: '/staff/dashboard', match: (path) => path === '/staff/dashboard' },
  { label: 'Patients', icon: 'people-outline', path: '/staff/patients', match: (path) => path.startsWith('/staff/patients') },
  { label: 'Appointments', icon: 'calendar-outline', path: '/staff/appointments', match: (path) => path === '/staff/appointments' },
  { label: 'Care teams', icon: 'git-network-outline', path: '/staff/groups', match: (path) => path === '/staff/groups' },
  { label: 'Tests & reports', icon: 'flask-outline', path: '/staff/tests', match: (path) => path === '/staff/tests' },
  { label: 'Medications', icon: 'medkit-outline', path: '/staff/medications', match: (path) => path === '/staff/medications' },
  { label: 'Care plans', icon: 'list-outline', path: '/staff/care-plans', match: (path) => path === '/staff/care-plans' },
];

export function Field({ label, value, onChangeText, placeholder, keyboardType, multiline = false, secureTextEntry = false, inline = false }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  multiline?: boolean;
  secureTextEntry?: boolean;
  inline?: boolean;
}) {
  return <View style={[styles.field, inline && styles.inlineField]}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      keyboardType={keyboardType}
      multiline={multiline}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#8795A6"
      secureTextEntry={secureTextEntry}
      style={[styles.input, multiline && styles.multilineInput]}
      value={value}
    />
  </View>;
}

export type DateTimeFieldKind = 'date' | 'time' | 'datetime-local';

function parsePickerDate(value: string, kind: DateTimeFieldKind): Date {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const timeMatch = /T(\d{2}):(\d{2})/.exec(value);
  const clockMatch = /^(\d{2}):(\d{2})$/.exec(value);
  const now = new Date();
  const year = dateMatch ? Number(dateMatch[1]) : now.getFullYear();
  const month = dateMatch ? Number(dateMatch[2]) - 1 : now.getMonth();
  const day = dateMatch ? Number(dateMatch[3]) : now.getDate();
  const hours = Number(timeMatch?.[1] ?? clockMatch?.[1] ?? now.getHours());
  const minutes = Number(timeMatch?.[2] ?? clockMatch?.[2] ?? now.getMinutes());
  return new Date(year, month, day, hours, minutes, 0, 0);
}

function formatPickerDate(date: Date, kind: DateTimeFieldKind): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (kind === 'date') return datePart;
  if (kind === 'time') return timePart;
  return `${datePart}T${timePart}`;
}

export function localDateTimeToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Choose a valid appointment date and time.');
  const date = parsePickerDate(value, 'datetime-local');
  if (Number.isNaN(date.getTime())) throw new Error('Choose a valid appointment date and time.');
  return date.toISOString();
}

function formatPickerDisplay(value: string, kind: DateTimeFieldKind): string {
  if (!value) return '';
  const date = parsePickerDate(value, kind);
  if (kind === 'date') return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  if (kind === 'time') return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

const webDateInputStyle: CSSProperties = {
  backgroundColor: '#FBFCFD',
  border: '1px solid #CAD5DF',
  borderRadius: 9,
  boxSizing: 'border-box',
  color: STAFF_COLORS.navy,
  fontFamily: 'inherit',
  fontSize: 14,
  minHeight: 44,
  padding: '10px 13px',
  width: '100%',
};

const webWheelStyle: CSSProperties = {
  alignItems: 'center',
  border: '1px solid #DCE7F3',
  borderRadius: 12,
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  height: 200,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  padding: '0 8px',
  scrollbarWidth: 'none',
  scrollSnapType: 'y mandatory',
  width: 82,
};
const webWheelSpacerStyle: CSSProperties = { flex: '0 0 80px' };
const webWheelItemStyle: CSSProperties = {
  backgroundColor: 'transparent',
  border: 0,
  borderRadius: 8,
  color: STAFF_COLORS.navy,
  cursor: 'pointer',
  flex: '0 0 40px',
  fontFamily: 'inherit',
  fontSize: 18,
  scrollSnapAlign: 'center',
  width: '100%',
};
const webWheelItemSelectedStyle: CSSProperties = {
  backgroundColor: '#E8F1FF',
  color: STAFF_COLORS.blue,
  fontWeight: 800,
};
const webPickerCardStyle: CSSProperties = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #DCE7F3',
  borderRadius: 16,
  boxShadow: '0 18px 50px rgba(20, 36, 58, 0.18)',
  maxWidth: 440,
  padding: 20,
  width: '100%',
};
const webPickerTitleStyle: CSSProperties = { color: STAFF_COLORS.navy, fontSize: 18, fontWeight: 800, margin: '0 0 14px' };
const webPickerWheelsStyle: CSSProperties = { alignItems: 'center', display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 };
const webPickerActionsStyle: CSSProperties = { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 };
const webPickerButtonStyle: CSSProperties = { background: '#FFFFFF', border: '1px solid #DCE7F3', borderRadius: 9, color: STAFF_COLORS.muted, cursor: 'pointer', font: 'inherit', fontSize: 14, fontWeight: 700, minHeight: 40, padding: '0 16px' };
const webPickerConfirmStyle: CSSProperties = { ...webPickerButtonStyle, background: STAFF_COLORS.blue, borderColor: STAFF_COLORS.blue, color: '#FFFFFF' };

function TimeWheel({ label, options, selectedIndex, onSelect }: {
  label: string;
  options: readonly string[];
  selectedIndex: number;
  onSelect: (value: string) => void;
}) {
  const wheelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (wheelRef.current) wheelRef.current.scrollTop = selectedIndex * 40;
  }, [selectedIndex]);
  const selectIndex = (index: number) => {
    const boundedIndex = Math.max(0, Math.min(options.length - 1, index));
    const nextValue = options[boundedIndex];
    if (nextValue !== undefined) onSelect(nextValue);
  };
  return <div
    aria-label={label}
    onScroll={(event: React.UIEvent<HTMLDivElement>) => {
      const index = Math.max(0, Math.min(options.length - 1, Math.round(event.currentTarget.scrollTop / 40)));
      const nextValue = options[index];
      if (nextValue !== undefined && nextValue !== options[selectedIndex]) onSelect(nextValue);
    }}
    ref={wheelRef}
    role="listbox"
    style={webWheelStyle}
    tabIndex={0}
  >
    <div aria-hidden="true" style={webWheelSpacerStyle} />
    {options.map((option, index) => <button
      aria-selected={index === selectedIndex}
      key={`${label}-${option}`}
      onClick={() => selectIndex(index)}
      role="option"
      style={{ ...webWheelItemStyle, ...(index === selectedIndex ? webWheelItemSelectedStyle : {}) }}
      type="button"
    >{option}</button>)}
    <div aria-hidden="true" style={webWheelSpacerStyle} />
  </div>;
}

export function DateTimeField({ label, value, onChangeText, kind, placeholder, inline = false }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  kind: DateTimeFieldKind;
  placeholder?: string;
  inline?: boolean;
}) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());
  const openPicker = () => { setPickerDate(parsePickerDate(value, kind)); setPickerVisible(true); };
  const savePicker = () => { onChangeText(formatPickerDate(pickerDate, kind)); setPickerVisible(false); };
  const hour12 = ((pickerDate.getHours() + 11) % 12) + 1;
  const minute = pickerDate.getMinutes();
  const isPm = pickerDate.getHours() >= 12;
  const setHour = (value: string) => {
    const hour = Number(value) % 12 + (isPm ? 12 : 0);
    setPickerDate(new Date(pickerDate.getFullYear(), pickerDate.getMonth(), pickerDate.getDate(), hour, minute, 0, 0));
  };
  const setMinute = (value: string) => setPickerDate(new Date(pickerDate.getFullYear(), pickerDate.getMonth(), pickerDate.getDate(), pickerDate.getHours(), Number(value), 0, 0));
  const setMeridiem = (value: string) => {
    const hour = pickerDate.getHours() % 12 + (value === 'PM' ? 12 : 0);
    setPickerDate(new Date(pickerDate.getFullYear(), pickerDate.getMonth(), pickerDate.getDate(), hour, minute, 0, 0));
  };
  const dateTimeButton = createElement('button', {
    'aria-label': `${label}. ${value ? formatPickerDisplay(value, kind) : 'Choose date and time'}`,
    onClick: openPicker,
    style: { ...webDateInputStyle, alignItems: 'center', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', textAlign: 'left' },
    type: 'button',
  }, createElement('span', { style: { color: value ? STAFF_COLORS.navy : '#8795A6' } }, value ? formatPickerDisplay(value, kind) : placeholder ?? 'Choose date and time'), createElement('span', { 'aria-hidden': true, style: { color: STAFF_COLORS.muted } }, kind === 'time' ? '◷' : '▦'));
  const input = Platform.OS !== 'web'
    ? <Pressable accessibilityLabel={`${label}. ${value ? formatPickerDisplay(value, kind) : 'Choose date and time'}`} accessibilityRole="button" onPress={openPicker} style={styles.dateInput}>
        <Text style={[styles.dateInputText, !value && styles.datePlaceholder]}>{value ? formatPickerDisplay(value, kind) : placeholder ?? 'Choose date and time'}</Text>
        <Ionicons color={STAFF_COLORS.muted} name={kind === 'time' ? 'time-outline' : 'calendar-outline'} size={18} />
      </Pressable>
    : kind === 'date' ? createElement('input', {
        'aria-label': label,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChangeText(event.currentTarget.value),
        placeholder,
        required: label.endsWith('*'),
        style: webDateInputStyle,
        type: 'date',
        value,
      }) : dateTimeButton;
  return <View style={[styles.field, inline && styles.inlineField]}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {input}
    {Platform.OS === 'web' ? <Modal animationType="fade" onRequestClose={() => setPickerVisible(false)} transparent visible={pickerVisible}><View style={styles.pickerBackdrop}>{pickerVisible ? createElement('section', { 'aria-label': 'Date and time selector', onClick: (event: React.MouseEvent<HTMLElement>) => event.stopPropagation(), style: webPickerCardStyle },
      createElement('h2', { style: webPickerTitleStyle }, kind === 'date' ? 'Choose date' : kind === 'time' ? 'Choose time' : 'Choose date and time'),
      kind !== 'time' ? createElement('input', { 'aria-label': 'Date', onChange: (event: React.ChangeEvent<HTMLInputElement>) => { const next = parsePickerDate(`${event.currentTarget.value}T${formatPickerDate(pickerDate, 'time')}`, 'datetime-local'); setPickerDate(next); }, required: true, style: webDateInputStyle, type: 'date', value: formatPickerDate(pickerDate, 'date') }) : null,
      kind !== 'date' ? createElement('div', { style: webPickerWheelsStyle },
        createElement(TimeWheel, { label: 'Hour', onSelect: setHour, options: Array.from({ length: 12 }, (_value, index) => String(index + 1).padStart(2, '0')), selectedIndex: hour12 - 1 }),
        createElement(TimeWheel, { label: 'Minute', onSelect: setMinute, options: Array.from({ length: 60 }, (_value, index) => String(index).padStart(2, '0')), selectedIndex: minute }),
        createElement(TimeWheel, { label: 'AM/PM', onSelect: setMeridiem, options: ['AM', 'PM'], selectedIndex: isPm ? 1 : 0 }),
      ) : null,
      createElement('div', { style: webPickerActionsStyle },
        createElement('button', { onClick: () => setPickerVisible(false), style: webPickerButtonStyle, type: 'button' }, 'Cancel'),
        createElement('button', { onClick: savePicker, style: webPickerConfirmStyle, type: 'button' }, 'Set'),
      ),
    ) : null}</View></Modal> : null}
    {Platform.OS !== 'web' ? <Modal animationType="fade" onRequestClose={() => setPickerVisible(false)} transparent visible={pickerVisible}>
      <View style={styles.pickerBackdrop}>
        <Pressable accessibilityLabel="Close date and time picker" onPress={() => setPickerVisible(false)} style={StyleSheet.absoluteFill} />
        <View style={styles.pickerCard}>
          <Text style={styles.pickerTitle}>{kind === 'date' ? 'Choose date' : kind === 'time' ? 'Choose time' : 'Choose date and time'}</Text>
          <ScrollView contentContainerStyle={styles.pickerScroll}>
            {kind !== 'time' ? <DateTimePicker accentColor={STAFF_COLORS.blue} display="spinner" mode="date" onValueChange={(_event, date) => setPickerDate(date)} value={pickerDate} /> : null}
            {kind !== 'date' ? <DateTimePicker accentColor={STAFF_COLORS.blue} display="spinner" is24Hour={false} mode="time" onValueChange={(_event, date) => setPickerDate(date)} value={pickerDate} /> : null}
          </ScrollView>
          <View style={styles.pickerActions}>
            <Pressable accessibilityRole="button" onPress={() => setPickerVisible(false)} style={styles.pickerCancel}><Text style={styles.pickerCancelText}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={savePicker} style={styles.pickerConfirm}><Text style={styles.pickerConfirmText}>Set</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal> : null}
  </View>;
}

export function SelectField({ label, value, options, onChange, optionLabels = {}, inline = false }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void; optionLabels?: Record<string, string>; inline?: boolean }) {
  return <View style={[styles.field, inline && styles.inlineField]}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={styles.selectRow}>{options.map((option) => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: value === option }} onPress={() => onChange(option)} style={({ pressed }) => [styles.selectOption, value === option && styles.selectedOption, pressed && styles.pressed]}><Text style={[styles.selectText, value === option && styles.selectedOptionText]}>{optionLabels[option] ?? (option || 'Unassigned')}</Text></Pressable>)}</View>
  </View>;
}

export function PrimaryButton({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  const ref = useStringTuneElement<View>(EMPTY_ATTRIBUTES, 'careloop-staff-button');
  return <Pressable ref={ref} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, secondary && styles.secondaryButton, disabled && styles.disabledButton, pressed && styles.pressed]}><Text style={[styles.primaryButtonText, secondary && styles.secondaryButtonText]}>{label}</Text></Pressable>;
}

export function Notice({ message, error = false }: { message: string; error?: boolean }) {
  return <View style={[styles.notice, error && styles.errorNotice]}><Ionicons name={error ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={18} color={error ? STAFF_COLORS.red : STAFF_COLORS.green} /><Text style={[styles.noticeText, error && styles.errorNoticeText]}>{message}</Text></View>;
}

export function Section({ title, action, children, style }: { title: string; action?: ReactNode; children: ReactNode; style?: object }) {
  return <View style={[styles.section, style]}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action}</View>{children}</View>;
}

export function StatCard({ label, value, accent = STAFF_COLORS.blue }: { label: string; value: string | number; accent?: string }) {
  return <View style={styles.statCard}><View style={[styles.statAccent, { backgroundColor: accent }]} /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

export function StaffShell({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const compactNavigation = width < 1240;
  const [staff, setStaff] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  useStringTuneRuntime();

  useEffect(() => {
    let active = true;
    void getCurrentStaff().then((profile) => {
      if (!active) return;
      if (!profile) router.replace('/staff/login');
      setStaff(profile);
      setLoading(false);
    }).catch(() => {
      if (active) { setLoading(false); router.replace('/staff/login'); }
    });
    return () => { active = false; };
  }, [router]);

  if (loading || !staff) return <View style={styles.loading}><ActivityIndicator color={STAFF_COLORS.blue} /><Text style={styles.loadingText}>Loading workspace…</Text></View>;

  const navigate = (path: StaffPath) => router.replace(path);
  const descriptions: Record<string, string> = {
    Dashboard: 'Your clinic at a glance, with the next care actions in focus.',
    Patients: 'Find records, assign care teams, and keep follow-ups moving.',
    'Appointments & follow-ups': 'Coordinate visits, next steps, and timely outreach.',
    'Groups & allocation': 'Keep responsibilities clear across every care team.',
    'Tests & reports': 'Follow investigations from request to review.',
    Medications: 'Keep treatment information current and easy to find.',
    'Care plans': 'Connect goals, actions, owners, and review dates.',
  };
  const initials = staff.full_name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const signOut = () => void signOutStaff().then(() => router.replace('/staff/login'));

  return <View style={styles.appShell}>
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" onPress={() => navigate('/staff/dashboard')} style={styles.brandLockup}>
        <View style={styles.brandIcon}><Ionicons name="heart-outline" size={21} color="#FFFFFF" /></View>
        <View><Text style={styles.brand}>CareLoop</Text><Text style={styles.brandCaption}>CARE TEAM WORKSPACE</Text></View>
      </Pressable>
      {!compactNavigation ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.inlineTopNav} contentContainerStyle={styles.inlineTopNavContent}>{NAV_LINKS.map((link) => <NavItem key={link.path} icon={link.icon} label={link.label} active={link.match(pathname)} onPress={() => navigate(link.path)} />)}</ScrollView> : null}
      <View style={styles.topBarActions}>
        <View style={styles.topProfile}><View style={styles.topAvatar}><Text style={styles.topAvatarText}>{initials}</Text></View>{!compactNavigation ? <View style={styles.profileCopy}><Text numberOfLines={1} style={styles.topStaffName}>{staff.full_name}</Text><Text style={styles.topStaffRole}>{staff.role === 'doctor' ? 'Doctor' : 'Care team'}</Text></View> : null}</View>
        <Pressable accessibilityLabel="Sign out" accessibilityRole="button" onPress={signOut} style={({ pressed }) => [styles.signOutButton, compactNavigation && styles.compactSignOutButton, pressed && styles.pressed]}><Ionicons name="log-out-outline" size={17} color={STAFF_COLORS.muted} />{!compactNavigation ? <Text style={styles.signOutText}>Sign out</Text> : null}</Pressable>
      </View>
    </View>
    {compactNavigation ? <View style={styles.navBand}><ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topNav} contentContainerStyle={styles.topNavContent}>{NAV_LINKS.map((link) => <NavItem key={link.path} icon={link.icon} label={link.label} active={link.match(pathname)} onPress={() => navigate(link.path)} compact />)}</ScrollView></View> : null}
    <View style={styles.mainArea}>
      <ScrollView nativeID="careloop-staff-scroll" contentContainerStyle={[styles.page, compactNavigation && styles.pageCompact]} keyboardShouldPersistTaps="handled">
        <View style={styles.pageHeader}><View style={styles.pageHeaderCopy}><Text style={styles.pageEyebrow}>CARE TEAM / {staff.role.toUpperCase()}</Text><Text style={styles.pageTitle}>{title}</Text><Text style={styles.pageSubtitle}>{descriptions[title] ?? 'Care information, clearly organized.'}</Text></View><View style={styles.accountBadge}><View style={styles.accountDot} /><Text style={styles.accountBadgeText}>Workspace</Text></View></View>
        {children}
        <View style={styles.pageEnd}><Text style={styles.pageEndText}>CARELOOP · CONTINUITY, MADE CLEAR</Text></View>
      </ScrollView>
    </View>
  </View>;
}

function NavItem({ icon, label, active, onPress, compact = false }: { icon: IconName; label: string; active: boolean; onPress: () => void; compact?: boolean }) {
  const ref = useStringTuneElement<View>(EMPTY_ATTRIBUTES, 'careloop-staff-nav-item');
  return <Pressable ref={ref} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.navItem, active && styles.activeNavItem, compact && styles.compactNavItem, pressed && styles.pressed]}><Ionicons name={icon} size={17} color={active ? STAFF_COLORS.blue : STAFF_COLORS.muted} /><Text style={[styles.navText, active && styles.activeNavText, compact && styles.compactNavText]}>{label}</Text></Pressable>;
}

export const styles = StyleSheet.create({
  appShell: { backgroundColor: STAFF_COLORS.pale, flex: 1, flexDirection: 'column' },
  topBar: { alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomColor: STAFF_COLORS.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 76, paddingHorizontal: 30 },
  brandLockup: { alignItems: 'center', flexDirection: 'row', gap: 11, paddingVertical: 10 },
  brandIcon: { alignItems: 'center', backgroundColor: STAFF_COLORS.blue, borderRadius: 11, height: 39, justifyContent: 'center', width: 39 },
  brand: { color: STAFF_COLORS.navy, fontSize: 19, fontWeight: '800', letterSpacing: -0.6 },
  brandCaption: { color: '#8290A0', fontSize: 8, fontWeight: '800', letterSpacing: 1.15, marginTop: 3 },
  topBarActions: { alignItems: 'center', flexDirection: 'row', gap: 22 },
  inlineTopNav: { alignSelf: 'center', flex: 1, flexGrow: 1, flexShrink: 1, maxWidth: 940, minWidth: 0 },
  inlineTopNavContent: { alignItems: 'center', flexDirection: 'row', flexGrow: 1, gap: 2, justifyContent: 'center', paddingHorizontal: 10 },
  topProfile: { alignItems: 'center', flexDirection: 'row', gap: 10, maxWidth: 250 },
  topAvatar: { alignItems: 'center', backgroundColor: '#E6EFFB', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  topAvatarText: { color: STAFF_COLORS.blue, fontSize: 11, fontWeight: '800' },
  profileCopy: { flex: 1 },
  topStaffName: { color: STAFF_COLORS.navy, fontSize: 12, fontWeight: '800' },
  topStaffRole: { color: STAFF_COLORS.muted, fontSize: 11, marginTop: 3 },
  signOutButton: { alignItems: 'center', backgroundColor: '#F7F9FB', borderColor: STAFF_COLORS.border, borderRadius: 9, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: 38, paddingHorizontal: 12 },
  compactSignOutButton: { backgroundColor: 'transparent', borderColor: 'transparent', paddingHorizontal: 8 },
  signOutText: { color: STAFF_COLORS.navy, fontSize: 11, fontWeight: '700' },
  navBand: { backgroundColor: '#FFFFFF', borderBottomColor: STAFF_COLORS.border, borderBottomWidth: 1 },
  topNav: { alignSelf: 'center', flexGrow: 0, maxWidth: 1440, width: '100%' },
  topNavContent: { alignItems: 'center', flexDirection: 'row', flexGrow: 1, gap: 6, justifyContent: 'center', minWidth: '100%', paddingHorizontal: 24, paddingVertical: 9 },
  navItem: { alignItems: 'center', borderRadius: 9, flexDirection: 'row', gap: 8, minHeight: 42, paddingHorizontal: 13 },
  activeNavItem: { backgroundColor: '#EAF2FD' },
  navText: { color: STAFF_COLORS.muted, fontSize: 12, fontWeight: '700' },
  activeNavText: { color: STAFF_COLORS.blue, fontWeight: '800' },
  compactNavItem: { gap: 6, minHeight: 39, paddingHorizontal: 10 },
  compactNavText: { fontSize: 11 },
  mainArea: { flex: 1, minHeight: 0, minWidth: 0 },
  page: { alignSelf: 'center', maxWidth: 1440, paddingBottom: 34, paddingHorizontal: 38, paddingTop: 34, width: '100%' },
  pageCompact: { paddingHorizontal: 18, paddingTop: 24 },
  pageHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 27 },
  pageHeaderCopy: { flex: 1, paddingRight: 12 },
  pageEyebrow: { color: STAFF_COLORS.blue, fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  pageTitle: { color: STAFF_COLORS.navy, fontSize: 32, fontWeight: '800', letterSpacing: -1.2, marginTop: 7 },
  pageSubtitle: { color: STAFF_COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  accountBadge: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: STAFF_COLORS.border, borderRadius: 99, borderWidth: 1, flexDirection: 'row', gap: 7, paddingHorizontal: 12, paddingVertical: 8 },
  accountDot: { backgroundColor: STAFF_COLORS.green, borderRadius: 5, height: 7, width: 7 },
  accountBadgeText: { color: STAFF_COLORS.navy, fontSize: 11, fontWeight: '700' },
  pageEnd: { borderTopColor: STAFF_COLORS.border, borderTopWidth: 1, marginTop: 14, paddingTop: 18 },
  pageEndText: { color: '#95A1AE', fontSize: 9, fontWeight: '700', letterSpacing: 1.3 },
  loading: { alignItems: 'center', backgroundColor: STAFF_COLORS.pale, flex: 1, justifyContent: 'center' },
  loadingText: { color: STAFF_COLORS.muted, marginTop: 10 },
  section: { backgroundColor: '#FFFFFF', borderColor: STAFF_COLORS.border, borderRadius: 16, borderWidth: 1, marginBottom: 18, padding: 22 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 18 },
  sectionTitle: { color: STAFF_COLORS.navy, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  field: { marginBottom: 15, minWidth: 220 },
  inlineField: { flex: 1 },
  fieldLabel: { color: STAFF_COLORS.navy, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  input: { backgroundColor: '#FBFCFD', borderColor: '#CAD5DF', borderRadius: 9, borderWidth: 1, color: STAFF_COLORS.navy, fontSize: 14, minHeight: 44, paddingHorizontal: 13, paddingVertical: 10 },
  dateInput: { alignItems: 'center', backgroundColor: '#FBFCFD', borderColor: '#CAD5DF', borderRadius: 9, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 44, paddingHorizontal: 13, paddingVertical: 10 },
  dateInputText: { color: STAFF_COLORS.navy, flex: 1, fontSize: 14 },
  datePlaceholder: { color: '#8795A6' },
  pickerBackdrop: { alignItems: 'center', backgroundColor: 'rgba(12, 28, 48, 0.38)', flex: 1, justifyContent: 'center', padding: 18 },
  pickerCard: { backgroundColor: '#FFFFFF', borderColor: STAFF_COLORS.border, borderRadius: 18, borderWidth: 1, maxWidth: 470, padding: 18, width: '100%' },
  pickerTitle: { color: STAFF_COLORS.navy, fontSize: 17, fontWeight: '800', marginBottom: 10 },
  pickerScroll: { alignItems: 'center', gap: 8 },
  pickerActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 12 },
  pickerCancel: { alignItems: 'center', borderColor: STAFF_COLORS.border, borderRadius: 9, borderWidth: 1, justifyContent: 'center', minHeight: 40, paddingHorizontal: 17 },
  pickerCancelText: { color: STAFF_COLORS.muted, fontSize: 13, fontWeight: '700' },
  pickerConfirm: { alignItems: 'center', backgroundColor: STAFF_COLORS.blue, borderRadius: 9, justifyContent: 'center', minHeight: 40, paddingHorizontal: 22 },
  pickerConfirmText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  multilineInput: { minHeight: 90, textAlignVertical: 'top' },
  primaryButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: STAFF_COLORS.blue, borderRadius: 9, justifyContent: 'center', minHeight: 43, paddingHorizontal: 17 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  secondaryButton: { backgroundColor: '#F0F5FC', borderColor: '#D0DDEE', borderWidth: 1 },
  secondaryButtonText: { color: STAFF_COLORS.blue },
  disabledButton: { opacity: 0.55 },
  pressed: { opacity: 0.78 },
  notice: { alignItems: 'center', backgroundColor: '#EDF8F4', borderColor: '#B7DED1', borderRadius: 9, borderWidth: 1, flexDirection: 'row', gap: 9, marginBottom: 16, padding: 12 },
  noticeText: { color: '#176C59', flex: 1, fontSize: 13, lineHeight: 20 },
  errorNotice: { backgroundColor: '#FFF3F3', borderColor: '#ECC3C6' },
  errorNoticeText: { color: STAFF_COLORS.red },
  statCard: { backgroundColor: '#FFFFFF', borderColor: STAFF_COLORS.border, borderRadius: 14, borderWidth: 1, flex: 1, minWidth: 160, overflow: 'hidden', padding: 18 },
  statAccent: { height: 3, left: 0, position: 'absolute', right: 0, top: 0 },
  statValue: { color: STAFF_COLORS.navy, fontSize: 30, fontWeight: '800', marginTop: 6 },
  statLabel: { color: STAFF_COLORS.muted, fontSize: 13, marginTop: 5 },
  selectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectOption: { backgroundColor: '#F7F9FB', borderColor: STAFF_COLORS.border, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  selectedOption: { backgroundColor: '#E7EFFB', borderColor: '#94B4E5' },
  selectText: { color: STAFF_COLORS.muted, fontSize: 12 },
  selectedOptionText: { color: STAFF_COLORS.blue, fontWeight: '800' },
});
