-- These authorization helpers are called inside RLS and authenticated RPCs.
-- They do not need an anonymous Data API surface.
REVOKE EXECUTE ON FUNCTION public.current_profile_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_organisation_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_patient_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_patient(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_organisation_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_patient_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_patient(uuid) TO authenticated;

COMMENT ON FUNCTION public.current_profile_role() IS 'Authenticated authorization helper; anonymous RPC execution is disabled.';
COMMENT ON FUNCTION public.current_organisation_id() IS 'Authenticated authorization helper; anonymous RPC execution is disabled.';
COMMENT ON FUNCTION public.current_patient_id() IS 'Authenticated authorization helper; anonymous RPC execution is disabled.';
COMMENT ON FUNCTION public.is_staff_user() IS 'Authenticated authorization helper; anonymous RPC execution is disabled.';
COMMENT ON FUNCTION public.can_access_patient(uuid) IS 'Authenticated authorization helper; anonymous RPC execution is disabled.';
