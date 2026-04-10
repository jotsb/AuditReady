/*
  # Add system health snapshot function

  1. New Functions
    - `get_system_health_snapshot` - Returns a JSON object with system health metrics
      - Database size
      - User counts (total, active 24h, suspended)
      - Business counts (total, suspended)
      - Receipt counts (total, pending, failed)
      - Storage usage
      - Error rates and log counts (24h)
  2. Security
    - Only accessible by authenticated users (admin check done in application layer)
*/

CREATE OR REPLACE FUNCTION get_system_health_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  db_size bigint;
  total_users int;
  active_users_24h int;
  suspended_users int;
  total_businesses int;
  suspended_businesses int;
  total_receipts int;
  pending_receipts int;
  failed_receipts int;
  storage_bytes bigint;
  total_logs_24h int;
  error_logs_24h int;
  critical_logs_24h int;
  error_rate numeric;
BEGIN
  SELECT pg_database_size(current_database()) INTO db_size;

  SELECT count(*) INTO total_users FROM auth.users;

  SELECT count(*) INTO active_users_24h
  FROM auth.users
  WHERE last_sign_in_at > now() - interval '24 hours';

  SELECT count(*) INTO suspended_users
  FROM public.profiles
  WHERE suspended = true;

  SELECT count(*) INTO total_businesses FROM public.businesses;

  SELECT count(*) INTO suspended_businesses
  FROM public.businesses
  WHERE suspended = true;

  SELECT count(*) INTO total_receipts FROM public.receipts WHERE deleted_at IS NULL;

  SELECT count(*) INTO pending_receipts
  FROM public.receipts
  WHERE deleted_at IS NULL AND extraction_status = 'pending';

  SELECT count(*) INTO failed_receipts
  FROM public.receipts
  WHERE deleted_at IS NULL AND extraction_status = 'failed';

  SELECT COALESCE(sum(size), 0)::bigint INTO storage_bytes
  FROM storage.objects;

  SELECT count(*) INTO total_logs_24h
  FROM public.system_logs
  WHERE timestamp > now() - interval '24 hours';

  SELECT count(*) INTO error_logs_24h
  FROM public.system_logs
  WHERE timestamp > now() - interval '24 hours'
    AND level IN ('ERROR', 'CRITICAL');

  SELECT count(*) INTO critical_logs_24h
  FROM public.system_logs
  WHERE timestamp > now() - interval '24 hours'
    AND level = 'CRITICAL';

  IF total_logs_24h > 0 THEN
    error_rate := (error_logs_24h::numeric / total_logs_24h::numeric) * 100;
  ELSE
    error_rate := 0;
  END IF;

  result := jsonb_build_object(
    'timestamp', now(),
    'database', jsonb_build_object(
      'size_bytes', db_size,
      'size_mb', round(db_size / 1048576.0, 2),
      'size_gb', round(db_size / 1073741824.0, 2)
    ),
    'users', jsonb_build_object(
      'total', total_users,
      'active_24h', active_users_24h,
      'suspended', suspended_users
    ),
    'businesses', jsonb_build_object(
      'total', total_businesses,
      'suspended', suspended_businesses
    ),
    'receipts', jsonb_build_object(
      'total', total_receipts,
      'pending_extraction', pending_receipts,
      'failed_extraction', failed_receipts
    ),
    'storage', jsonb_build_object(
      'total_bytes', storage_bytes,
      'total_mb', round(storage_bytes / 1048576.0, 2),
      'total_gb', round(storage_bytes / 1073741824.0, 2)
    ),
    'system', jsonb_build_object(
      'error_rate_24h_percent', round(error_rate, 2),
      'total_logs_24h', total_logs_24h,
      'critical_errors_24h', critical_logs_24h
    )
  );

  RETURN result;
END;
$$;
