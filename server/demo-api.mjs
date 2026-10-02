import { createServer } from 'node:http'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const storePath = resolve(process.env.DEMO_API_STATE_PATH ?? resolve(root, 'server/data/demo-state.json'))
const host = process.env.DEMO_API_HOST ?? '0.0.0.0'
const port = Number(process.env.DEMO_API_PORT ?? 4317)
const maxBodyBytes = 1_500_000
const clients = new Set()

const seedPatients = [
  { id: 'CL-1042', name: 'Ramesh Kumar', program: 'Diabetes care', nextFollowup: '24 September 2026', weekday: 'Thursday', time: '10:30 AM', doctor: 'Dr. K. Sathwik', department: 'General Medicine', assigned: 'Dr. K. Sathwik', response: 'No response', status: 'Staff Action Required', reminder: 'Sent', nextAction: 'Call patient and confirm diabetes review', updatedAt: '2026-09-24T08:45:00.000Z' },
  { id: 'CL-2088', name: 'Meena Sharma', program: 'Maternal health', nextFollowup: '01 October 2026', weekday: 'Thursday', time: '11:00 AM', doctor: 'Dr. Priya Rao', department: 'Maternal health', assigned: 'Ananya Menon', response: 'Reschedule requested', status: 'Reschedule Requested', reminder: 'Sent', nextAction: 'Review preferred appointment time', updatedAt: '2026-09-24T08:00:00.000Z' },
  { id: 'CL-3315', name: 'Arjun Rao', program: 'Cancer follow-up', nextFollowup: '12 October 2026', weekday: 'Monday', time: '02:00 PM', doctor: 'Dr. Priya Rao', department: 'Oncology', assigned: 'Dr. Priya Rao', response: 'Confirmed', status: 'Confirmed', reminder: 'Not sent', nextAction: 'Prepare next surveillance review', updatedAt: '2026-09-24T07:30:00.000Z' },
  { id: 'CL-4170', name: 'Asha Nair', program: 'Maternal health', nextFollowup: '22 September 2026', weekday: 'Tuesday', time: '09:15 AM', doctor: 'Dr. K. Sathwik', department: 'Maternal health', assigned: 'Unassigned', response: 'No response', status: 'Staff Action Required', reminder: 'Sent', nextAction: 'Assign owner and escalate missed review', updatedAt: '2026-09-24T06:30:00.000Z' },
]

const seedMessages = [
  { id: 'msg-ramesh-1', patientId: 'CL-1042', sender: 'care-team', text: 'Hello Ramesh, your diabetes follow-up is due. Please confirm the appointment or message us if you need another time.', createdAt: '2026-09-24T08:30:00.000Z' },
]

let state
let saveQueue = Promise.resolve()

async function readState() {
  try {
    const parsed = JSON.parse(await readFile(storePath, 'utf8'))
    if (Array.isArray(parsed.patients) && parsed.patients.length) return { ...parsed, messages: Array.isArray(parsed.messages) ? parsed.messages : structuredClone(seedMessages) }
  } catch { /* First run or invalid demo state: initialize the included sample records. */ }
  return { patients: structuredClone(seedPatients), messages: structuredClone(seedMessages) }
}

async function persist() {
  const snapshot = JSON.stringify(state, null, 2)
  saveQueue = saveQueue.then(async () => {
    await mkdir(dirname(storePath), { recursive: true })
    await writeFile(`${storePath}.tmp`, snapshot, 'utf8')
    await rename(`${storePath}.tmp`, storePath)
  })
  await saveQueue
}

function json(response, status, value) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(value))
}

function notify(patient) {
  const payload = `event: patient.updated\ndata: ${JSON.stringify(patient)}\n\n`
  for (const client of clients) {
    if (!client.patientId || client.patientId === patient.id) client.response.write(payload)
  }
}

function notifyMessage(message) {
  const payload = `event: message.created\ndata: ${JSON.stringify(message)}\n\n`
  for (const client of clients) {
    if (!client.patientId || client.patientId === message.patientId) client.response.write(payload)
  }
}

async function readBody(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (Buffer.byteLength(body) > maxBodyBytes) throw Object.assign(new Error('Request body too large.'), { status: 413 })
  }
  try { return JSON.parse(body || '{}') } catch { throw Object.assign(new Error('Expected a JSON request body.'), { status: 400 }) }
}

function safePatch(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Object.assign(new Error('Expected a patient update object.'), { status: 400 })
  const allowed = ['nextFollowup', 'weekday', 'time', 'doctor', 'department', 'assigned', 'response', 'status', 'reminder', 'nextAction']
  const patch = {}
  for (const key of allowed) {
    if (!(key in input)) continue
    if (typeof input[key] !== 'string' || input[key].length > 240) throw Object.assign(new Error(`Invalid ${key}.`), { status: 400 })
    patch[key] = input[key].trim()
  }
  if (!Object.keys(patch).length) throw Object.assign(new Error('No supported patient fields supplied.'), { status: 400 })
  return patch
}

function safeNewPatient(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Object.assign(new Error('Expected a patient intake object.'), { status: 400 })
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const program = typeof input.program === 'string' ? input.program.trim() : ''
  const department = typeof input.department === 'string' ? input.department.trim() : ''
  const doctor = typeof input.doctor === 'string' ? input.doctor.trim() : ''
  const assigned = typeof input.assigned === 'string' ? input.assigned.trim() : ''
  const date = typeof input.date === 'string' ? input.date : ''
  const time = typeof input.time === 'string' ? input.time : ''
  const programs = new Set(['Diabetes care', 'Maternal health', 'Cancer follow-up', 'General Medicine'])
  const times = new Set(['09:15 AM', '10:30 AM', '11:00 AM', '02:00 PM', '03:00 PM'])
  const dateValue = new Date(`${date}T12:00:00.000Z`)
  if (!name || name.length > 120 || !programs.has(program) || !department || department.length > 120 || !doctor || doctor.length > 120 || !assigned || assigned.length > 120 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(dateValue.getTime()) || dateValue.toISOString().slice(0, 10) !== date || !times.has(time)) {
    throw Object.assign(new Error('Patient name, supported program, department, doctor, owner, valid date and appointment time are required.'), { status: 400 })
  }
  return { name, program, department, doctor, assigned, date, time, dateValue }
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin
  const allowedOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174', 'http://localhost:4173', 'http://127.0.0.1:4173'])
  if (origin && !allowedOrigins.has(origin)) return json(response, 403, { error: 'Origin not allowed for the local demo API.' })
  if (origin) response.setHeader('Access-Control-Allow-Origin', origin)
  response.setHeader('Vary', 'Origin')
  response.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, POST, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (request.method === 'OPTIONS') { response.writeHead(204); return response.end() }

  const url = new URL(request.url ?? '/', `http://${host}:${port}`)
  try {
    if (request.method === 'GET' && url.pathname === '/api/health') return json(response, 200, { ok: true, service: 'careloop-demo-api' })
    if (request.method === 'GET' && url.pathname === '/api/patients') return json(response, 200, { patients: state.patients })
    if (request.method === 'POST' && url.pathname === '/api/patients') {
      const input = safeNewPatient(await readBody(request))
      const highestId = Math.max(1000, ...state.patients.map((patient) => Number(patient.id.replace(/\D/g, '')) || 0))
      const patient = {
        id: `CL-${highestId + 1}`,
        name: input.name,
        program: input.program,
        nextFollowup: input.dateValue.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }),
        weekday: input.dateValue.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
        time: input.time,
        doctor: input.doctor,
        department: input.department,
        assigned: input.assigned,
        response: 'Awaiting response',
        status: 'Reminder Pending',
        reminder: 'Not sent',
        nextAction: 'Complete intake and confirm the first follow-up',
        updatedAt: new Date().toISOString(),
      }
      state.patients.push(patient)
      await persist()
      notify(patient)
      return json(response, 201, { patient })
    }
    if (request.method === 'GET' && url.pathname === '/api/messages') {
      const patientId = url.searchParams.get('patientId')
      if (!patientId || !state.patients.some((patient) => patient.id === patientId)) return json(response, 400, { error: 'A valid patientId is required.' })
      return json(response, 200, { messages: state.messages.filter((message) => message.patientId === patientId) })
    }
    if (request.method === 'POST' && url.pathname === '/api/messages') {
      const input = await readBody(request)
      const patientId = typeof input.patientId === 'string' ? input.patientId : ''
      if (!state.patients.some((patient) => patient.id === patientId)) return json(response, 400, { error: 'A valid patientId is required.' })
      if (!['patient', 'care-team'].includes(input.sender)) return json(response, 400, { error: 'sender must be patient or care-team.' })
      const messageText = typeof input.text === 'string' ? input.text.trim() : ''
      if (messageText.length > 1200) return json(response, 400, { error: 'Message text must be 1,200 characters or fewer.' })
      let attachment
      if (input.attachment !== undefined) {
        const item = input.attachment
        if (!item || !['image', 'report'].includes(item.kind) || typeof item.name !== 'string' || typeof item.mimeType !== 'string' || typeof item.data !== 'string' || item.name.length > 160 || item.data.length > 1_300_000) {
          return json(response, 400, { error: 'Attachment is invalid or exceeds the demo size limit.' })
        }
        if (item.kind === 'image' && !/^data:image\/(png|jpeg|webp);base64,/.test(item.data)) return json(response, 400, { error: 'Only PNG, JPEG, or WebP image attachments are supported.' })
        if (item.kind === 'report' && !/^https?:\/\//.test(item.data)) return json(response, 400, { error: 'Report attachment must link to a report URL.' })
        attachment = { kind: item.kind, name: item.name, mimeType: item.mimeType, data: item.data }
      }
      if (!messageText && !attachment) return json(response, 400, { error: 'Write a message or attach a file.' })
      const message = { id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, patientId, sender: input.sender, text: messageText, createdAt: new Date().toISOString(), ...(attachment ? { attachment } : {}) }
      state.messages.push(message)
      await persist()
      notifyMessage(message)
      return json(response, 201, { message })
    }
    if (request.method === 'GET' && url.pathname === '/api/events') {
      const patientId = url.searchParams.get('patientId')
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
      response.write(': connected\n\n')
      const client = { response, patientId }
      clients.add(client)
      request.on('close', () => clients.delete(client))
      return
    }
    const patientPath = url.pathname.match(/^\/api\/patients\/([A-Za-z0-9-]+)$/)
    if (patientPath) {
      const id = decodeURIComponent(patientPath[1])
      const index = state.patients.findIndex((item) => item.id === id)
      if (index < 0) return json(response, 404, { error: 'Demo patient not found.' })
      if (request.method === 'GET') return json(response, 200, { patient: state.patients[index] })
      if (request.method === 'PATCH') {
        const patch = safePatch(await readBody(request))
        state.patients[index] = { ...state.patients[index], ...patch, updatedAt: new Date().toISOString() }
        await persist()
        notify(state.patients[index])
        return json(response, 200, { patient: state.patients[index] })
      }
      return json(response, 405, { error: 'Method not allowed.' })
    }
    if (request.method === 'POST' && url.pathname === '/api/demo/reset') {
      state = { patients: structuredClone(seedPatients), messages: structuredClone(seedMessages) }
      await persist()
      for (const patient of state.patients) notify(patient)
      return json(response, 200, { patients: state.patients })
    }
    return json(response, 404, { error: 'Route not found.' })
  } catch (error) {
    return json(response, error?.status ?? 500, { error: error instanceof Error ? error.message : 'Unexpected demo API error.' })
  }
})

state = await readState()
server.listen(port, host, () => console.log(`CareLoop demo API listening at http://${host}:${port}`))
