import { AuditLogsView } from '../components/audit/AuditLogsView';
import { usePageTracking } from '../hooks/usePageTracking';

export function AuditLogsPage() {
  usePageTracking('System Audit Logs', { section: 'system_audit_logs' });

  return <AuditLogsView scope="system" showTitle={true} showBorder={true} />;
}
