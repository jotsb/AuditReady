import { AuditLogsView } from '../components/audit/AuditLogsView';
import { usePageTracking } from '../hooks/usePageTracking';

export function AuditLogsPage() {
  // Disabled: Page tracking creates infinite loop with realtime logs
  // usePageTracking('System Audit Logs', { section: 'system_audit_logs' });

  return <AuditLogsView scope="system" showTitle={true} showBorder={true} />;
}
