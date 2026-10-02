export type FollowupStatus = 'Reminder Pending' | 'Confirmed' | 'Reschedule Requested' | 'Staff Action Required' | 'Completed'
export type ReminderStatus = 'Not sent' | 'Sent'
export type ResponseStatus = 'Awaiting response' | 'Confirmed' | 'Reschedule requested' | 'No response'
export type TaskStatus = 'To Do' | 'In Progress' | 'Waiting' | 'Completed'
export type Priority = 'High' | 'Medium' | 'Low'

export type Patient = {
  id: string
  name: string
  initials: string
  nextFollowup: string
  time: string
  reminder: ReminderStatus
  response: ResponseStatus
  assigned: string
  status: FollowupStatus
  department: string
  program: string
  lastActivity: string
  daysSinceActivity: number
  nextExpectedReview: string
  priority: Priority
  priorityReason: string
  lastAppointment: string
  lastLabActivity: string
  treatmentMilestone: string
  previousContact: string
  doctor: string
  reportUrl: string
  nextAction?: string
}

export type Followup = Patient & { type: 'Routine follow-up' | 'Post-visit review' | 'Scheduled review' }
export type Communication = {
  id: string
  patientId: string
  type: string
  created: string
  approvedBy: string
  sent: string
  response: string
  status: 'Awaiting Response' | 'Sent' | 'Responded' | 'Escalated'
}
export type Task = { id: string; patientId: string; task: string; owner: string; created: string; due: string; status: TaskStatus }
export type RescheduleRequest = { id: string; patientId: string; currentDate: string; currentTime: string; requestedDate: string; requestedTime: string; received: string; message: string; status: 'Pending Review' | 'Approved' | 'Contacted' }
export type Notification = { id: string; title: string; time: string; route: string; read: boolean }
export type Activity = { id: string; time: string; text: string; tone: 'blue' | 'green' | 'amber' | 'navy' }
export type TeamMember = { id: string; name: string; role: 'Doctor' | 'Care coordinator' | 'Nurse' | 'Staff'; program: string; status: 'Active' | 'Inactive' }

// Fictional demonstration fixtures. Priorities are transparent workflow cues, not clinical predictions.
export const staff = ['Dr. K. Sathwik', 'Dr. Priya Rao', 'Ananya Menon', 'Ravi Kumar']
export const initialTeam: TeamMember[] = [
  { id: 'team-sathwik', name: 'Dr. K. Sathwik', role: 'Doctor', program: 'General Medicine', status: 'Active' },
  { id: 'team-priya', name: 'Dr. Priya Rao', role: 'Doctor', program: 'Oncology', status: 'Active' },
  { id: 'team-ananya', name: 'Ananya Menon', role: 'Care coordinator', program: 'Maternal health', status: 'Active' },
  { id: 'team-ravi', name: 'Ravi Kumar', role: 'Staff', program: 'Cross-program coordination', status: 'Active' },
]

export const initialPatients: Patient[] = [
  {
    id: 'CL-1042', name: 'Ramesh Kumar', initials: 'RK', nextFollowup: '24 September 2026', time: '10:30 AM',
    reminder: 'Sent', response: 'No response', assigned: 'Dr. K. Sathwik', status: 'Staff Action Required', department: 'General Medicine',
    program: 'Diabetes care', lastActivity: '13 August 2026', daysSinceActivity: 42, nextExpectedReview: 'Overdue · due today',
    priority: 'High', priorityReason: 'No recorded care activity for 42 days; review is due today', nextAction: 'Call patient and confirm diabetes review',
    lastAppointment: '13 Aug · attended', lastLabActivity: '17 Aug · HbA1c result recorded', treatmentMilestone: 'Quarterly diabetes review overdue',
    previousContact: 'Reminder sent 22 Sep · no response', doctor: 'Dr. K. Sathwik', reportUrl: '/reports/CL-1042-demo-report.pdf',
  },
  {
    id: 'CL-2088', name: 'Meena Sharma', initials: 'MS', nextFollowup: '01 October 2026', time: '11:00 AM',
    reminder: 'Sent', response: 'Reschedule requested', assigned: 'Ananya Menon', status: 'Reschedule Requested', department: 'Maternal health',
    program: 'Maternal health', lastActivity: '06 September 2026', daysSinceActivity: 18, nextExpectedReview: 'Due in 7 days',
    priority: 'Medium', priorityReason: 'Patient requested a new time for the upcoming review', nextAction: 'Review preferred appointment time',
    lastAppointment: '06 Sep · antenatal review', lastLabActivity: '06 Sep · routine panel recorded', treatmentMilestone: 'Next antenatal review due 01 Oct',
    previousContact: 'Patient requested afternoon appointment · today', doctor: 'Dr. Priya Rao', reportUrl: '/reports/CL-2088-demo-report.pdf',
  },
  {
    id: 'CL-3315', name: 'Arjun Rao', initials: 'AR', nextFollowup: '12 October 2026', time: '02:00 PM',
    reminder: 'Not sent', response: 'Confirmed', assigned: 'Dr. Priya Rao', status: 'Confirmed', department: 'Oncology',
    program: 'Cancer follow-up', lastActivity: '17 September 2026', daysSinceActivity: 7, nextExpectedReview: 'Due in 18 days',
    priority: 'Low', priorityReason: 'Recent activity recorded; next review is on track', nextAction: 'Prepare next surveillance review',
    lastAppointment: '17 Sep · review completed', lastLabActivity: '17 Sep · follow-up panel recorded', treatmentMilestone: 'Next surveillance review planned for 12 Oct',
    previousContact: 'No contact attempt needed', doctor: 'Dr. Priya Rao', reportUrl: '/reports/CL-3315-demo-report.pdf',
  },
  {
    id: 'CL-4170', name: 'Asha Nair', initials: 'AN', nextFollowup: '22 September 2026', time: '09:15 AM',
    reminder: 'Sent', response: 'No response', assigned: 'Unassigned', status: 'Staff Action Required', department: 'Maternal health',
    program: 'Maternal health', lastActivity: '04 August 2026', daysSinceActivity: 51, nextExpectedReview: 'Overdue · 2 days',
    priority: 'High', priorityReason: 'Review is overdue and no contact is assigned to an owner', nextAction: 'Assign owner and escalate missed review',
    lastAppointment: '04 Aug · antenatal review', lastLabActivity: '08 Aug · test result recorded', treatmentMilestone: 'Follow-up review missed on 22 Sep',
    previousContact: 'Reminder sent 21 Sep · no response', doctor: 'Dr. K. Sathwik', reportUrl: '/reports/CL-4170-demo-report.pdf',
  },
]

export const initialCommunications: Communication[] = [
  { id: 'msg-1', patientId: 'CL-1042', type: 'Follow-up reminder', created: '22 Sep · 9:10 AM', approvedBy: 'Care team', sent: '22 Sep · 9:12 AM', response: 'No response', status: 'Escalated' },
  { id: 'msg-2', patientId: 'CL-2088', type: 'Appointment reminder', created: '23 Sep · 2:00 PM', approvedBy: 'Care team', sent: '23 Sep · 2:05 PM', response: 'Reschedule requested', status: 'Responded' },
  { id: 'msg-3', patientId: 'CL-4170', type: 'Follow-up reminder', created: '21 Sep · 8:45 AM', approvedBy: 'Care team', sent: '21 Sep · 8:50 AM', response: 'No response', status: 'Escalated' },
]

export const initialTasks: Task[] = [
  { id: 'task-1', patientId: 'CL-1042', task: 'Call patient and confirm diabetes review', owner: 'Dr. K. Sathwik', created: '22 Sep', due: 'Today', status: 'To Do' },
  { id: 'task-2', patientId: 'CL-2088', task: 'Review preferred appointment time', owner: 'Ananya Menon', created: 'Today', due: 'Today', status: 'In Progress' },
  { id: 'task-3', patientId: 'CL-4170', task: 'Assign owner and escalate missed review', owner: 'Unassigned', created: '22 Sep', due: 'Overdue', status: 'To Do' },
  { id: 'task-4', patientId: 'CL-3315', task: 'Prepare next surveillance review', owner: 'Dr. Priya Rao', created: '17 Sep', due: '12 Oct', status: 'Waiting' },
]

export const initialReschedules: RescheduleRequest[] = [
  { id: 'rs-1', patientId: 'CL-2088', currentDate: '01 October 2026', currentTime: '11:00 AM', requestedDate: '01 October 2026', requestedTime: 'Afternoon', received: 'Today · 9:20 AM', message: 'Could I please have an afternoon appointment?', status: 'Pending Review' },
]

export const initialNotifications: Notification[] = [
  { id: 'n-1', title: 'CL-1042 follow-up is due today', time: 'Today', route: '/patients/CL-1042', read: false },
  { id: 'n-2', title: 'CL-2088 requested a new appointment time', time: 'Today', route: '/patients/CL-2088', read: false },
  { id: 'n-3', title: 'CL-4170 review is overdue', time: '2 days ago', route: '/patients/CL-4170', read: false },
]

export const initialActivity: Activity[] = [
  { id: 'a-1', time: 'Today · 9:20 AM', text: 'CL-2088 requested an afternoon appointment', tone: 'amber' },
  { id: 'a-2', time: 'Today · 8:45 AM', text: 'CL-1042 moved to high priority: review due with no patient response', tone: 'blue' },
  { id: 'a-3', time: 'Yesterday · 4:10 PM', text: 'CL-4170 review marked overdue and requires an owner', tone: 'navy' },
  { id: 'a-4', time: '17 Sep · 11:35 AM', text: 'CL-3315 surveillance review completed', tone: 'green' },
]

export const followups: Followup[] = initialPatients.map((patient) => ({ ...patient, type: 'Routine follow-up' }))
