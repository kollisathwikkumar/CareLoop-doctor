-- Backend contracts for the unfinished dashboard, QR connectivity, external data,
-- notification channels, and patient post-connection refresh.

DO $$
BEGIN
  CREATE TYPE public.external_source_type AS ENUM ('emr', 'lab', 'spreadsheet', 'register', 'api');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE TYPE public.ingestion_batch_status AS ENUM ('queued', 'processing', 'completed', 'partial', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

CREATE TABLE IF NOT EXISTS public.external_data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 160),
  source_type public.external_source_type NOT NULL,
  external_reference text CHECK (external_reference IS NULL OR length(btrim(external_reference)) BETWEEN 1 AND 240),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (organisation_id, name)
);

CREATE TABLE IF NOT EXISTS public.external_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.external_data_sources(id) ON DELETE CASCADE,
  external_run_id text CHECK (external_run_id IS NULL OR length(btrim(external_run_id)) BETWEEN 1 AND 240),
  status public.ingestion_batch_status NOT NULL DEFAULT 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  row_count integer NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  matched_count integer NOT NULL DEFAULT 0 CHECK (matched_count >= 0),
  rejected_count integer NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
  error_summary text CHECK (error_summary IS NULL OR length(error_summary) <= 2000),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

CREATE TABLE IF NOT EXISTS public.external_import_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.external_import_batches(id) ON DELETE CASCADE,
  external_record_id text NOT NULL CHECK (length(btrim(external_record_id)) BETWEEN 1 AND 240),
  record_type text NOT NULL CHECK (record_type IN ('patient', 'appointment', 'test', 'report', 'medication', 'care_plan', 'follow_up')),
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  content_hash text CHECK (content_hash IS NULL OR content_hash ~ '^[0-9a-fA-F]{64}$'),
  match_status text NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('unmatched', 'matched', 'rejected', 'applied')),
  error_message text CHECK (error_message IS NULL OR length(error_message) <= 2000),
  received_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  matched_at timestamptz,
  UNIQUE (batch_id, external_record_id)
);

CREATE TABLE IF NOT EXISTS public.notification_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'push')),
  endpoint text NOT NULL CHECK (length(btrim(endpoint)) BETWEEN 1 AND 512),
  label text CHECK (label IS NULL OR length(btrim(label)) BETWEEN 1 AND 120),
  verified_at timestamptz,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (recipient_id, channel, endpoint)
);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_event_id uuid NOT NULL REFERENCES public.outbox_events(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint_id uuid REFERENCES public.notification_endpoints(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'in_app')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'skipped')),
  provider_message_id text CHECK (provider_message_id IS NULL OR length(btrim(provider_message_id)) <= 240),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text CHECK (last_error IS NULL OR length(last_error) <= 2000),
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (outbox_event_id, recipient_id, channel, endpoint_id)
);

CREATE INDEX IF NOT EXISTS external_sources_org_idx ON public.external_data_sources(organisation_id);
CREATE INDEX IF NOT EXISTS external_sources_created_by_idx ON public.external_data_sources(created_by);
CREATE INDEX IF NOT EXISTS external_batches_source_idx ON public.external_import_batches(source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS external_batches_created_by_idx ON public.external_import_batches(created_by);
CREATE INDEX IF NOT EXISTS external_records_batch_idx ON public.external_import_records(batch_id, received_at DESC);
CREATE INDEX IF NOT EXISTS external_records_patient_idx ON public.external_import_records(patient_id, received_at DESC);
CREATE INDEX IF NOT EXISTS notification_endpoints_recipient_idx ON public.notification_endpoints(recipient_id, channel);
CREATE INDEX IF NOT EXISTS notification_deliveries_event_idx ON public.notification_deliveries(outbox_event_id, status);
CREATE INDEX IF NOT EXISTS notification_deliveries_recipient_idx ON public.notification_deliveries(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_deliveries_endpoint_idx ON public.notification_deliveries(endpoint_id);

DROP TRIGGER IF EXISTS external_data_sources_updated_at ON public.external_data_sources;
CREATE TRIGGER external_data_sources_updated_at
BEFORE UPDATE ON public.external_data_sources
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS notification_endpoints_updated_at ON public.notification_endpoints;
CREATE TRIGGER notification_endpoints_updated_at
BEFORE UPDATE ON public.notification_endpoints
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS notification_deliveries_updated_at ON public.notification_deliveries;
CREATE TRIGGER notification_deliveries_updated_at
BEFORE UPDATE ON public.notification_deliveries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.external_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_import_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY external_sources_staff_read
ON public.external_data_sources
FOR SELECT
USING (
  (SELECT public.is_staff_user())
  AND (organisation_id = (SELECT public.current_organisation_id()) OR (SELECT public.current_profile_role()) = 'platform_admin')
);

CREATE POLICY external_batches_staff_read
ON public.external_import_batches
FOR SELECT
USING (
  (SELECT public.is_staff_user())
  AND EXISTS (
    SELECT 1
    FROM public.external_data_sources s
    WHERE s.id = source_id
      AND (s.organisation_id = (SELECT public.current_organisation_id()) OR (SELECT public.current_profile_role()) = 'platform_admin')
  )
);

CREATE POLICY external_records_staff_read
ON public.external_import_records
FOR SELECT
USING (
  (SELECT public.is_staff_user())
  AND EXISTS (
    SELECT 1
    FROM public.external_import_batches b
    JOIN public.external_data_sources s ON s.id = b.source_id
    WHERE b.id = batch_id
      AND (s.organisation_id = (SELECT public.current_organisation_id()) OR (SELECT public.current_profile_role()) = 'platform_admin')
  )
);

CREATE POLICY notification_endpoints_self_read
ON public.notification_endpoints
FOR SELECT
USING (recipient_id = (SELECT auth.uid()));

CREATE POLICY notification_endpoints_self_update
ON public.notification_endpoints
FOR UPDATE
USING (recipient_id = (SELECT auth.uid()))
WITH CHECK (recipient_id = (SELECT auth.uid()));

CREATE POLICY notification_deliveries_recipient_read
ON public.notification_deliveries
FOR SELECT
USING (recipient_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.create_connection_qr_invitation(
  target_patient_id uuid,
  target_care_team_id uuid,
  invitation_ttl_hours integer DEFAULT 24
)
RETURNS TABLE (
  invitation_id uuid,
  patient_id uuid,
  care_team_id uuid,
  code text,
  code_hint text,
  qr_payload text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  created_code text;
  created_expiry timestamptz;
  created_id uuid;
  created_hint text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'Authentication is required.';
  END IF;

  SELECT invitation.code, invitation.expires_at
  INTO created_code, created_expiry
  FROM public.create_connection_invitation(target_patient_id, target_care_team_id, invitation_ttl_hours) invitation;

  SELECT invitation.id, invitation.code_hint
  INTO created_id, created_hint
  FROM public.connection_invitations invitation
  WHERE invitation.code = created_code;

  IF created_id IS NULL THEN
    RAISE EXCEPTION USING errcode = 'P0002', message = 'Connection invitation was not created.';
  END IF;

  RETURN QUERY
  SELECT
    created_id,
    target_patient_id,
    target_care_team_id,
    created_code,
    created_hint,
    format('carelooppatient://connect?v=1&code=%s', created_code),
    created_expiry;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_connection_qr_payload(qr_payload text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  payload_parts text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'Authentication is required.';
  END IF;
  IF qr_payload IS NULL OR length(btrim(qr_payload)) > 256 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'QR payload is invalid.';
  END IF;

  payload_parts := regexp_match(
    btrim(qr_payload),
    '^carelooppatient://connect\?v=1&code=(CL-[0-9A-F]{16})$'
  );
  IF payload_parts IS NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'QR payload is invalid.';
  END IF;

  RETURN public.redeem_connection_code(payload_parts[1]);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_patient_connectivity_snapshot()
RETURNS TABLE (
  patient_id uuid,
  organisation_id uuid,
  connection_id uuid,
  care_team_id uuid,
  connection_status public.connection_status,
  consent_version text,
  consented_at timestamptz,
  connected_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.organisation_id,
    c.id,
    c.care_team_id,
    c.status,
    consent.consent_version,
    consent.consented_at,
    c.connected_at
  FROM public.patients p
  JOIN public.patient_care_team_connections c
    ON c.patient_id = p.id
   AND c.status = 'active'
  LEFT JOIN LATERAL (
    SELECT cc.consent_version, cc.consented_at
    FROM public.connection_consents cc
    WHERE cc.patient_id = p.id
      AND cc.care_team_id = c.care_team_id
      AND cc.consented_by = (SELECT auth.uid())
      AND cc.withdrawn_at IS NULL
    ORDER BY cc.consented_at DESC
    LIMIT 1
  ) consent ON true
  WHERE p.auth_user_id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.list_follow_up_queue(
  target_status public.follow_up_task_status DEFAULT NULL,
  target_owner_id uuid DEFAULT NULL,
  due_before timestamptz DEFAULT NULL,
  result_limit integer DEFAULT 100
)
RETURNS TABLE (
  task_id uuid,
  patient_id uuid,
  patient_code text,
  patient_first_name text,
  patient_last_name text,
  appointment_id uuid,
  appointment_scheduled_at timestamptz,
  appointment_status public.appointment_status,
  reason text,
  due_at timestamptz,
  priority public.follow_up_priority,
  priority_source text,
  owner_id uuid,
  owner_name text,
  status public.follow_up_task_status,
  next_action text,
  is_overdue boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    task.id,
    task.patient_id,
    patient.patient_code,
    patient.first_name,
    patient.last_name,
    task.appointment_id,
    appointment.scheduled_at,
    appointment.status,
    task.reason,
    task.due_at,
    task.priority,
    task.priority_source,
    task.owner_id,
    owner_profile.full_name,
    task.status,
    task.next_action,
    task.due_at < timezone('utc', now()) AND task.status IN ('open', 'in_progress'),
    task.created_at,
    task.updated_at
  FROM public.follow_up_tasks task
  JOIN public.patients patient ON patient.id = task.patient_id
  LEFT JOIN public.appointments appointment ON appointment.id = task.appointment_id
  LEFT JOIN public.profiles owner_profile ON owner_profile.id = task.owner_id
  WHERE public.is_staff_user()
    AND public.can_access_patient(task.patient_id)
    AND (target_status IS NULL OR task.status = target_status)
    AND (target_owner_id IS NULL OR task.owner_id = target_owner_id)
    AND (due_before IS NULL OR task.due_at <= due_before)
  ORDER BY
    CASE task.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
    task.due_at,
    task.created_at
  LIMIT greatest(1, least(coalesce(result_limit, 100), 200));
$$;

CREATE OR REPLACE FUNCTION public.register_notification_endpoint(
  target_channel text,
  target_endpoint text,
  target_label text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized_channel text := lower(btrim(target_channel));
  normalized_endpoint text := btrim(target_endpoint);
  created_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'Authentication is required.';
  END IF;
  IF normalized_channel NOT IN ('email', 'sms', 'push') THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'Notification channel is invalid.';
  END IF;
  IF normalized_endpoint IS NULL OR length(normalized_endpoint) NOT BETWEEN 1 AND 512 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'Notification endpoint is invalid.';
  END IF;
  IF normalized_channel = 'email' AND normalized_endpoint !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'Email endpoint is invalid.';
  END IF;
  IF normalized_channel = 'sms' AND normalized_endpoint !~ '^\+[1-9][0-9]{7,14}$' THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'SMS endpoint is invalid.';
  END IF;
  IF target_label IS NOT NULL AND length(btrim(target_label)) > 120 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'Notification endpoint label is invalid.';
  END IF;

  INSERT INTO public.notification_endpoints (recipient_id, channel, endpoint, label, verified_at, last_seen_at, revoked_at)
  VALUES ((SELECT auth.uid()), normalized_channel, normalized_endpoint, nullif(btrim(target_label), ''), NULL, timezone('utc', now()), NULL)
  ON CONFLICT (recipient_id, channel, endpoint)
  DO UPDATE SET
    label = EXCLUDED.label,
    last_seen_at = timezone('utc', now()),
    revoked_at = NULL,
    updated_at = timezone('utc', now())
  RETURNING id INTO created_id;
  RETURN created_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_notification_endpoint(endpoint_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  changed_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'Authentication is required.';
  END IF;
  UPDATE public.notification_endpoints
  SET revoked_at = timezone('utc', now()), updated_at = timezone('utc', now())
  WHERE id = endpoint_id
    AND recipient_id = (SELECT auth.uid())
    AND revoked_at IS NULL;
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  RETURN changed_count > 0;
END;
$$;

REVOKE ALL ON public.external_data_sources, public.external_import_batches, public.external_import_records FROM public, anon, authenticated;
REVOKE ALL ON public.notification_endpoints, public.notification_deliveries FROM public, anon, authenticated;
GRANT SELECT ON public.external_data_sources, public.external_import_batches, public.external_import_records TO authenticated;
GRANT SELECT ON public.notification_endpoints, public.notification_deliveries TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_connection_qr_invitation(uuid, uuid, integer) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_connection_qr_payload(text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_patient_connectivity_snapshot() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.list_follow_up_queue(public.follow_up_task_status, uuid, timestamptz, integer) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.register_notification_endpoint(text, text, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_notification_endpoint(uuid) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_connection_qr_invitation(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_connection_qr_payload(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_connectivity_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_follow_up_queue(public.follow_up_task_status, uuid, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_notification_endpoint(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_notification_endpoint(uuid) TO authenticated;

GRANT ALL ON public.external_data_sources, public.external_import_batches, public.external_import_records, public.notification_endpoints, public.notification_deliveries TO service_role;

COMMENT ON TABLE public.external_data_sources IS 'Organisation-scoped connector registry. Credentials remain in Edge Function/project secrets, never in this table.';
COMMENT ON TABLE public.external_import_batches IS 'Service-managed import runs from EMRs, labs, spreadsheets, registers, or APIs.';
COMMENT ON TABLE public.external_import_records IS 'Quarantined external records awaiting matching/validation before they affect authoritative CareLoop records.';
COMMENT ON FUNCTION public.create_connection_qr_invitation(uuid, uuid, integer) IS 'Returns an opaque, expiring deep-link payload. The payload contains only a redemption code, never patient details.';
COMMENT ON FUNCTION public.get_patient_connectivity_snapshot() IS 'Returns the authenticated patient connection and consent state for post-redemption refresh.';
COMMENT ON FUNCTION public.list_follow_up_queue(public.follow_up_task_status, uuid, timestamptz, integer) IS 'Staff worklist read model for the Doctor dashboard; authorization remains enforced by RLS and patient access checks.';
COMMENT ON TABLE public.notification_deliveries IS 'Provider-neutral delivery ledger for email, SMS, push, and in-app adapters. External provider secrets are not stored here.';
