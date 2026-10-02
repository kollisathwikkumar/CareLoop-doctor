import type { Patient } from './data'

export type SharedPatient = Pick<Patient, 'id' | 'name' | 'nextFollowup' | 'time' | 'doctor' | 'department' | 'assigned' | 'response' | 'status' | 'reminder'> & {
  program: string
  weekday: string
  nextAction: string
  updatedAt: string
}

export type SharedMessage = { id: string; patientId: string; sender: 'patient' | 'care-team'; text: string; createdAt: string; attachment?: { kind: 'image' | 'report'; name: string; mimeType: string; data: string } }

const API_URL = import.meta.env.VITE_DEMO_API_URL ?? 'http://127.0.0.1:4317'

export function mergeSharedPatient(patient: Patient, shared: SharedPatient): Patient {
  const reviewDate = new Date(shared.nextFollowup)
  const today = new Date()
  const daysUntilReview = Number.isNaN(reviewDate.getTime()) ? null : Math.floor((Date.UTC(reviewDate.getFullYear(), reviewDate.getMonth(), reviewDate.getDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86_400_000)
  const nextExpectedReview = daysUntilReview === null ? patient.nextExpectedReview : daysUntilReview < 0 ? `Overdue · ${Math.abs(daysUntilReview)} ${Math.abs(daysUntilReview) === 1 ? 'day' : 'days'}` : daysUntilReview === 0 ? 'Due today' : `Due in ${daysUntilReview} ${daysUntilReview === 1 ? 'day' : 'days'}`
  return {
    ...patient,
    nextFollowup: shared.nextFollowup,
    time: shared.time,
    doctor: shared.doctor,
    department: shared.department,
    assigned: shared.assigned,
    response: shared.response,
    status: shared.status,
    reminder: shared.reminder,
    nextAction: shared.nextAction,
    program: shared.program,
    nextExpectedReview,
  }
}

export async function getSharedPatients(): Promise<SharedPatient[]> {
  const response = await fetch(`${API_URL}/api/patients`)
  if (!response.ok) throw new Error(`Demo API returned ${response.status}`)
  const data = await response.json() as { patients: SharedPatient[] }
  return data.patients
}

export type NewSharedPatient = { name: string; program: string; department: string; doctor: string; assigned: string; date: string; time: string }

export async function createSharedPatient(input: NewSharedPatient): Promise<SharedPatient> {
  const response = await fetch(`${API_URL}/api/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(`Demo API returned ${response.status}`)
  const data = await response.json() as { patient: SharedPatient }
  return data.patient
}

export async function patchSharedPatient(id: string, patch: Record<string, unknown>): Promise<SharedPatient> {
  const response = await fetch(`${API_URL}/api/patients/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!response.ok) throw new Error(`Demo API returned ${response.status}`)
  const data = await response.json() as { patient: SharedPatient }
  return data.patient
}

export async function resetSharedDemo(): Promise<SharedPatient[]> {
  const response = await fetch(`${API_URL}/api/demo/reset`, { method: 'POST' })
  if (!response.ok) throw new Error(`Demo API returned ${response.status}`)
  const data = await response.json() as { patients: SharedPatient[] }
  return data.patients
}

export function subscribeToSharedPatients(onPatient: (patient: SharedPatient) => void): EventSource {
  const events = new EventSource(`${API_URL}/api/events`)
  events.addEventListener('patient.updated', (event) => {
    onPatient(JSON.parse((event as MessageEvent<string>).data) as SharedPatient)
  })
  return events
}

export async function getSharedMessages(patientId: string): Promise<SharedMessage[]> {
  const response = await fetch(`${API_URL}/api/messages?patientId=${encodeURIComponent(patientId)}&fresh=${Date.now()}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Demo API returned ${response.status}`)
  return (await response.json() as { messages: SharedMessage[] }).messages
}

export async function sendSharedMessage(input: Omit<SharedMessage, 'id' | 'createdAt'>): Promise<SharedMessage> {
  const response = await fetch(`${API_URL}/api/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
  if (!response.ok) throw new Error(`Demo API returned ${response.status}`)
  return (await response.json() as { message: SharedMessage }).message
}

export function subscribeToSharedMessages(patientId: string, onMessage: (message: SharedMessage) => void): EventSource {
  const events = new EventSource(`${API_URL}/api/events?patientId=${encodeURIComponent(patientId)}`)
  events.addEventListener('message.created', (event) => onMessage(JSON.parse((event as MessageEvent<string>).data) as SharedMessage))
  return events
}
