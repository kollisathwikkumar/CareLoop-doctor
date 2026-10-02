import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Activity as ActivityIcon, AlertCircle, ArrowLeft, ArrowRight, BarChart3, Bell, CalendarDays, Check,
  CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Clock3, Command, Edit3, FileText,
  Filter, Home, Inbox, LayoutDashboard, ListFilter, Mail, Menu, MessageSquare, MoreHorizontal,
  Image as ImageIcon, Paperclip, Phone, Plus, RefreshCw, Search, Send, Settings as SettingsIcon, Sparkles, UserRound, Video,
  Users, X, Zap,
} from 'lucide-react'
import {
  Activity, Communication, Followup, FollowupStatus, Notification, Patient, RescheduleRequest, Task, TaskStatus, TeamMember,
  initialActivity, initialCommunications, initialNotifications, initialPatients, initialReschedules, initialTasks, initialTeam,
} from './data'
import { createSharedPatient, getSharedMessages, getSharedPatients, mergeSharedPatient, patchSharedPatient, sendSharedMessage, subscribeToSharedMessages, subscribeToSharedPatients, type NewSharedPatient, type SharedMessage, type SharedPatient } from './careloopApi'

type Route = '/overview' | '/follow-ups' | '/patients' | '/patient-detail' | '/calendar' | '/team' | '/communication' | '/messages' | '/reschedules' | '/tasks' | '/escalations' | '/analytics' | '/settings'

type PriorityRules = { highDays: number; reviewDays: number; noResponsePoints: number; overduePoints: number; unassignedPoints: number }
const DEFAULT_PRIORITY_RULES: PriorityRules = { highDays: 30, reviewDays: 14, noResponsePoints: 2, overduePoints: 2, unassignedPoints: 1 }
function scoreFollowup(patient: Patient, rules: PriorityRules): { priority: Patient['priority']; reason: string; score: number } {
  if (patient.status === 'Completed') return { priority: 'Low', reason: 'Follow-up action completed', score: 0 }
  let score = 0
  const reasons: string[] = []
  if (patient.lastActivity !== 'No activity recorded' && patient.daysSinceActivity >= rules.highDays) { score += 2; reasons.push(`${patient.daysSinceActivity} days since recorded activity`) }
  else if (patient.lastActivity !== 'No activity recorded' && patient.daysSinceActivity >= rules.reviewDays) { score += 1; reasons.push(`${patient.daysSinceActivity} days since recorded activity`) }
  if (patient.nextExpectedReview.toLowerCase().includes('overdue')) { score += rules.overduePoints; reasons.push('review overdue') }
  if (patient.response === 'No response') { score += rules.noResponsePoints; reasons.push('no patient response') }
  if (patient.assigned === 'Unassigned') { score += rules.unassignedPoints; reasons.push('owner unassigned') }
  if (patient.status === 'Staff Action Required' && score < 3) { score = 3; reasons.push('staff action required') }
  const priority: Patient['priority'] = score >= 3 ? 'High' : score > 0 ? 'Medium' : 'Low'
  return { priority, reason: reasons.length ? reasons.join(' · ') : 'Recent activity and response are on track', score }
}

function withFollowupPriority(patient: Patient, rules: PriorityRules): Patient {
  return { ...patient, ...scoreFollowup(patient, rules) }
}

function patientFromShared(shared: SharedPatient): Patient {
  return {
    ...shared, initials: shared.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join(''),
    lastActivity: 'No activity recorded', daysSinceActivity: 0, nextExpectedReview: 'Scheduled', priority: 'Medium',
    priorityReason: 'New patient; complete intake and confirm the first follow-up', lastAppointment: 'Not yet recorded',
    lastLabActivity: 'Not yet recorded', treatmentMilestone: 'No milestone recorded', previousContact: 'No contact recorded', reportUrl: '',
  }
}

type Toast = { id: number; message: string; tone?: 'success' | 'error' }

type AppState = {
  patients: Patient[]
  communications: Communication[]
  tasks: Task[]
  reschedules: RescheduleRequest[]
  notifications: Notification[]
  activity: Activity[]
}

const navItems: { route: Route; label: string; icon: typeof Home }[] = [
  { route: '/overview', label: 'Dashboard', icon: LayoutDashboard },
  { route: '/follow-ups', label: 'Patients', icon: Users },
  { route: '/calendar', label: 'Calendar', icon: CalendarDays },
  { route: '/team', label: 'Care team', icon: UserRound },
  { route: '/tasks', label: 'Tasks', icon: ClipboardList },
  { route: '/messages', label: 'Messages', icon: MessageSquare },
  { route: '/analytics', label: 'Analysis', icon: BarChart3 },
]

const routeLabels: Record<Route, string> = {
  '/overview': 'Doctor dashboard', '/follow-ups': 'Patients & worklist', '/patients': 'Patients & worklist', '/patient-detail': 'Patient record', '/calendar': 'Calendar', '/team': 'Care team', '/communication': 'Communication', '/messages': 'Messages',
  '/reschedules': 'Reschedule Requests', '/tasks': 'Tasks', '/escalations': 'Staff Action Required', '/analytics': 'Analytics',
  '/settings': 'Settings',
}

function routeFromPath(pathname: string): Route {
  if (pathname.startsWith('/patients/')) return '/patient-detail'
  if (pathname === '/patients') return '/follow-ups'
  if (pathname === '/escalations') return '/escalations'
  return (Object.keys(routeLabels).includes(pathname) ? pathname : '/overview') as Route
}

const STORAGE_KEY = 'careloop-live-state-v1'
const TEAM_STORAGE_KEY = 'careloop-live-team-v1'
function initialTeamState(): TeamMember[] {
  try {
    const saved = window.localStorage.getItem(TEAM_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as TeamMember[]
      if (Array.isArray(parsed) && parsed.every((member) => typeof member.name === 'string' && typeof member.id === 'string')) return parsed
    }
  } catch { /* Invalid team state starts empty. */ }
  return initialTeam
}
function initialState(): AppState {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<AppState>
      if (Array.isArray(parsed.patients) && parsed.patients.length > 0) return {
        patients: parsed.patients, communications: parsed.communications ?? initialCommunications,
        tasks: parsed.tasks ?? initialTasks, reschedules: parsed.reschedules ?? initialReschedules,
        notifications: parsed.notifications ?? initialNotifications, activity: parsed.activity ?? initialActivity,
      }
    }
  } catch { /* Invalid local state starts empty. */ }
  return { patients: initialPatients, communications: initialCommunications, tasks: initialTasks, reschedules: initialReschedules, notifications: initialNotifications, activity: initialActivity }
}

function patientIdFromPath(pathname: string): string | null {
  if (!pathname.startsWith('/patients/')) return null
  return decodeURIComponent(pathname.slice('/patients/'.length)) || null
}

function App() {
  const [route, setRoute] = useState<Route>(routeFromPath(window.location.pathname))
  const [state, setState] = useState<AppState>(initialState)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initialTeamState)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(() => patientIdFromPath(window.location.pathname))
  const [toasts, setToasts] = useState<Toast[]>([])
  const [backendStatus, setBackendStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting')
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [createPatientOpen, setCreatePatientOpen] = useState(false)
  const [createTeamMemberOpen, setCreateTeamMemberOpen] = useState(false)

  useEffect(() => {
    const onPopState = () => { setRoute(routeFromPath(window.location.pathname)); setSelectedPatientId(patientIdFromPath(window.location.pathname)) }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    let active = true
    const applySharedPatient = (shared: SharedPatient) => {
      if (!active) return
      setState((current) => ({ ...current, patients: current.patients.some((patient) => patient.id === shared.id)
        ? current.patients.map((patient) => { if (patient.id !== shared.id) return patient; return withFollowupPriority(mergeSharedPatient(patient, shared), DEFAULT_PRIORITY_RULES) })
        : [withFollowupPriority(patientFromShared(shared), DEFAULT_PRIORITY_RULES), ...current.patients] }))
      setBackendStatus('connected')
    }
    void getSharedPatients().then((patients) => {
      if (!active) return
      setState((current) => ({ ...current, patients: [
        ...patients.map((shared) => { const existing = current.patients.find((patient) => patient.id === shared.id); return withFollowupPriority(existing ? mergeSharedPatient(existing, shared) : patientFromShared(shared), DEFAULT_PRIORITY_RULES) }),
        ...current.patients.filter((patient) => !patients.some((shared) => shared.id === patient.id)),
      ] }))
      setBackendStatus('connected')
    }).catch(() => { if (active) setBackendStatus('offline') })
    const events = subscribeToSharedPatients(applySharedPatient)
    events.onerror = () => { if (active) setBackendStatus('offline') }
    return () => { active = false; events.close() }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    window.localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(teamMembers))
  }, [teamMembers])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return
      try { setState(JSON.parse(event.newValue) as AppState) } catch { /* Ignore malformed cross-tab state. */ }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const navigate = (nextRoute: Route) => {
    window.history.pushState({}, '', nextRoute)
    setRoute(nextRoute)
    setMobileNav(false)
    setSelectedPatientId(null)
  }

  const openPatient = (patientId: string) => {
    window.history.pushState({}, '', `/patients/${encodeURIComponent(patientId)}`)
    setSelectedPatientId(patientId)
    setRoute('/patient-detail')
    setMobileNav(false)
  }

  const toast = (message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now()
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3600)
  }

  useEffect(() => {
    const handleExternalToast = (event: Event) => {
      const message = (event as CustomEvent<string>).detail
      if (message) toast(message)
    }
    window.addEventListener('careloop:toast', handleExternalToast)
    return () => window.removeEventListener('careloop:toast', handleExternalToast)
  }, [])

  const addActivity = (text: string, tone: Activity['tone'] = 'blue') => {
    setState((current) => ({ ...current, activity: [{ id: `a-${Date.now()}`, time: 'Now', text, tone }, ...current.activity].slice(0, 8) }))
  }

  const addPatient = async (input: NewSharedPatient): Promise<string> => {
    const shared = await createSharedPatient(input)
    const patient = withFollowupPriority(patientFromShared(shared), DEFAULT_PRIORITY_RULES)
    setState((current) => ({ ...current, patients: [patient, ...current.patients], activity: [{ id: `a-${Date.now()}`, time: 'Now', text: `${patient.name} added to the patient register`, tone: 'blue' as const }, ...current.activity].slice(0, 8) }))
    setBackendStatus('connected')
    toast(`${patient.name} added to the patient register.`)
    return patient.id
  }

  const addTeamMember = (input: Omit<TeamMember, 'id' | 'status'>) => {
    const member: TeamMember = { ...input, id: `team-${Date.now()}`, status: 'Active' }
    setTeamMembers((current) => [...current, member])
    addActivity(`${member.name} added to the care team`, 'blue')
    toast(`${member.name} added to the care team.`)
  }

  const toggleTeamMember = (memberId: string) => {
    const member = teamMembers.find((item) => item.id === memberId)
    if (!member) return
    setTeamMembers((current) => current.map((item) => item.id === memberId ? { ...item, status: item.status === 'Active' ? 'Inactive' : 'Active' } : item))
    addActivity(`${member.name} marked ${member.status === 'Active' ? 'inactive' : 'active'}`, member.status === 'Active' ? 'amber' : 'green')
    toast(`${member.name} marked ${member.status === 'Active' ? 'inactive' : 'active'}.`)
  }

  const updatePatient = (patientId: string, patch: Partial<Patient>) => {
    setState((current) => ({ ...current, patients: current.patients.map((patient) => {
      if (patient.id !== patientId) return patient
      const updated = { ...patient, ...patch }
      return patch.priority ? updated : withFollowupPriority(updated, DEFAULT_PRIORITY_RULES)
    }) }))
    const sharedFields = ['nextFollowup', 'time', 'doctor', 'department', 'assigned', 'response', 'status', 'reminder', 'nextAction']
    const sharedPatch = Object.fromEntries(Object.entries(patch).filter(([key]) => sharedFields.includes(key)))
    if (Object.keys(sharedPatch).length) {
      void patchSharedPatient(patientId, sharedPatch).then((shared) => setState((current) => ({ ...current, patients: current.patients.map((patient) => {
        if (patient.id !== patientId) return patient
        const merged = mergeSharedPatient(patient, shared)
        return patch.priority ? { ...withFollowupPriority(merged, DEFAULT_PRIORITY_RULES), priority: patch.priority, priorityReason: patch.priorityReason ?? merged.priorityReason } : withFollowupPriority(merged, DEFAULT_PRIORITY_RULES)
      }) }))).catch(() => setBackendStatus('offline'))
    }
  }

  const sendReminder = (patientId: string) => {
    updatePatient(patientId, { reminder: 'Sent', response: 'Awaiting response', status: 'Reminder Pending', nextAction: 'Wait for patient response to the follow-up reminder' })
    setState((current) => ({ ...current, communications: [{ id: `c-${Date.now()}`, patientId, type: 'Follow-up reminder', created: 'Today · Now', approvedBy: 'Care team', sent: 'Today · Now', response: 'Awaiting', status: 'Awaiting Response' }, ...current.communications] }))
    addActivity(`${patientId} reminder sent`, 'blue')
    toast('Reminder sent successfully.')
  }

  const markContacted = (patientId: string) => {
    const patient = state.patients.find((item) => item.id === patientId)
    if (!patient) return
    updatePatient(patientId, { reminder: 'Sent', previousContact: 'Contact attempt recorded · just now', nextAction: 'Care team contact attempt recorded; follow up if the patient does not respond' })
    setState((current) => ({ ...current, communications: [{ id: `c-${Date.now()}`, patientId, type: 'Care-team contact attempt', created: 'Today · Now', approvedBy: patient.assigned || 'Care team', sent: 'Today · Now', response: 'Contact attempt recorded', status: 'Sent' }, ...current.communications] }))
    addActivity(`${patientId} contact attempt recorded`, 'blue')
    toast('Contact attempt recorded in the care timeline.')
  }

  const escalatePatient = (patientId: string) => {
    updatePatient(patientId, { status: 'Staff Action Required', priority: 'High', priorityReason: 'Escalated by the care team for timely follow-up', nextAction: 'Escalated: care team must review and agree the next intervention' })
    setState((current) => ({ ...current, tasks: [{ id: `task-${Date.now()}`, patientId, task: 'Escalated follow-up: review and agree next intervention', owner: 'Unassigned', created: 'Today', due: 'Today', status: 'To Do' }, ...current.tasks] }))
    addActivity(`${patientId} follow-up escalated to the team`, 'amber')
    toast('Patient added to the urgent follow-up queue.')
  }

  const createFollowup = (patientId: string, taskName: string, owner: string, due: string) => {
    updatePatient(patientId, { nextAction: taskName, assigned: owner })
    setState((current) => ({ ...current, tasks: [{ id: `task-${Date.now()}`, patientId, task: taskName, owner, created: 'Today', due, status: 'To Do' }, ...current.tasks] }))
    addActivity(`${patientId} follow-up action created`, 'blue')
    toast('Follow-up action added to the shared team worklist.')
  }

  const confirmAppointment = (patientId: string) => {
    updatePatient(patientId, { response: 'Confirmed', status: 'Confirmed', nextAction: 'Appointment confirmed; care team to prepare for the scheduled review' })
    setState((current) => ({ ...current, notifications: current.notifications.map((item) => item.title.includes(patientId) ? { ...item, read: true } : item), communications: [{ id: `c-${Date.now()}`, patientId, type: 'Patient appointment confirmation', created: 'Today · Now', approvedBy: 'Patient app', sent: 'Today · Now', response: 'Confirmed by patient', status: 'Responded' }, ...current.communications] }))
    addActivity(`${patientId} confirmed`, 'green')
    toast('Appointment confirmed.')
  }

  const requestReschedule = (patientId: string, request: Omit<RescheduleRequest, 'id' | 'patientId' | 'status'>) => {
    updatePatient(patientId, { response: 'Reschedule requested', status: 'Reschedule Requested', nextAction: 'Review patient’s requested appointment time' })
    setState((current) => ({ ...current, reschedules: [{ ...request, id: `r-${Date.now()}`, patientId, status: 'Pending Review' }, ...current.reschedules], communications: [{ id: `c-${Date.now()}`, patientId, type: 'Patient appointment change request', created: 'Today · Now', approvedBy: 'Patient app', sent: 'Today · Now', response: 'Reschedule requested', status: 'Responded' }, ...current.communications] }))
    addActivity(`${patientId} requested reschedule`, 'amber')
    toast('Reschedule request sent to the care team.')
  }

  const approveReschedule = (requestId: string, date: string, time: string) => {
    const request = state.reschedules.find((item) => item.id === requestId)
    if (!request) return
    updatePatient(request.patientId, { nextFollowup: date, time, response: 'Confirmed', status: 'Confirmed', nextAction: 'Rescheduled review confirmed by the care team' })
    setState((current) => ({ ...current, reschedules: current.reschedules.map((item) => item.id === requestId ? { ...item, status: 'Approved', requestedDate: date, requestedTime: time } : item) }))
    addActivity(`${request.patientId} appointment updated`, 'green')
    toast('Appointment updated and confirmation message ready.')
  }

  const changeTaskStatus = (taskId: string, status: TaskStatus) => {
    const task = state.tasks.find((item) => item.id === taskId)
    setState((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === taskId ? { ...item, status } : item), patients: status === 'Completed' && task ? current.patients.map((patient) => patient.id === task.patientId ? { ...patient, status: 'Completed', priority: 'Low', priorityReason: 'Assigned follow-up action completed' } : patient) : current.patients }))
    if (task) addActivity(`${task.patientId} follow-up action marked ${status.toLowerCase()}`, status === 'Completed' ? 'green' : 'blue')
    toast(status === 'Completed' ? 'Task marked complete.' : 'Task status updated.')
  }

  const assignTask = (taskId: string, owner: string) => {
    const task = state.tasks.find((item) => item.id === taskId)
    setState((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === taskId ? { ...item, owner } : item), patients: task ? current.patients.map((patient) => patient.id === task.patientId ? { ...patient, assigned: owner } : patient) : current.patients }))
    if (task) updatePatient(task.patientId, { assigned: owner })
    if (task) addActivity(`${task.patientId} follow-up assigned to ${owner}`, 'blue')
    toast('Follow-up assigned to the care team.')
  }


  const selectedPatient = state.patients.find((item) => item.id === selectedPatientId) ?? null
  const pendingNotifications = state.notifications.filter((item) => !item.read).length
  const activeStaff = useMemo(() => teamMembers.filter((member) => member.status === 'Active').map((member) => member.name), [teamMembers])

  return (
    <div className="app-shell">
      <Sidebar route={route} navigate={navigate} mobileOpen={mobileNav} onClose={() => setMobileNav(false)} onSearch={() => setSearchOpen(true)} notificationCount={pendingNotifications} taskCount={state.tasks.length} />
      <div className="app-content">
        <div className={`backend-presence backend-${backendStatus}`}><span /> CareLoop API {backendStatus === 'connected' ? 'connected · iOS app sync on' : backendStatus === 'connecting' ? 'connecting…' : 'offline · local website data only'}</div>
        <main className="main-content">
          {route === '/overview' && <Overview state={state} onSelectPatient={openPatient} navigate={navigate} onCreate={() => setCreateTaskOpen(true)} />}
          {(route === '/follow-ups' || route === '/patients') && <FollowUps state={state} onSelectPatient={openPatient} onSendReminder={sendReminder} navigate={navigate} onCreate={() => setCreateTaskOpen(true)} onAddPatient={() => setCreatePatientOpen(true)} />}
          {route === '/calendar' && <CalendarPage state={state} onSelectPatient={openPatient} navigate={navigate} />}
          {route === '/team' && <TeamManagementPage teamMembers={teamMembers} patients={state.patients} tasks={state.tasks} onAdd={() => setCreateTeamMemberOpen(true)} onToggle={toggleTeamMember} navigate={navigate} />}
          {route === '/patient-detail' && selectedPatient && <PatientDetail patient={selectedPatient} state={state} communications={state.communications.filter((item) => item.patientId === selectedPatient.id)} onBack={() => navigate('/follow-ups')} onSendReminder={sendReminder} onContact={markContacted} onEscalate={escalatePatient} onConfirm={confirmAppointment} onCreateTask={() => setCreateTaskOpen(true)} />}
          {route === '/communication' && <CommunicationPage state={state} onSendReminder={sendReminder} onSelectPatient={openPatient} />}
          {route === '/messages' && <MessagesPage patients={state.patients} />}
          {route === '/reschedules' && <Reschedules state={state} onApprove={approveReschedule} onSelectPatient={openPatient} />}
          {route === '/tasks' && <TasksPage state={state} staff={activeStaff} onStatusChange={changeTaskStatus} onAssign={assignTask} onSelectPatient={openPatient} onCreate={() => setCreateTaskOpen(true)} navigate={navigate} />}
          {route === '/escalations' && <Escalations state={state} onSelectPatient={openPatient} onSendReminder={sendReminder} />}
          {route === '/analytics' && <Analytics state={state} onSelectPatient={openPatient} />}
          {route === '/settings' && <Settings />}
        </main>
      </div>
      {createTaskOpen && <CreateFollowupModal patients={state.patients} staff={activeStaff} initialPatientId={selectedPatientId ?? undefined} onClose={() => setCreateTaskOpen(false)} onCreate={(patientId, title, owner, due) => { createFollowup(patientId, title, owner, due); setCreateTaskOpen(false) }} />}
      {createPatientOpen && <CreatePatientModal staff={activeStaff} onClose={() => setCreatePatientOpen(false)} onCreate={async (input) => { const patientId = await addPatient(input); setCreatePatientOpen(false); openPatient(patientId) }} />}
      {createTeamMemberOpen && <AddTeamMemberModal onClose={() => setCreateTeamMemberOpen(false)} onCreate={(member) => { addTeamMember(member); setCreateTeamMemberOpen(false) }} />}
      {searchOpen && <GlobalSearch state={state} onClose={() => setSearchOpen(false)} onSelect={(patientId) => { setSearchOpen(false); openPatient(patientId) }} navigate={navigate} />}
      <ToastStack toasts={toasts} />
    </div>
  )
}

function Sidebar({ route, navigate, mobileOpen, onClose, onSearch, notificationCount, taskCount }: { route: Route; navigate: (route: Route) => void; mobileOpen: boolean; onClose: () => void; onSearch: () => void; notificationCount: number; taskCount: number }) {
  return <>
    {mobileOpen && <button className="mobile-backdrop" onClick={onClose} aria-label="Close navigation" />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-top">
        <div className="brand-lockup" aria-label="CareLoop patient app">
          <span aria-hidden="true" className="patient-brand-mark"><i className="patient-brand-loop patient-brand-loop-left" /><i className="patient-brand-loop patient-brand-loop-right" /></span>
          <span aria-label="CareLoop" className="patient-brand-wordmark"><strong>Care</strong><strong>Loop</strong></span>
        </div>
        <button className="sidebar-close" onClick={onClose} aria-label="Close navigation"><X size={18} /></button>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map(({ route: itemRoute, label, icon: Icon }) => <button key={itemRoute} className={`nav-item ${route === itemRoute || (route === '/patient-detail' && itemRoute === '/follow-ups') ? 'nav-active' : ''}`} onClick={() => navigate(itemRoute)}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{itemRoute === '/tasks' && taskCount > 0 && <span className="nav-count">{taskCount}</span>}</button>)}
        </nav>
      </div>
      <Topbar route={route} navigate={navigate} onMenu={onClose} onSearch={onSearch} notificationCount={notificationCount} />
    </aside>
  </>
}

function Topbar({ route, navigate, onMenu, onSearch, notificationCount }: { route: Route; navigate: (route: Route) => void; onMenu: () => void; onSearch: () => void; notificationCount: number }) {
  return <header className="topbar">
    <button className="mobile-menu" onClick={onMenu} aria-label="Open navigation"><Menu size={21} /></button>
    <div className="breadcrumbs"><span>CareLoop</span><ChevronRight size={14} /><strong>{routeLabels[route]}</strong></div>
    <div className="topbar-actions">
      <button className="search-trigger" onClick={onSearch}><Search size={16} /><span>Search patients, follow-ups, tasks...</span><kbd><Command size={12} /> K</kbd></button>
      <button className="icon-button notification-button" onClick={() => navigate('/escalations')} aria-label={`${notificationCount} staff alerts`}><Bell size={19} />{notificationCount > 0 && <span className="notification-dot">{notificationCount}</span>}</button>
      <div className="top-profile" aria-label="Care-team workspace"><div className="avatar avatar-blue"><UserRound size={15} /></div><span><strong>Care team</strong><small>Workspace</small></span></div>
    </div>
  </header>
}

function PageHeader({ title, subtitle, action, eyebrow }: { title: string; subtitle: string; action?: React.ReactNode; eyebrow?: string }) {
  return <div className="page-header"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{subtitle}</p></div>{action}</div>
}

function Overview({ state, onSelectPatient, navigate, onCreate }: { state: AppState; onSelectPatient: (id: string) => void; navigate: (route: Route) => void; onCreate: () => void }) {
  const highPriority = state.patients.filter((patient) => patient.priority === 'High' && patient.status !== 'Completed').length
  const longGap = state.patients.filter((patient) => patient.daysSinceActivity >= 30 && patient.status !== 'Completed').length
  const awaiting = state.patients.filter((item) => item.response === 'Awaiting response' || item.response === 'No response' || item.response === 'Reschedule requested').length
  const reschedules = state.reschedules.filter((item) => item.status === 'Pending Review').length
  const activeActions = state.tasks.filter((item) => item.status !== 'Completed').length
  const attentionPatients = [...state.patients].filter((patient) => patient.status !== 'Completed').sort((a, b) => ({ High: 0, Medium: 1, Low: 2 }[a.priority] - { High: 0, Medium: 1, Low: 2 }[b.priority]) || b.daysSinceActivity - a.daysSinceActivity).slice(0, 4)
  return <>
    <PageHeader eyebrow="CONTINUITY-OF-CARE OPERATIONS" title="Doctor dashboard" subtitle="Find patients falling behind, understand their last known activity, and coordinate the next intervention." action={<div className="overview-actions"><button className="button button-secondary" onClick={() => navigate('/team')}><Users size={15} /> Care team</button><button className="button button-primary" onClick={onCreate}><Plus size={16} /> Create follow-up</button></div>} />
    <div className="kpi-grid">
      <KpiCard label="High-priority patients" value={highPriority} icon={<AlertCircle size={17} />} tone="red" trend="Transparent follow-up reasons" />
      <KpiCard label="30+ days since activity" value={longGap} icon={<Clock3 size={17} />} tone="amber" trend="Review last known activity" />
      <KpiCard label="Patient responses to review" value={awaiting} icon={<MessageSquare size={17} />} tone="purple" trend={`${reschedules} reschedule request${reschedules === 1 ? '' : 's'}`} />
      <KpiCard label="Open team actions" value={activeActions} icon={<ClipboardList size={17} />} tone="blue" trend="Assigned, due, and trackable" />
      <KpiCard label="Patients in worklist" value={state.patients.length} icon={<Users size={17} />} tone="green" trend="Connected patient records" />
    </div>
    <section className="source-banner"><div className="source-banner-copy"><span className="eyebrow">UNIFIED COORDINATION VIEW</span><strong>One place to see the last known care activity</strong><p>Patient records from connected systems can bring appointment, laboratory, treatment, and contact history together.</p></div><div className="source-chips"><span><CalendarDays size={14} />Appointments</span><span><ActivityIcon size={14} />Investigations</span><span><ClipboardList size={14} />Treatment milestones</span><span><MessageSquare size={14} />Contact history</span></div><span className="demo-label"><span className="status-dot" /> LOCAL API · NO HOSPITAL INTEGRATIONS</span></section>
    <div className="overview-grid">
      <section className="panel queue-panel"><PanelHeading title="Prioritized follow-up worklist" action={<button className="text-button" onClick={() => navigate('/follow-ups')}>Open full worklist <ArrowRight size={15} /></button>} />{state.patients.length ? <QueueTable patients={attentionPatients} onSelectPatient={onSelectPatient} /> : <EmptyState title="No follow-ups yet" body="Patient follow-up records will appear here when available from the connected system." />}</section>
      <section className="panel attention-panel"><PanelHeading title="Next team interventions" action={<button className="text-button" onClick={() => navigate('/tasks')}>View actions <ArrowRight size={14} /></button>} /><div className="attention-list">{attentionPatients.length ? attentionPatients.map((patient) => <AttentionCard key={patient.id} patientId={patient.id} reason={patient.priorityReason} time={`${patient.daysSinceActivity} days since activity`} owner={patient.assigned || 'Unassigned'} tone={patient.priority === 'High' ? 'red' : patient.priority === 'Medium' ? 'amber' : 'blue'} onClick={() => onSelectPatient(patient.id)} />) : <EmptyState title="Nothing needs attention" body="New patient follow-up items will appear here." />}</div></section>
    </div>
    <div className="bottom-grid"><section className="panel activity-panel"><PanelHeading title="Closed-loop activity" /><ActivityTimeline items={state.activity} /></section><section className="panel workflow-panel"><PanelHeading title="CareLoop workflow" /><Workflow /><p className="workflow-note">Identify → understand → intervene → patient responds → care team follows through.</p></section></div>
  </>
}

function KpiCard({ label, value, icon, tone, trend }: { label: string; value: number; icon: React.ReactNode; tone: string; trend?: string }) {
  return <div className="kpi-card"><div className={`kpi-icon ${tone}`}>{icon}</div><span className="kpi-label">{label}</span><strong className="kpi-value">{value}</strong>{trend && <span className="kpi-trend muted">{trend}</span>}</div>
}
function ArrowUpRight({ size }: { size: number }) { return <ArrowRight size={size} className="arrow-up-right" /> }
function PanelHeading({ title, action }: { title: string; action?: React.ReactNode }) { return <div className="panel-heading"><h2>{title}</h2>{action}</div> }
function StatusBadge({ status }: { status: string }) { const key = status.toLowerCase(); const tone = key.includes('confirmed') || key.includes('completed') || key.includes('responded') || key.includes('sent') ? 'success' : key.includes('reschedule') || key.includes('pending') || key.includes('waiting') ? 'warning' : key.includes('action') || key.includes('escalated') || key.includes('overdue') || key.includes('no response') ? 'danger' : 'neutral'; return <span className={`status-badge ${tone}`}><span className="badge-icon">{tone === 'success' ? <Check size={12} /> : tone === 'danger' ? <AlertCircle size={12} /> : <Clock3 size={12} />}</span>{status}</span> }
function Avatar({ initials, tone = 'blue' }: { initials: string; tone?: string }) { return <span className={`avatar avatar-${tone}`}>{initials}</span> }

function QueueTable({ patients, onSelectPatient }: { patients: Patient[]; onSelectPatient: (id: string) => void }) {
  if (!patients.length) return null
  return <div className="table-wrap"><table className="data-table worklist-table"><thead><tr><th>Patient / program</th><th>Last known activity</th><th>Priority / reason</th><th>Next expected review</th><th>Assigned to</th><th>Response / status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{patients.map((patient) => <tr key={patient.id} onClick={() => onSelectPatient(patient.id)}><td><div className="patient-cell"><Avatar initials={patient.initials} /><div><strong>{patient.name}</strong><span>{patient.id} · {patient.program}</span></div></div></td><td><strong>{patient.lastActivity}</strong><span className="table-sub">{patient.lastActivity === 'No activity recorded' ? 'Awaiting first activity' : `${patient.daysSinceActivity} days ago`}</span></td><td><PriorityBadge priority={patient.priority} /><span className="table-sub reason-cell">{patient.priorityReason}</span></td><td><strong>{patient.nextExpectedReview}</strong><span className="table-sub">{patient.nextFollowup} · {patient.time}</span></td><td><div className="assigned-cell"><Avatar initials={patient.assigned === 'Unassigned' ? '?' : patient.assigned.split(' ').map((x) => x[0]).join('')} tone="gray" />{patient.assigned}</div></td><td><strong>{patient.response}</strong><span className="table-sub"><StatusBadge status={patient.status} /></span></td><td><button className="row-action" onClick={(event) => { event.stopPropagation(); onSelectPatient(patient.id) }}>Open record <ChevronRight size={15} /></button></td></tr>)}</tbody></table></div>
}

function PriorityBadge({ priority }: { priority: Patient['priority'] }) { return <span className={`priority-badge priority-${priority.toLowerCase()}`}><span />{priority} priority</span> }

function AttentionCard({ patientId, reason, time, owner, tone, onClick }: { patientId: string; reason: string; time: string; owner: string; tone: string; onClick: () => void }) { return <button className="attention-card" onClick={onClick}><div className={`attention-marker ${tone}`} /><div className="attention-copy"><strong>{patientId}</strong><span>{reason}</span><small>{time} · {owner}</small></div><ChevronRight size={16} /></button> }
function ActivityTimeline({ items }: { items: Activity[] }) { return items.length ? <div className="timeline">{items.map((item) => <div className="timeline-item" key={item.id}><div className={`timeline-marker ${item.tone}`}><span /></div><div><strong>{item.time}</strong><span>{item.text}</span></div></div>)}</div> : <EmptyState title="No recent activity" body="Follow-up and patient-response events will appear here." /> }
function Workflow() { return <div className="workflow"><div className="workflow-line" />{[['Scheduled', 'CalendarDays'], ['Reminder', 'Send'], ['Response', 'MessageSquare'], ['Action', 'Zap'], ['Completion', 'Check']].map(([label, icon], index) => <div className="workflow-step" key={label}><div className={`workflow-icon ${index === 4 ? 'complete' : ''}`}>{icon === 'CalendarDays' ? <CalendarDays size={16} /> : icon === 'Send' ? <Send size={16} /> : icon === 'MessageSquare' ? <MessageSquare size={16} /> : icon === 'Zap' ? <Zap size={16} /> : <Check size={16} />}</div><span>{label}</span></div>)}</div> }

function FollowUps({ state, onSelectPatient, onSendReminder, navigate, onCreate, onAddPatient }: { state: AppState; onSelectPatient: (id: string) => void; onSendReminder: (id: string) => void; navigate: (route: Route) => void; onCreate: () => void; onAddPatient: () => void }) {
  const [tab, setTab] = useState('All'); const [query, setQuery] = useState(''); const [program, setProgram] = useState('All programs'); const [owner, setOwner] = useState('All owners')
  const tabs = ['All', 'Due today', 'Overdue', 'Awaiting response', 'Completed']
  const filtered = state.patients.filter((patient) => (`${patient.id} ${patient.name} ${patient.status} ${patient.program} ${patient.lastActivity} ${patient.priorityReason}`).toLowerCase().includes(query.toLowerCase()))
    .filter((patient) => program === 'All programs' || patient.program === program)
    .filter((patient) => owner === 'All owners' || patient.assigned === owner)
    .filter((patient) => tab === 'All' || (tab === 'Due today' && patient.nextExpectedReview.toLowerCase().includes('today')) || (tab === 'Overdue' && patient.nextExpectedReview.toLowerCase().includes('overdue')) || (tab === 'Awaiting response' && patient.response !== 'Confirmed') || (tab === 'Completed' && patient.status === 'Completed'))
    .sort((a, b) => ({ High: 0, Medium: 1, Low: 2 }[a.priority] - { High: 0, Medium: 1, Low: 2 }[b.priority]) || b.daysSinceActivity - a.daysSinceActivity)
  return <><PageHeader eyebrow="ONE SHARED PATIENT QUEUE" title="Patients & follow-up" subtitle="Find a patient, review their care context, and track the next action from one prioritized list." action={<div className="overview-actions"><button className="button button-secondary" onClick={() => navigate('/calendar')}><CalendarDays size={15} /> Calendar</button><button className="button button-secondary" onClick={onAddPatient}><Plus size={15} /> Add patient</button><button className="button button-primary" onClick={onCreate}><Plus size={16} /> Create intervention</button></div>} /><div className="filter-bar"><label className="inline-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient, care program, activity" /></label><select className="filter-select" value={program} onChange={(event) => setProgram(event.target.value)}><option>All programs</option>{Array.from(new Set(state.patients.map((p) => p.program))).map((item) => <option key={item}>{item}</option>)}</select><select className="filter-select" value={owner} onChange={(event) => setOwner(event.target.value)}><option>All owners</option>{Array.from(new Set(state.patients.map((p) => p.assigned))).map((item) => <option key={item}>{item}</option>)}</select><button className="button button-secondary" onClick={() => navigate('/tasks')}><ClipboardList size={15} /> Team actions</button><button className="button button-secondary" onClick={() => navigate('/analytics')}><BarChart3 size={15} /> Patient analysis</button></div><div className="tabs">{tabs.map((item) => <button className={tab === item ? 'tab-active' : ''} key={item} onClick={() => setTab(item)}>{item}<span>{item === 'All' ? state.patients.length : item === 'Overdue' ? state.patients.filter((p) => p.nextExpectedReview.toLowerCase().includes('overdue')).length : item === 'Awaiting response' ? state.patients.filter((p) => p.response !== 'Confirmed').length : ''}</span></button>)}</div><section className="panel page-panel"><QueueTable patients={filtered} onSelectPatient={onSelectPatient} />{filtered.length === 0 && <EmptyState title="No patients found" body="Try changing the search, program, owner, or status filter." action={<button className="button button-secondary" onClick={() => { setQuery(''); setTab('All'); setProgram('All programs'); setOwner('All owners') }}>Clear filters</button>} />}</section><div className="page-footnote"><span>Showing {filtered.length} of {state.patients.length} patient records</span><button className="text-button" onClick={() => navigate('/reschedules')}>Review patient time requests <ArrowRight size={15} /></button></div><div className="worklist-helper"><InfoGlyph /> Priority is based on follow-up rules: time since activity, overdue review, patient response, and assigned ownership.</div></>
}
function FilterSelect({ label }: { label: string }) { return <button className="filter-select">{label}<ChevronDown size={15} /></button> }

function TeamManagementPage({ teamMembers, patients, tasks, onAdd, onToggle, navigate }: { teamMembers: TeamMember[]; patients: Patient[]; tasks: Task[]; onAdd: () => void; onToggle: (id: string) => void; navigate: (route: Route) => void }) {
  const active = teamMembers.filter((member) => member.status === 'Active')
  const unassigned = tasks.filter((task) => task.status !== 'Completed' && task.owner === 'Unassigned').length
  const responsibilities = [
    { role: 'Doctors', initials: 'DR', copy: 'Review patient records, confirm care plans, and decide the next clinical follow-up.' },
    { role: 'Care coordinators', initials: 'CC', copy: 'Own the follow-up queue, coordinate departments, and track patient responses.' },
    { role: 'Operational staff', initials: 'ST', copy: 'Log contact attempts, support scheduling, and flag overdue actions for the team.' },
  ]
  return <>
    <PageHeader eyebrow="COORDINATED CARE TEAM" title="Care team" subtitle="Manage staff, see workload ownership, and keep each follow-up moving across roles." action={<button className="button button-primary" onClick={onAdd}><Plus size={16} /> Add team member</button>} />
    <div className="team-kpi-grid"><div className="team-kpi"><span>Active team members</span><strong>{active.length}</strong><small>Roster members available for assignment</small></div><div className="team-kpi"><span>Doctors</span><strong>{active.filter((member) => member.role === 'Doctor').length}</strong><small>Across the listed care programs</small></div><div className="team-kpi"><span>Patients assigned</span><strong>{patients.filter((patient) => patient.assigned !== 'Unassigned').length}</strong><small>Current coordination ownership</small></div><div className={`team-kpi ${unassigned ? 'team-kpi-alert' : ''}`}><span>Unassigned actions</span><strong>{unassigned}</strong><small>Open actions that need an owner</small></div></div>
    <section className="panel team-directory-panel"><div className="panel-heading"><div><h2>Team directory</h2><p className="team-panel-subtitle">Manage roster availability and see current workload at a glance.</p></div><span className="chart-total">{teamMembers.length} roster members</span></div><div className="team-directory-grid">{teamMembers.map((member) => {
      const activeTasks = tasks.filter((task) => task.owner === member.name && task.status !== 'Completed').length
      const assignedPatients = patients.filter((patient) => patient.assigned === member.name).length
      return <article className={`team-member-card ${member.status === 'Inactive' ? 'team-member-inactive' : ''}`} key={member.id}><div className="team-member-card-head"><Avatar initials={member.name.split(' ').map((part) => part[0]).join('').slice(0, 2)} tone={member.role === 'Doctor' ? 'blue' : 'gray'} /><div className="team-member-identity"><strong>{member.name}</strong><span>{member.role}</span></div><StatusBadge status={member.status} /></div><div className="team-program"><span>Care program</span><strong>{member.program}</strong></div><div className="team-workload"><div><strong>{assignedPatients}</strong><span>patients</span></div><div><strong>{activeTasks}</strong><span>open actions</span></div></div><div className="team-card-actions"><button className="button button-secondary" onClick={() => navigate('/tasks')}><ClipboardList size={14} /> View actions</button><button className={`button ${member.status === 'Active' ? 'button-quiet' : 'button-primary'}`} onClick={() => onToggle(member.id)}>{member.status === 'Active' ? 'Set inactive' : 'Reactivate'}</button></div></article>
    })}</div></section>
    <section className="panel staff-responsibilities"><div className="panel-heading"><div><h2>Role responsibilities</h2><p className="team-panel-subtitle">A shared operating guide for who moves each part of the follow-up loop.</p></div><span className="chart-total">Team workflow</span></div><div className="staff-role-grid">{responsibilities.map((item) => <article className="staff-role-card" key={item.role}><span className="staff-role-avatar">{item.initials}</span><div><strong>{item.role}</strong><p>{item.copy}</p></div></article>)}</div><p className="staff-role-note">These are workflow responsibilities as a workflow guide; account permissions are enforced separately.</p></section>
    <section className="team-coordination-note"><Users size={17} /><span><strong>Assignments stay visible in the shared workflow.</strong> Changes to the roster update staff choices for new follow-up assignments. Existing patient and task records remain available for review.</span></section>
  </>
}

function AddTeamMemberModal({ onClose, onCreate }: { onClose: () => void; onCreate: (member: Omit<TeamMember, 'id' | 'status'>) => void }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState<TeamMember['role']>('Care coordinator')
  const [program, setProgram] = useState('Cross-program coordination')
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="add-team-member-title"><div className="modal-header"><div><span className="eyebrow">TEAM ROSTER</span><h2 id="add-team-member-title">Add team member</h2><p>Add a team roster member for follow-up ownership and care coordination.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div><div className="modal-form-grid"><label className="field-label modal-wide-field">Name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" /></label><label className="field-label">Role<select value={role} onChange={(event) => setRole(event.target.value as TeamMember['role'])}><option>Doctor</option><option>Care coordinator</option><option>Nurse</option><option>Staff</option></select></label><label className="field-label">Care program<select value={program} onChange={(event) => setProgram(event.target.value)}><option>Cross-program coordination</option><option>General Medicine</option><option>Diabetes care</option><option>Maternal health</option><option>Oncology</option></select></label></div><div className="modal-footer"><button className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={!name.trim()} onClick={() => onCreate({ name: name.trim(), role, program })}><Plus size={15} /> Add to roster</button></div></section></div>
}

function CreatePatientModal({ staff: team, onClose, onCreate }: { staff: string[]; onClose: () => void; onCreate: (input: NewSharedPatient) => Promise<void> }) {
  const [name, setName] = useState('')
  const [program, setProgram] = useState('')
  const [department, setDepartment] = useState('')
  const [doctor, setDoctor] = useState(team.find((person) => person.startsWith('Dr.')) ?? team[0] ?? '')
  const [assigned, setAssigned] = useState(team[0] ?? 'Unassigned')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-patient-title"><div className="modal-header"><div><span className="eyebrow">PATIENT INTAKE · CARE COORDINATION</span><h2 id="create-patient-title">Add a patient</h2><p>Create a coordination record and persist it in the connected API.</p></div><button className="icon-button" onClick={onClose} aria-label="Close" disabled={saving}><X size={18} /></button></div><div className="modal-form-grid"><label className="field-label modal-wide-field">Patient name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter patient name" /></label><label className="field-label">Care program<select value={program} onChange={(event) => { setProgram(event.target.value); if (event.target.value === 'Maternal health') setDepartment('Maternal health'); else if (event.target.value === 'Cancer follow-up') setDepartment('Oncology'); else setDepartment('General Medicine') }}><option value="">Select a care program</option><option>Diabetes care</option><option>Maternal health</option><option>Cancer follow-up</option><option>General Medicine</option></select></label><label className="field-label">Department<input value={department} onChange={(event) => setDepartment(event.target.value)} /></label><label className="field-label">Assigned doctor<select value={doctor} onChange={(event) => setDoctor(event.target.value)}>{team.filter((person) => person.startsWith('Dr.')).map((person) => <option key={person}>{person}</option>)}</select></label><label className="field-label">Care-team owner<select value={assigned} onChange={(event) => setAssigned(event.target.value)}><option>Unassigned</option>{team.map((person) => <option key={person}>{person}</option>)}</select></label><label className="field-label">First follow-up date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label className="field-label">Appointment time<select value={time} onChange={(event) => setTime(event.target.value)}><option value="">Select a time</option><option>09:15 AM</option><option>10:30 AM</option><option>11:00 AM</option><option>02:00 PM</option><option>03:00 PM</option></select></label></div><p className="demo-form-note"><InfoGlyph /> Enter a real patient record. Confirm the details and follow-up date before saving.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><button className="button button-secondary" onClick={onClose} disabled={saving}>Cancel</button><button className="button button-primary" disabled={!name.trim() || !program || !department.trim() || !date || !time || !doctor || saving} onClick={() => { setSaving(true); setError(''); void onCreate({ name: name.trim(), program, department, doctor, assigned, date, time }).catch((reason: Error) => { setError(reason.message); setSaving(false) }) }}><Plus size={15} /> {saving ? 'Saving…' : 'Create patient record'}</button></div></section></div>
}

function CalendarPage({ state, onSelectPatient, navigate }: { state: AppState; onSelectPatient: (id: string) => void; navigate: (route: Route) => void }) {
  const appointments = state.patients.map((patient) => ({ patient, date: new Date(patient.nextFollowup) })).filter((item) => !Number.isNaN(item.date.getTime()))
  const firstAppointment = appointments[0]?.date ?? new Date()
  const [month, setMonth] = useState(() => new Date(firstAppointment.getFullYear(), firstAppointment.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState(() => new Date(firstAppointment.getFullYear(), firstAppointment.getMonth(), firstAppointment.getDate()))
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay()
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => index - firstWeekday + 1)
  const dayAppointments = appointments.filter(({ date }) => date.getFullYear() === selectedDay.getFullYear() && date.getMonth() === selectedDay.getMonth() && date.getDate() === selectedDay.getDate()).sort((a, b) => a.patient.time.localeCompare(b.patient.time))
  const monthAppointments = appointments.filter(({ date }) => date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth())
  const highPriorityCount = state.patients.filter((patient) => patient.priority === 'High' && patient.status !== 'Completed').length
  const shiftMonth = (amount: number): void => { const next = new Date(month.getFullYear(), month.getMonth() + amount, 1); setMonth(next); setSelectedDay(next) }
  const selectToday = (): void => { const today = new Date(); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(new Date(today.getFullYear(), today.getMonth(), today.getDate())) }
  return <>
    <PageHeader eyebrow="SHARED FOLLOW-UP SCHEDULE" title="Care team calendar" subtitle="See each patient's scheduled review, assigned clinician, and follow-up status by day." action={<button className="button button-primary" onClick={() => navigate('/follow-ups')}><Users size={15} /> Open patient worklist</button>} />
    <div className="calendar-summary-grid"><div className="calendar-summary-card"><span>Scheduled this month</span><strong>{monthAppointments.length}</strong><small>Patient reviews in the selected month</small></div><div className="calendar-summary-card"><span>Needs follow-up</span><strong>{state.patients.filter((patient) => patient.response !== 'Confirmed').length}</strong><small>Awaiting a patient response</small></div><div className="calendar-summary-card calendar-summary-alert"><span>High priority</span><strong>{highPriorityCount}</strong><small>Review the worklist for next actions</small></div></div>
    <div className="calendar-layout">
      <section className="panel calendar-panel">
        <div className="calendar-heading"><div><span className="eyebrow">APPOINTMENT SCHEDULE</span><h2>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2></div><div className="calendar-controls"><button className="button button-secondary calendar-today" onClick={selectToday}>Today</button><button className="icon-button" aria-label="Previous month" onClick={() => shiftMonth(-1)}><ArrowLeft size={16} /></button><button className="icon-button" aria-label="Next month" onClick={() => shiftMonth(1)}><ArrowRight size={16} /></button></div></div>
        <div className="calendar-grid calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday) => <div key={weekday}>{weekday}</div>)}</div>
        <div className="calendar-grid calendar-days">{cells.map((day, index) => {
          if (day < 1 || day > daysInMonth) return <div className="calendar-cell calendar-outside" key={`empty-${index}`} />
          const cellDate = new Date(month.getFullYear(), month.getMonth(), day)
          const events = appointments.filter(({ date }) => date.getFullYear() === cellDate.getFullYear() && date.getMonth() === cellDate.getMonth() && date.getDate() === day)
          const selected = cellDate.toDateString() === selectedDay.toDateString()
          return <button className={`calendar-cell ${selected ? 'calendar-selected' : ''} ${events.length ? 'calendar-has-events' : ''}`} key={day} onClick={() => setSelectedDay(cellDate)} aria-label={`${cellDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}${events.length ? `, ${events.length} appointments` : ''}`}><span className="calendar-day-number">{day}</span>{events.slice(0, 2).map(({ patient }) => <span className={`calendar-event calendar-event-${patient.priority.toLowerCase()}`} key={patient.id}>{patient.name}</span>)}{events.length > 2 && <span className="calendar-more">+{events.length - 2} more</span>}</button>
        })}</div>
        <div className="calendar-legend"><span><i className="calendar-dot high" />High priority</span><span><i className="calendar-dot medium" />Follow-up requested</span><span><i className="calendar-dot low" />On track</span></div>
      </section>
      <aside className="calendar-agenda panel"><div className="agenda-heading"><span className="eyebrow">DAY PLAN</span><h2>{selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2><p>{dayAppointments.length} scheduled patient review{dayAppointments.length === 1 ? '' : 's'}</p></div>{dayAppointments.length ? <div className="agenda-list">{dayAppointments.map(({ patient }) => <button className="agenda-event" key={patient.id} onClick={() => onSelectPatient(patient.id)}><span className={`agenda-priority agenda-${patient.priority.toLowerCase()}`} /><span className="agenda-time">{patient.time}</span><Avatar initials={patient.initials} /><span className="agenda-patient"><strong>{patient.name}</strong><small>{patient.program} · {patient.assigned === 'Unassigned' ? 'Owner needed' : patient.assigned}</small><StatusBadge status={patient.status} /></span><ChevronRight size={16} /></button>)}</div> : <div className="agenda-empty"><CalendarDays size={25} /><strong>No reviews scheduled</strong><span>Choose another day or schedule a follow-up from the patient worklist.</span><button className="button button-secondary" onClick={() => navigate('/follow-ups')}>Browse patients</button></div>}<div className="agenda-footer"><button className="text-button" onClick={() => navigate('/reschedules')}>Review reschedule requests <ArrowRight size={14} /></button></div></aside>
    </div>
  </>
}

function CreateFollowupModal({ patients, staff: team, initialPatientId, onClose, onCreate }: { patients: Patient[]; staff: string[]; initialPatientId?: string; onClose: () => void; onCreate: (patientId: string, title: string, owner: string, due: string) => void }) {
  const [patientId, setPatientId] = useState(initialPatientId ?? patients[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState('Unassigned')
  const [due, setDue] = useState('')
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal create-followup-modal" role="dialog" aria-modal="true" aria-labelledby="create-followup-title"><div className="modal-header"><div><span className="eyebrow">CARE-TEAM INTERVENTION</span><h2 id="create-followup-title">Create follow-up action</h2><p>Assign a clear next step and track it on the shared team worklist.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div><div className="modal-form-grid"><label className="field-label">Patient<select value={patientId} onChange={(event) => setPatientId(event.target.value)}>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name} · {patient.program}</option>)}</select></label><label className="field-label">Assigned to<select value={owner} onChange={(event) => setOwner(event.target.value)}>{['Unassigned', ...team].map((person) => <option key={person}>{person}</option>)}</select></label><label className="field-label modal-wide-field">Next intervention<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="field-label">Due<select value={due} onChange={(event) => setDue(event.target.value)}><option value="">Select due date</option><option>Today</option><option>Tomorrow</option><option>Within 7 days</option></select></label></div><div className="modal-footer"><button className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={!patientId || !title.trim() || !due} onClick={() => onCreate(patientId, title.trim(), owner, due)}><Check size={16} /> Add to worklist</button></div></section></div>
}

function Patients({ state, onSelectPatient }: { state: AppState; onSelectPatient: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const patients = state.patients.filter((p) => `${p.id} ${p.name} ${p.program} ${p.department}`.toLowerCase().includes(query.toLowerCase()))
  return <><PageHeader eyebrow="UNIFIED PATIENT DIRECTORY" title="Patients" subtitle="Open any patient to review their care activity, follow-up plan, team ownership, and report." /><section className="panel page-panel"><div className="section-toolbar"><label className="inline-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient, program, or ID" /></label><span className="toolbar-meta">{patients.length} patient records · select a name to open full record</span></div><QueueTable patients={patients} onSelectPatient={onSelectPatient} />{patients.length === 0 && <EmptyState title="No patients found" body="Add a patient record to begin. Records are not preloaded." />}</section></>
}

function PatientDetail({ patient, state, communications, onBack, onSendReminder, onContact, onEscalate, onConfirm, onCreateTask }: { patient: Patient; state: AppState; communications: Communication[]; onBack: () => void; onSendReminder: (id: string) => void; onContact: (id: string) => void; onEscalate: (id: string) => void; onConfirm: (id: string) => void; onCreateTask: () => void }) {
  const tasks = state.tasks.filter((task) => task.patientId === patient.id)
  const careTimeline: Activity[] = []
  return <div className="patient-detail-page">
    <div className="detail-back-row"><button className="text-button" onClick={onBack}><ArrowLeft size={16} /> Back to patients</button><span className="demo-tag">PATIENT COORDINATION RECORD</span></div>
    <PageHeader eyebrow={`${patient.program.toUpperCase()} · ${patient.id}`} title={patient.name} subtitle={`${patient.department} · Coordinated by ${patient.doctor} and the care team`} action={<PriorityBadge priority={patient.priority} />} />
    <div className="patient-detail-actions"><button className="button button-primary" onClick={onCreateTask}><Plus size={16} /> Create intervention</button><button className="button button-secondary" onClick={() => onContact(patient.id)}><PhoneIcon /> Record contact</button><button className="button button-secondary" onClick={() => onSendReminder(patient.id)}><Send size={15} /> Send reminder</button><button className="button button-secondary" onClick={() => onEscalate(patient.id)}><AlertCircle size={15} /> Escalate</button></div>
    <div className="patient-detail-grid">
      <div className="patient-detail-main">
        <section className="panel patient-summary-panel"><div className="patient-summary-heading"><Avatar initials={patient.initials} tone="blue" /><div><span className="eyebrow">FOLLOW-UP PRIORITY</span><h2>{patient.priority} · {patient.priorityReason}</h2><p>Priority is a transparent workflow cue based on recorded follow-up activity, not a clinical prediction.</p></div><StatusBadge status={patient.status} /></div><div className="patient-facts-grid"><DetailFact label="Care program" value={patient.program} /><DetailFact label="Last known activity" value={patient.lastActivity === 'No activity recorded' ? patient.lastActivity : `${patient.lastActivity} · ${patient.daysSinceActivity} days ago`} /><DetailFact label="Next expected review" value={`${patient.nextExpectedReview} · ${patient.nextFollowup}`} /><DetailFact label="Assigned doctor" value={patient.doctor} /><DetailFact label="Care-team owner" value={patient.assigned} /><DetailFact label="Patient response" value={patient.response} /><DetailFact label="Care-team next action" value={patient.nextAction ?? 'No next action recorded'} /></div><p className="shared-app-note">{patient.reportUrl ? `Patient-facing updates for ${patient.id} appear in the iOS simulator app through the connected API.` : 'No patient-facing update or report has been recorded yet.'}</p></section>
        <section className="panel detail-section"><PanelHeading title="Unified last-known care activity" action={<span className="source-context">Care activity</span>} /><div className="unified-timeline">{careTimeline.length ? careTimeline.map((item) => <div className="unified-event" key={item.id}><div className={`timeline-marker ${item.tone}`}><span /></div><div><strong>{item.time}</strong><p>{item.text}</p></div><span className="source-tag">Recorded activity</span></div>) : <EmptyState title="No care activity recorded" body="Appointments, investigations, treatment milestones, and contact history will appear when recorded." />}</div><p className="integration-note"><InfoGlyph /> Activity shown here comes from records entered by the care team or the connected API. No external hospital integrations are configured.</p></section>
        <section className="panel detail-section"><PanelHeading title="Follow-up interventions" action={<button className="text-button" onClick={onCreateTask}><Plus size={14} /> Add action</button>} />{tasks.length ? <div className="detail-task-list">{tasks.map((task) => <div className="detail-task-row" key={task.id}><span className={`task-check ${task.status === 'Completed' ? 'task-done' : ''}`}><Check size={12} /></span><div><strong>{task.task}</strong><span>{task.owner} · Due {task.due}</span></div><StatusBadge status={task.status} /></div>)}</div> : <EmptyState title="No intervention recorded" body="Create an action, assign an owner, and track its completion here." />}</section>
        <section className="panel detail-section"><PanelHeading title="Contact and response history" action={<span className="source-context">{communications.length} events</span>} />{communications.length ? <div className="communication-history">{communications.map((event) => <div key={event.id}><span className="history-marker" /><div><strong>{event.type}</strong><p>{event.response} · {event.status}</p><small>{event.sent} · recorded by {event.approvedBy}</small></div></div>)}</div> : <EmptyState title="No contact history recorded" body="Contact events will appear here after they are recorded." />}</section>
      </div>
      <aside className="patient-detail-side">
        <section className="panel report-panel"><PanelHeading title="Patient report" action={patient.reportUrl ? <a className="text-button report-download" href={patient.reportUrl} download><FileText size={14} /> Download PDF</a> : undefined} />{patient.reportUrl ? <><div className="report-meta"><FileText size={17} /><div><strong>{patient.program} · care summary</strong><span>{patient.lastActivity}</span></div></div><iframe className="report-viewer" src={`${patient.reportUrl}#view=FitH`} title={`Patient report for ${patient.name}`} /></> : <EmptyState title="No report attached yet" body="A report will appear here after the care team attaches one." />}</section>
        <section className="panel detail-section next-action-panel"><PanelHeading title="Next expected action" /><div className="next-action-copy"><span className="next-action-icon"><CalendarDays size={18} /></span><div><strong>{patient.nextExpectedReview}</strong><p>{patient.priorityReason}</p></div></div><button className="button button-primary full-button" onClick={() => onConfirm(patient.id)}><CheckCircle2 size={16} /> Mark next step confirmed</button><p className="shared-app-note">{patient.reportUrl ? 'Patient-facing updates appear in the CareLoop iOS simulator app through the connected API.' : 'Patient-facing updates are available when this patient is connected to the CareLoop app.'}</p></section>
      </aside>
    </div>
  </div>
}

function DetailFact({ label, value }: { label: string; value: string }) { return <div className="patient-fact"><span>{label}</span><strong>{value}</strong></div> }
function PhoneIcon() { return <MessageSquare size={15} /> }
function InfoGlyph() { return <FileText size={14} /> }

function MessagesPage({ patients }: { patients: Patient[] }) {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const patient = patients.find((item) => item.id === selectedPatientId) ?? null
  const [messages, setMessages] = useState<SharedMessage[]>([])
  const [previews, setPreviews] = useState<Record<string, SharedMessage | undefined>>({})
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [attachment, setAttachment] = useState<SharedMessage['attachment']>()
  const [sending, setSending] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const thread = useRef<HTMLDivElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    const refreshPreviews = async () => {
      const latest = await Promise.all(patients.map(async (item) => {
        try {
          const conversation = await getSharedMessages(item.id)
          return [item.id, conversation.length ? conversation[conversation.length - 1] : undefined] as const
        } catch { return [item.id, undefined] as const }
      }))
      if (active) setPreviews(Object.fromEntries(latest))
    }
    void refreshPreviews()
    const timer = window.setInterval(() => void refreshPreviews(), 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [patients])

  useEffect(() => {
    let active = true
    setMessages([])
    if (!patient) return () => { active = false }
    const refresh = () => void getSharedMessages(patient.id).then((latest) => { if (active) setMessages(latest) }).catch(() => undefined)
    refresh()
    const timer = window.setInterval(refresh, 1400)
    const events = subscribeToSharedMessages(patient.id, (message) => setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]))
    return () => { active = false; window.clearInterval(timer); events.close() }
  }, [patient?.id])

  useEffect(() => { thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: 'smooth' }) }, [messages.length, selectedPatientId])

  const send = async (text = draft.trim(), file = attachment) => {
    if ((!text && !file) || sending || !patient) return
    setSending(true)
    try {
      const saved = await sendSharedMessage({ patientId: patient.id, sender: 'care-team', text, ...(file ? { attachment: file } : {}) })
      setMessages((current) => current.some((item) => item.id === saved.id) ? current : [...current, saved])
      setDraft(''); setAttachment(undefined)
    } catch { window.dispatchEvent(new CustomEvent('careloop:toast', { detail: 'Message could not be sent. Check the CareLoop API connection and retry.' })) }
    finally { setSending(false) }
  }

  const addImage = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 850_000) { window.dispatchEvent(new CustomEvent('careloop:toast', { detail: 'Choose an image smaller than 850 KB.' })); return }
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') setAttachment({ kind: 'image', name: file.name, mimeType: file.type || 'image/jpeg', data: reader.result }) }
    reader.readAsDataURL(file)
  }

  const filteredPatients = patients.filter((item) => `${item.name} ${item.id} ${item.program} ${item.doctor}`.toLowerCase().includes(search.trim().toLowerCase()))
  const openConversation = (id: string) => { setSelectedPatientId(id); setDraft(''); setAttachment(undefined) }

  return <>
    <PageHeader eyebrow="PATIENT MESSAGING" title="Messages" subtitle={patient ? `Conversation with ${patient.name} · ${patient.program} · ${patient.id}.` : 'Choose a patient to open their private care-team conversation.'} />
    <section className="message-workspace">
      <aside className="message-inbox">
        <header className="message-inbox-header">
          <div className="message-inbox-title"><span className="eyebrow">CARELOOP INBOX</span><h2>Patient messages</h2></div>
          <span className="message-inbox-count">{patients.length}</span>
        </header>
        <label className="message-search"><Search size={16} /><input ref={searchInput} aria-label="Search patients and conversations" placeholder="Search patients..." value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></label>
        <button className="message-new-button" onClick={() => { setSelectedPatientId(null); setSearch(''); setDraft(''); setAttachment(undefined); searchInput.current?.focus() }}><Plus size={16} /> New message</button>
        <div className="message-inbox-list" aria-label="Patient conversations">
          {filteredPatients.map((item) => {
            const latest = previews[item.id]
            const preview = latest?.text || (latest?.attachment ? `Shared ${latest.attachment.kind}` : item.nextAction ?? 'Start a care-team conversation')
            return <button className={`message-inbox-row ${patient?.id === item.id ? 'message-inbox-row-active' : ''}`} key={item.id} onClick={() => openConversation(item.id)} aria-current={patient?.id === item.id ? 'page' : undefined}>
              <span className="message-inbox-avatar">{item.initials}</span>
              <span className="message-inbox-copy"><strong>{item.name}</strong><small>{item.id} · {item.program}</small><span>{preview}</span></span>
              <ChevronRight size={15} />
            </button>
          })}
          {filteredPatients.length === 0 && <div className="message-inbox-empty">No patients match “{search}”.</div>}
        </div>
        <p className="message-inbox-note">Private, patient-specific conversations</p>
      </aside>
      <div className="message-thread-panel">
        {patient ? <>
        <header className="message-thread-header">
          <div className="message-patient-avatar">{patient.initials}</div>
          <div className="message-patient-title"><strong>{patient.name}</strong><span>{patient.id} · {patient.program} · {patient.doctor}</span></div>

          <button className="message-call" aria-label="Start video visit" title="Arrange a video visit" onClick={() => window.dispatchEvent(new CustomEvent('careloop:toast', { detail: 'Video visits can be arranged by calling the patient.' }))}><Video size={18} /></button>
          {patient.reportUrl && <a className="message-call" href={patient.reportUrl} target="_blank" rel="noreferrer" aria-label={`Open ${patient.name} report`}><FileText size={17} /></a>}
        </header>
        <div className="message-thread" ref={thread} aria-live="polite">
          {messages.map((message) => <div className={`chat-row ${message.sender === 'care-team' ? 'chat-row-team' : 'chat-row-patient'}`} key={message.id}>
            <article className={`chat-bubble ${message.sender === 'care-team' ? 'chat-bubble-team' : 'chat-bubble-patient'}`}>
              {message.attachment?.kind === 'image' && <img className="chat-image" src={message.attachment.data} alt={message.attachment.name} />}
              {message.attachment?.kind === 'report' && <a className="chat-report" href={message.attachment.data} target="_blank" rel="noreferrer"><FileText size={19} /><span><strong>Care coordination report</strong><small>{message.attachment.name}</small></span><ArrowRight size={15} /></a>}
              {message.text && <p>{message.text}</p>}
              <time>{new Date(message.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time>
            </article>
          </div>)}
          {messages.length === 0 && <EmptyState title="No messages yet" body="Send a message to begin the shared care conversation." />}
        </div>
        {attachment && <div className="message-pending-attachment"><ImageIcon size={16} /><span>{attachment.name}</span><button onClick={() => setAttachment(undefined)} aria-label="Remove attachment"><X size={15} /></button></div>}
        <form className="message-composer" onSubmit={(event) => { event.preventDefault(); void send() }}>
          <input ref={fileInput} hidden type="file" accept="image/*" onChange={(event) => { addImage(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} />
          <button type="button" className="message-tool" onClick={() => fileInput.current?.click()} aria-label="Attach image"><Paperclip size={18} /></button>
          <button type="button" className="message-tool" onClick={() => void send(`Shared report: ${patient.program} care coordination summary`, { kind: 'report', name: `${patient.id}-report.pdf`, mimeType: 'application/pdf', data: new URL(patient.reportUrl, window.location.origin).href })} aria-label="Share report" disabled={!patient.reportUrl}><FileText size={18} /></button>
          <textarea aria-label="Write a message" placeholder={`Write a message to ${patient.name}…`} rows={1} maxLength={1200} value={draft} onChange={(event) => setDraft(event.target.value)} />
          <button className="button button-primary message-send" type="submit" disabled={sending || (!draft.trim() && !attachment)}><Send size={15} /> Send</button>
        </form>
        </> : <><header className="message-empty-header">Select a conversation</header><div className="message-welcome"><div className="message-welcome-icon"><MessageSquare size={33} /></div><h2>Choose a patient to start</h2><p>Select a patient from your inbox to review their conversation, share a report, or send a message.</p><button className="message-welcome-cta" onClick={() => searchInput.current?.focus()}><Search size={15} /> Find a patient</button><div className="message-guideline"><span><AlertCircle size={16} /></span><div><strong>Keep messages focused on care</strong><p>Conversations are shown in the selected patient’s patient conversation and stay separate from other records.</p></div></div></div></>}
      </div>
    </section>
  </>
}

function CommunicationPage({ state, onSendReminder, onSelectPatient }: { state: AppState; onSendReminder: (id: string) => void; onSelectPatient: (id: string) => void }) { const [tab, setTab] = useState('All'); const [draftOpen, setDraftOpen] = useState(false); const filtered = state.communications.filter((item) => tab === 'All' || item.status === tab); return <><PageHeader title="Communication" subtitle="Track approved patient follow-up communications." action={state.patients.length ? <button className="button button-primary" onClick={() => setDraftOpen(true)}><Sparkles size={16} /> Draft reminder</button> : undefined} /><div className="tabs">{['All', 'Awaiting Response', 'Sent', 'Responded', 'Escalated'].map((item) => <button className={tab === item ? 'tab-active' : ''} key={item} onClick={() => setTab(item)}>{item}</button>)}</div><div className="communication-grid">{filtered.map((item) => <CommunicationCard key={item.id} item={item} onOpen={() => onSelectPatient(item.patientId)} />)}</div>{filtered.length === 0 && <EmptyState title="No communication here" body="Approved follow-up communications will appear here." />}{draftOpen && <DraftAssistant patients={state.patients} onClose={() => setDraftOpen(false)} onSend={(patientId) => { onSendReminder(patientId); setDraftOpen(false) }} />}</> }
function CommunicationCard({ item, onOpen }: { item: Communication; onOpen: () => void }) { return <button className="communication-card" onClick={onOpen}><div className="card-topline"><span className="mini-icon blue"><Mail size={15} /></span><StatusBadge status={item.status} /></div><div className="communication-title"><strong>{item.patientId}</strong><span>{item.type}</span></div><div className="communication-details"><div><span>Created</span><strong>{item.created}</strong></div><div><span>Approved by</span><strong>{item.approvedBy}</strong></div><div><span>Sent</span><strong>{item.sent}</strong></div><div><span>Response</span><strong>{item.response}</strong></div></div><span className="card-link">View record <ArrowRight size={14} /></span></button> }
function DraftAssistant({ patients, onClose, onSend }: { patients: Patient[]; onClose: () => void; onSend: (id: string) => void }) { const [patientId, setPatientId] = useState(patients[0]?.id ?? ''); const [draft, setDraft] = useState(''); const patient = patients.find((p) => p.id === patientId) ?? patients[0]; return <div className="modal-backdrop"><div className="modal draft-modal"><div className="modal-header"><div><span className="eyebrow">ADMINISTRATIVE ASSISTANT</span><h2>Reminder draft assistant</h2><p>Create a clear reminder for staff approval.</p></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="assistant-note"><Sparkles size={16} /><span>AI-generated draft. Staff approval required.</span></div><label className="field-label">Patient record<select value={patientId} onChange={(event) => { setPatientId(event.target.value); const next = patients.find((p) => p.id === event.target.value); if (next) setDraft(`Hello, your follow-up appointment is scheduled for ${next.nextFollowup} at ${next.time}. Please confirm your appointment or request a different date.`) }}>{patients.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}</select></label><label className="field-label">Message<textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={5} /></label><div className="modal-footer"><button className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" onClick={() => onSend(patient.id)}><Check size={16} /> Approve & send</button></div></div></div> }

function Reschedules({ state, onApprove, onSelectPatient }: { state: AppState; onApprove: (id: string, date: string, time: string) => void; onSelectPatient: (id: string) => void }) { const [selected, setSelected] = useState<RescheduleRequest | null>(null); return <><PageHeader title="Reschedule requests" subtitle="Review and coordinate patient-requested appointment changes." action={<FilterSelect label="Pending review" />} /><div className="reschedule-grid">{state.reschedules.map((request) => <RescheduleCard key={request.id} request={request} onReview={() => setSelected(request)} onOpenPatient={() => onSelectPatient(request.patientId)} />)}</div>{state.reschedules.length === 0 && <EmptyState title="You're all caught up" body="There are no pending reschedule requests right now." />}{selected && <RescheduleModal request={selected} onClose={() => setSelected(null)} onApprove={(date, time) => { onApprove(selected.id, date, time); setSelected(null) }} />}</> }
function RescheduleCard({ request, onReview, onOpenPatient }: { request: RescheduleRequest; onReview: () => void; onOpenPatient: () => void }) { return <section className="panel reschedule-card"><div className="reschedule-card-head"><button className="patient-link" onClick={onOpenPatient}><span className="avatar avatar-amber">{request.patientId.slice(-2)}</span><strong>{request.patientId}</strong></button><StatusBadge status={request.status} /></div><div className="reschedule-compare"><div><span>Current appointment</span><strong>{request.currentDate}</strong><small>{request.currentTime}</small></div><ArrowRight size={17} /><div className="requested-date"><span>Patient requested</span><strong>{request.requestedDate}</strong><small>{request.requestedTime}</small></div></div><p className="request-message">“{request.message}”</p><div className="request-meta"><span>Received {request.received}</span><span>Patient app response</span></div><div className="card-actions"><button className="button button-primary" onClick={onReview}>Review request</button><button className="button button-secondary" onClick={onOpenPatient}>Open patient record</button></div></section> }
function RescheduleModal({ request, onClose, onApprove }: { request: RescheduleRequest; onClose: () => void; onApprove: (date: string, time: string) => void }) { const [date, setDate] = useState(request.requestedDate); const [time, setTime] = useState(request.requestedTime === 'Morning' ? '10:30 AM' : '2:00 PM'); return <div className="modal-backdrop"><div className="modal"><div className="modal-header"><div><span className="eyebrow">REVIEW RESCHEDULE REQUEST</span><h2>{request.patientId}</h2><p>{request.message}</p></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="appointment-compare"><div><span>Current appointment</span><strong>{request.currentDate}</strong><b>{request.currentTime}</b></div><ChevronRight size={18} /><div className="new-appointment"><span>Requested appointment</span><strong>{request.requestedDate}</strong><b>{request.requestedTime}</b></div></div><div className="modal-form-grid"><label className="field-label">Available date<input type="text" value={date} onChange={(event) => setDate(event.target.value)} /></label><label className="field-label">Available time<select value={time} onChange={(event) => setTime(event.target.value)}><option>10:30 AM</option><option>11:15 AM</option><option>2:00 PM</option><option>3:00 PM</option></select></label></div><div className="availability"><CheckCircle2 size={16} /><span>Availability will be checked after backend connection.</span></div><div className="modal-footer"><button className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" onClick={() => onApprove(date, time)}><Check size={16} /> Confirm new appointment</button></div></div></div> }

function TasksPage({ state, staff: team, onStatusChange, onAssign, onSelectPatient, onCreate, navigate }: { state: AppState; staff: string[]; onStatusChange: (id: string, status: TaskStatus) => void; onAssign: (id: string, owner: string) => void; onSelectPatient: (id: string) => void; onCreate: () => void; navigate: (route: Route) => void }) {
  const [tab, setTab] = useState('All')
  const filtered = state.tasks.filter((task) => tab === 'All' || (tab === 'Completed' && task.status === 'Completed') || (tab === 'My Tasks' && task.owner !== 'Unassigned') || (tab === 'Unassigned' && task.owner === 'Unassigned') || (tab === 'Due Today' && task.due === 'Today') || (tab === 'Overdue' && task.due === 'Overdue'))
  const active = state.tasks.filter((task) => task.status !== 'Completed')
  const overdue = active.filter((task) => task.due === 'Overdue')
  return <>
    <PageHeader eyebrow="DOCTOR + CARE-TEAM COORDINATION" title="Team actions" subtitle="Assign a clear next intervention, track ownership, and surface overdue work across the care team." action={<button className="button button-primary" onClick={onCreate}><Plus size={16} /> New intervention</button>} />
    <div className="team-actions-layout">
      <section className="panel page-panel team-task-panel"><div className="tabs task-tabs">{['All', 'My Tasks', 'Unassigned', 'Due Today', 'Overdue', 'Completed'].map((item) => <button className={tab === item ? 'tab-active' : ''} key={item} onClick={() => setTab(item)}>{item}<span>{item === 'All' ? state.tasks.length : item === 'Overdue' ? overdue.length : ''}</span></button>)}</div><div className="table-wrap"><table className="data-table task-table"><thead><tr><th>Next intervention</th><th>Owner</th><th>Due</th><th>Status</th><th>Update</th></tr></thead><tbody>{filtered.map((task) => <tr key={task.id}><td><button className="task-name" onClick={() => onSelectPatient(task.patientId)}><span className={`task-check ${task.status === 'Completed' ? 'task-done' : ''}`}><Check size={12} /></span><span><strong>{task.task}</strong><small>{state.patients.find((patient) => patient.id === task.patientId)?.name ?? task.patientId} · {task.patientId}</small></span></button></td><td><select className="table-select" aria-label={`Assign ${task.task}`} value={task.owner} onChange={(event) => onAssign(task.id, event.target.value)}>{['Unassigned', ...team].map((person) => <option key={person}>{person}</option>)}</select></td><td>{task.due}</td><td><StatusBadge status={task.status} /></td><td><select className="table-select" aria-label={`Update status for ${task.task}`} value={task.status} onChange={(event) => onStatusChange(task.id, event.target.value as TaskStatus)}>{['To Do', 'In Progress', 'Waiting', 'Completed'].map((status) => <option key={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div>{filtered.length === 0 && <EmptyState title="No actions in this view" body="Choose a different filter or create a new follow-up intervention." />}</section>
      <aside className="team-action-rail">
        <section className="panel team-coverage"><PanelHeading title="Care-team coverage" action={<span className="source-context">{active.length} active</span>} /><div className="team-coverage-list">{team.map((member) => { const owned = active.filter((task) => task.owner === member).length; const percent = active.length ? Math.max(8, Math.round(owned / active.length * 100)) : 0; return <div className="team-member-row" key={member}><Avatar initials={member.split(' ').map((x) => x[0]).join('')} tone="gray" /><div><strong>{member}</strong><span>{owned} active action{owned === 1 ? '' : 's'}</span><i><b style={{ width: `${percent}%` }} /></i></div></div> })}</div><div className="unassigned-callout"><AlertCircle size={16} /><span><strong>{active.filter((task) => task.owner === 'Unassigned').length} unassigned</strong><small>Assign an owner to keep follow-up moving.</small></span></div></section>
        <section className="panel team-escalation"><PanelHeading title="Overdue and escalation" /><div className="escalation-summary"><span className="escalation-number">{overdue.length}</span><div><strong>Overdue team actions</strong><small>Follow-ups needing timely review</small></div></div><div className="escalation-patients">{overdue.map((task) => <button key={task.id} onClick={() => onSelectPatient(task.patientId)}><span>{state.patients.find((patient) => patient.id === task.patientId)?.name ?? task.patientId}</span><ChevronRight size={15} /></button>)}</div><button className="button button-secondary full-button" onClick={() => navigate('/escalations')}>Open escalation queue</button></section>
        <section className="panel coordination-note"><span className="mini-icon blue"><MessageSquare size={15} /></span><div><strong>Patient replies feed this worklist</strong><p>Appointment confirmations and reschedule requests appear in the same patient record and update the team’s next action.</p></div></section>
      </aside>
    </div>
  </>
}

function Escalations({ state, onSelectPatient, onSendReminder }: { state: AppState; onSelectPatient: (id: string) => void; onSendReminder: (id: string) => void }) { const escalated = state.patients.filter((patient) => patient.status === 'Staff Action Required' || patient.response === 'No response'); return <><PageHeader title="Staff action required" subtitle="Administrative follow-ups requiring staff attention." action={<FilterSelect label="All action items" />} /><div className="tabs"><button className="tab-active">Unanswered <span>{escalated.length}</span></button><button>Overdue</button><button>Reschedule</button><button>Unassigned</button></div><section className="panel page-panel"><div className="escalation-list">{escalated.map((patient) => <div className="escalation-row" key={patient.id}><div className="escalation-icon"><AlertCircle size={18} /></div><div className="escalation-main"><div><strong>{patient.id}</strong><StatusBadge status={patient.status} /></div><p>No response after approved reminder sequence.</p><span>Backend reminder history pending · Assigned: {patient.assigned || 'Unassigned'}</span></div><div className="card-actions compact"><button className="button button-secondary" onClick={() => onSelectPatient(patient.id)}>Review</button><button className="button button-primary" onClick={() => onSendReminder(patient.id)}>Contact</button></div></div>)}</div>{escalated.length === 0 && <EmptyState title="You're all caught up" body="There are no unanswered reminders requiring action." />}</section></> }

function Analytics({ state, onSelectPatient }: { state: AppState; onSelectPatient: (id: string) => void }) {
  const patients = state.patients
  const active = patients.filter((patient) => patient.status !== 'Completed')
  const highPriority = active.filter((patient) => patient.priority === 'High')
  const overdue = active.filter((patient) => patient.nextExpectedReview.toLowerCase().includes('overdue'))
  const needsResponse = active.filter((patient) => patient.response !== 'Confirmed')
  const confirmed = patients.filter((patient) => patient.response === 'Confirmed').length
  const confirmationRate = patients.length ? Math.round(confirmed / patients.length * 100) : 0
  const programs = Array.from(new Set(patients.map((patient) => patient.program))).map((program) => ({ program, count: patients.filter((patient) => patient.program === program).length })).sort((a, b) => b.count - a.count)
  const focusPatients = [...active].sort((a, b) => ({ High: 0, Medium: 1, Low: 2 }[a.priority] - { High: 0, Medium: 1, Low: 2 }[b.priority]) || b.daysSinceActivity - a.daysSinceActivity)
  const recordedActivity = active.filter((patient) => patient.lastActivity !== 'No activity recorded')
  const meanDays = recordedActivity.length ? Math.round(recordedActivity.reduce((sum, patient) => sum + patient.daysSinceActivity, 0) / recordedActivity.length) : 0
  return <>
    <PageHeader eyebrow="OPERATIONAL VIEW · CONNECTED RECORDS" title="Patient analysis" subtitle="A clear snapshot of follow-up continuity, response status, care-program mix, and patients needing action." action={<button className="button button-secondary" onClick={() => window.print()}><FileText size={15} /> Print report</button>} />
    <div className="analysis-banner"><div className="analysis-banner-icon"><BarChart3 size={19} /></div><div><strong>Care coordination analysis</strong><span>Administrative workflow indicators; these are not clinical assessments or predictions.</span></div><span className="analysis-demo-tag">CONNECTED DATA</span></div>
    <div className="analysis-kpis">
      <Metric label="Active patients" value={String(active.length)} change={`${patients.length} in the register`} />
      <Metric label="High-priority follow-ups" value={String(highPriority.length)} change="Needs care-team review" />
      <Metric label="Reviews overdue" value={String(overdue.length)} change="Based on scheduled review fields" />
      <Metric label="Patient response needed" value={String(needsResponse.length)} change="Awaiting confirmation or action" />
      <Metric label="Confirmed" value={`${confirmationRate}%`} change={`${confirmed} patient${confirmed === 1 ? '' : 's'} confirmed`} />
    </div>
    <div className="analysis-layout">
      <section className="panel analysis-panel"><PanelHeading title="Patients by care program" action={<span className="chart-total">{patients.length} records</span>} /><div className="program-analysis">{programs.map(({ program, count }) => <div className="program-row" key={program}><div className="program-row-label"><strong>{program}</strong><span>{count} patient{count === 1 ? '' : 's'}</span></div><div className="program-track"><i style={{ width: `${patients.length ? count / patients.length * 100 : 0}%` }} /></div></div>)}{programs.length === 0 && <EmptyState title="No patient records" body="Patient program distribution will appear when records are added." />}</div></section>
      <section className="panel analysis-panel"><PanelHeading title="Continuity signals" /><div className="continuity-signals"><div className="signal-row"><span className="signal-icon signal-red"><AlertCircle size={17} /></span><div><strong>{highPriority.length} high-priority</strong><small>Use the reason and last activity in the patient record to plan a follow-up.</small></div></div><div className="signal-row"><span className="signal-icon signal-amber"><Clock3 size={17} /></span><div><strong>{overdue.length} overdue review{overdue.length === 1 ? '' : 's'}</strong><small>Check the next expected review date and assign the next action.</small></div></div><div className="signal-row"><span className="signal-icon signal-blue"><MessageSquare size={17} /></span><div><strong>{needsResponse.length} need a response review</strong><small>Confirm whether to contact, schedule, or resolve each follow-up.</small></div></div><div className="analysis-average"><span>Average days since recorded activity ({recordedActivity.length} records)</span><strong>{meanDays} days</strong></div></div></section>
    </div>
    <section className="panel analysis-patient-panel"><PanelHeading title="Patient-level follow-up report" action={<span className="chart-total">Sorted by priority and time since activity</span>} /><div className="table-wrap"><table className="data-table analysis-table"><thead><tr><th>Patient</th><th>Program</th><th>Last activity</th><th>Days since activity</th><th>Next review</th><th>Owner</th><th>Response</th></tr></thead><tbody>{focusPatients.map((patient) => <tr key={patient.id}><td><button className="analysis-patient-link" onClick={() => onSelectPatient(patient.id)}><Avatar initials={patient.initials} /><span><strong>{patient.name}</strong><small>{patient.id}</small></span></button></td><td>{patient.program}</td><td>{patient.lastActivity}</td><td><span className={`analysis-days ${patient.lastActivity !== 'No activity recorded' && patient.daysSinceActivity >= 30 ? 'analysis-days-high' : ''}`}>{patient.lastActivity === 'No activity recorded' ? 'Not recorded' : `${patient.daysSinceActivity} days`}</span></td><td>{patient.nextFollowup}<small className="table-sub">{patient.nextExpectedReview}</small></td><td>{patient.assigned}</td><td><StatusBadge status={patient.status} /></td></tr>)}</tbody></table></div>{focusPatients.length === 0 && <EmptyState title="No patient follow-ups" body="There are no active patients to include in the current report." />}</section>
    <div className="analysis-footer"><InfoGlyph /> Report summarizes administrative workflow data. Prioritization is rule-based and should be reviewed by the care team.</div>
  </>
}
function Metric({ label, value, change }: { label: string; value: string; change: string }) { return <div className="metric-card"><span>{label}</span><strong>{value}</strong><small className="metric-pending">— {change}</small></div> }
function BarChart({ hasData }: { hasData: boolean }) { return hasData ? <div className="analytics-empty"><BarChart3 size={24} /><strong>Volume data is ready for connection</strong><span>Connect dated follow-up records to render this chart.</span></div> : <div className="analytics-empty"><BarChart3 size={24} /><strong>No volume data</strong><span>Connect follow-up records to populate this chart.</span></div> }
function DonutChart({ state }: { state: AppState }) {
  const confirmed = state.patients.filter((patient) => patient.response === 'Confirmed').length
  const awaiting = state.patients.filter((patient) => patient.response === 'Awaiting response').length
  const reschedules = state.patients.filter((patient) => patient.response === 'Reschedule requested').length
  const action = state.patients.filter((patient) => patient.response === 'No response' || patient.status === 'Staff Action Required').length
  const total = confirmed + awaiting + reschedules + action
  const confirmedEnd = total ? confirmed / total * 100 : 0
  const awaitingEnd = total ? confirmedEnd + awaiting / total * 100 : 0
  const rescheduleEnd = total ? awaitingEnd + reschedules / total * 100 : 0
  const background = total ? `conic-gradient(var(--blue) 0 ${confirmedEnd}%, #f1ad4e ${confirmedEnd}% ${awaitingEnd}%, #8b82de ${awaitingEnd}% ${rescheduleEnd}%, #ef8b86 ${rescheduleEnd}% 100%)` : '#e3ebf5'
  return <div className="donut-layout"><div className="donut-visual"><div className={`donut ${total === 0 ? 'donut-empty' : ''}`} style={{ background }} /><div className="donut-label"><strong>{total}</strong><span>Total</span></div></div><div className="legend-list"><span><i className="legend-dot blue" /> Confirmed <b>{confirmed}</b></span><span><i className="legend-dot amber" /> Awaiting <b>{awaiting}</b></span><span><i className="legend-dot purple" /> Reschedule <b>{reschedules}</b></span><span><i className="legend-dot red" /> Action <b>{action}</b></span></div></div>
}
function LineChart() { return <div className="analytics-empty trend-empty"><ActivityIcon size={24} /><strong>No response trend data</strong><span>Connect communication events to populate this chart.</span></div> }
function WorkloadChart({ patients }: { patients: Patient[] }) {
  const owners = Array.from(new Set(patients.map((patient) => patient.assigned || 'Unassigned')))
  const max = Math.max(0, ...owners.map((owner) => patients.filter((patient) => (patient.assigned || 'Unassigned') === owner).length))
  return owners.length ? <div className="workload">{owners.map((owner) => { const count = patients.filter((patient) => (patient.assigned || 'Unassigned') === owner).length; return <div key={owner}><span>{owner}</span><b style={{ width: `${max ? count / max * 100 : 0}%` }} /><em>{count}</em></div> })}</div> : <div className="analytics-empty"><Users size={24} /><strong>No workload data</strong><span>Connect assigned follow-up records to populate this chart.</span></div>
}

function Settings() { const [section, setSection] = useState('Profile'); const sections = ['Profile', 'Notifications', 'Reminder Templates', 'Team Members', 'Roles & Permissions', 'Communication Settings', 'Data & Privacy']; return <><PageHeader title="Settings" subtitle="Configure CareLoop for your team's follow-up operations." /><div className="settings-layout"><div className="settings-nav">{sections.map((item) => <button key={item} className={section === item ? 'settings-active' : ''} onClick={() => setSection(item)}>{item}<ChevronRight size={15} /></button>)}</div><section className="panel settings-panel">{section === 'Profile' && <><div className="settings-title"><div><h2>Profile</h2><p>Connect the current user profile through the backend.</p></div><button className="button button-primary"><Check size={16} /> Save changes</button></div><div className="profile-edit"><div className="avatar avatar-large avatar-blue"><UserRound size={18} /></div><div><strong>Profile not connected</strong><span>User details will load from the backend.</span><button className="text-button">Change photo</button></div></div><div className="form-grid"><label className="field-label">Full name<input placeholder="Connect from backend" /></label><label className="field-label">Role<input placeholder="Connect from backend" /></label><label className="field-label">Email address<input placeholder="Connect from backend" /></label><label className="field-label">Timezone<select defaultValue=""><option value="" disabled>Select timezone</option><option>UTC</option></select></label></div></>}{section === 'Reminder Templates' && <TemplateSettings />}{section !== 'Profile' && section !== 'Reminder Templates' && <EmptyState title={`${section} settings`} body="This section is ready for backend configuration." action={<button className="button button-secondary">Review options</button>} />}</section></div></> }
function TemplateSettings() { return <><div className="settings-title"><div><h2>Reminder templates</h2><p>Approved administrative messages connected from the backend.</p></div><button className="button button-primary" disabled><Plus size={16} /> New template</button></div><EmptyState title="No reminder templates" body="Templates will appear here after the backend connection is configured." /></> }
function FollowupDrawer({ patient, communications, onClose, onSendReminder, onConfirm, navigate }: { patient: Patient; communications: Communication[]; onClose: () => void; onSendReminder: (id: string) => void; onConfirm: (id: string) => void; navigate: (route: Route) => void }) { return <div className="drawer-wrap"><button className="drawer-scrim" onClick={onClose} aria-label="Close follow-up drawer" /><aside className="drawer"><div className="drawer-header"><div><span className="eyebrow">FOLLOW-UP RECORD</span><h2>{patient.id}</h2><p>{patient.name}</p></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="drawer-status"><StatusBadge status={patient.status} /><button className="text-button"><MoreHorizontal size={15} /></button></div><section className="drawer-section"><h3>Appointment</h3><div className="appointment-card"><CalendarDays size={18} /><div><strong>{patient.nextFollowup}</strong><span>{patient.time}</span><small>Location will load from backend</small></div></div></section><section className="drawer-section"><h3>Reminder</h3><div className="detail-row"><span>Status</span><strong>{patient.reminder}</strong></div><div className="detail-row"><span>Last sent</span><strong>Not available</strong></div></section><section className="drawer-section"><h3>Patient response</h3><div className="response-state"><div className={`response-icon ${patient.response === 'Confirmed' ? 'success' : 'warning'}`}>{patient.response === 'Confirmed' ? <Check size={18} /> : <Clock3 size={18} />}</div><div><strong>{patient.response}</strong><span>Response history is administrative only.</span></div></div></section><section className="drawer-section"><h3>Communication history</h3><ActivityTimeline items={communications.map((item, index) => ({ id: item.id, time: item.sent.split(' · ')[1] ?? item.sent, text: `${item.type} · ${item.response}`, tone: index === 0 ? 'blue' : 'navy' }))} /></section><section className="drawer-section"><h3>Assigned staff</h3><div className="assigned-large"><Avatar initials={patient.assigned === 'Unassigned' ? '?' : patient.assigned.split(' ').map((x) => x[0]).join('')} tone="gray" /><strong>{patient.assigned}</strong><ChevronDown size={15} /></div></section><div className="drawer-footer"><button className="button button-secondary" onClick={() => onSendReminder(patient.id)}><Send size={16} /> Send reminder</button><button className="button button-primary" onClick={() => onConfirm(patient.id)}><Check size={16} /> Mark contacted</button><button className="button button-ghost" onClick={() => { onClose(); navigate('/reschedules') }}>Request reschedule</button></div></aside></div> }

function GlobalSearch({ state, onClose, onSelect, navigate }: { state: AppState; onClose: () => void; onSelect: (patientId: string) => void; navigate: (route: Route) => void }) { const [query, setQuery] = useState(''); const results = query.length > 1 ? state.patients.filter((p) => `${p.id} ${p.name}`.toLowerCase().includes(query.toLowerCase())) : state.patients.slice(0, 3); return <div className="search-backdrop" onClick={onClose}><div className="search-modal" onClick={(event) => event.stopPropagation()}><div className="search-input-wrap"><Search size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient IDs, appointments, tasks and communications" /><kbd>ESC</kbd></div><div className="search-results"><span className="search-group-label">Patients</span>{results.map((patient) => <button className="search-result" key={patient.id} onClick={() => onSelect(patient.id)}><Avatar initials={patient.initials} /><div><strong>{patient.id}</strong><span>{patient.name} · {patient.nextFollowup}</span></div><ChevronRight size={16} /></button>)}{query.length > 1 && results.length === 0 && <EmptyState title="No search results" body="Try a patient ID, name, or task keyword." />}</div><div className="search-footer"><span><kbd>↑↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><button onClick={() => navigate('/follow-ups')}>View all records <ArrowRight size={14} /></button></div></div></div> }

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) { return <div className="empty-state"><div className="empty-icon"><Inbox size={20} /></div><h3>{title}</h3><p>{body}</p>{action}</div> }
function ToastStack({ toasts }: { toasts: Toast[] }) { return <div className="toast-stack" aria-live="polite">{toasts.map((item) => <div className={`toast ${item.tone === 'error' ? 'toast-error' : ''}`} key={item.id}><div className="toast-icon"><Check size={15} /></div><span>{item.message}</span><button aria-label="Dismiss"><X size={14} /></button></div>)}</div> }

function PatientJourney({ patient, compact = false }: { patient: Patient; compact?: boolean }) {
  const steps = [
    { title: 'Last appointment', date: patient.lastAppointment, status: 'Recorded', tone: 'done' },
    { title: 'Investigation / lab', date: patient.lastLabActivity, status: 'Recorded', tone: 'done' },
    { title: 'Care-team follow-up', date: patient.treatmentMilestone, status: patient.priority === 'High' ? 'Needs attention' : 'In progress', tone: patient.priority === 'High' ? 'current' : 'done' },
    { title: 'Next expected review', date: `${patient.nextFollowup} · ${patient.time}`, status: patient.nextExpectedReview, tone: 'planned' },
  ]
  return <section className={`journey-card ${compact ? 'journey-card-compact' : ''}`}><div className="journey-line" />{steps.map((step, index) => <div className={`journey-step ${step.tone}`} key={`${patient.id}-${index}`}><span className="journey-dot">{step.tone === 'done' ? <Check size={12} /> : step.tone === 'current' ? <AlertCircle size={12} /> : <CalendarDays size={12} />}</span><div><strong>{step.title}</strong><small>{step.date} · {step.status}</small></div></div>)}</section>
}

export default App
