import { supabase } from '../lib/supabase';

interface AuditLogParams {
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

export function useAuditLog() {
  const logAction = async ({ action, resourceType, resourceId, details = {} }: AuditLogParams) => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
    });
  };

  return { logAction };
}
