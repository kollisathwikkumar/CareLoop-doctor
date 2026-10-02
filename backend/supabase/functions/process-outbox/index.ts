import { parseAllowedHosts, resolveWebhookTarget } from './webhook-policy.mjs';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type OutboxEvent = {
  id: string;
  topic: string;
  aggregate_type: string;
  aggregate_id: string | null;
  payload: { [key: string]: JsonValue };
  attempts: number;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const notificationWebhookUrl = Deno.env.get('NOTIFICATION_WEBHOOK_URL');
const notificationWebhookAllowedHosts = Deno.env.get('NOTIFICATION_WEBHOOK_ALLOWED_HOSTS');
const outboxWorkerToken = Deno.env.get('OUTBOX_WORKER_TOKEN');

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function jsonHeaders(): Headers {
  const key = required(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY');
  return new Headers({
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  });
}

function isOutboxEvent(value: JsonValue): value is OutboxEvent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as { [key: string]: JsonValue };
  return typeof record.id === 'string'
    && typeof record.topic === 'string'
    && typeof record.aggregate_type === 'string'
    && (typeof record.aggregate_id === 'string' || record.aggregate_id === null)
    && typeof record.payload === 'object'
    && record.payload !== null
    && !Array.isArray(record.payload)
    && typeof record.attempts === 'number';
}

async function callRpc(name: string, body: { [key: string]: JsonValue }): Promise<JsonValue | null> {
  const response = await fetch(`${required(supabaseUrl, 'SUPABASE_URL')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const parsed: JsonValue = text.length > 0 ? JSON.parse(text) as JsonValue : null;
  if (!response.ok) {
    const message = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && typeof parsed.message === 'string'
      ? parsed.message
      : `RPC ${name} failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
  return parsed;
}

async function deliver(event: OutboxEvent, webhook: URL): Promise<void> {
  const response = await fetch(webhook, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
    headers: new Headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      event_id: event.id,
      topic: event.topic,
      aggregate_type: event.aggregate_type,
      aggregate_id: event.aggregate_id,
      payload: event.payload,
    }),
  });
  if (!response.ok) throw new Error(`Notification provider returned HTTP ${response.status}.`);
}

function errorMessage(error: Error | string): string {
  return error instanceof Error ? error.message : error;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST is required.' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const expectedToken = required(outboxWorkerToken, 'OUTBOX_WORKER_TOKEN');
    if (request.headers.get('authorization') !== `Bearer ${expectedToken}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    const allowedHosts = parseAllowedHosts(notificationWebhookAllowedHosts);
    const webhook = resolveWebhookTarget(notificationWebhookUrl, allowedHosts);
    const claimed = await callRpc('claim_outbox_events', { batch_size: 25 });
    const values: JsonValue[] = Array.isArray(claimed) ? claimed : [];
    const events = values.filter(isOutboxEvent);
    let delivered = 0;
    let failed = 0;
    let staleClaims = 0;
    for (const event of events) {
      try {
        await deliver(event, webhook);
        const completed = await callRpc('complete_outbox_event', { event_id: event.id, expected_attempt: event.attempts });
        if (completed === true) delivered += 1;
        else staleClaims += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const recorded = await callRpc('fail_outbox_event', {
          event_id: event.id,
          expected_attempt: event.attempts,
          failure_message: message,
          retry_after_seconds: 60,
        });
        if (recorded === true) failed += 1;
        else staleClaims += 1;
      }
    }
    return new Response(JSON.stringify({ claimed: events.length, delivered, failed, stale_claims: staleClaims }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    const message = errorMessage(error instanceof Error ? error : String(error));
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
