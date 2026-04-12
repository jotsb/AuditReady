import { supabase } from '../lib/supabase';

interface AuditLogParams {
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  businessId?: string;
}

export function useAuditLog() {
  const logAction = async ({ action, resourceType, resourceId, details = {}, businessId }: AuditLogParams) => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const resolvedBusinessId = businessId || (details?.business_id as string) || null;

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      business_id: resolvedBusinessId,
    });
  };

  return { logAction };
}
