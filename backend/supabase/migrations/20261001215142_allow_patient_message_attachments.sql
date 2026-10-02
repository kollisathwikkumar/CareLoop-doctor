BEGIN;

DROP POLICY IF EXISTS careloop_reports_insert ON storage.objects;

CREATE POLICY careloop_reports_insert ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'careloop-reports'
  AND split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  AND public.can_access_patient(split_part(name, '/', 1)::uuid)
  AND (
    public.is_staff_user()
    OR (
      public.current_patient_id() = split_part(name, '/', 1)::uuid
      AND name ~ '^[0-9a-fA-F-]{36}/messages/[A-Za-z0-9_-]+\.(jpg|png|webp)$'
      AND metadata ->> 'mimetype' IN ('image/jpeg', 'image/png', 'image/webp')
      AND CASE
        WHEN metadata ->> 'size' ~ '^[0-9]+$'
          THEN (metadata ->> 'size')::bigint <= 8388608
        ELSE false
      END
    )
  )
);

COMMENT ON POLICY careloop_reports_insert ON storage.objects IS
  'Staff may upload patient reports; patients may upload <=8 MiB JPEG/PNG/WebP attachments only under their own messages/ prefix.';

COMMIT;
