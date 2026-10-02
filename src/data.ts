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

// The dashboard starts empty; all records must come from the connected API or an authorized user action.
export const staff: string[] = []
export const initialTeam: TeamMember[] = []
export const initialPatients: Patient[] = []
export const initialCommunications: Communication[] = []
export const initialTasks: Task[] = []
export const initialReschedules: RescheduleRequest[] = []
export const initialNotifications: Notification[] = []
export const initialActivity: Activity[] = []
export const followups: Followup[] = []
