import { useAuth } from '../contexts/AuthContext';
import { AuditLogsView } from '../components/audit/AuditLogsView';

export function EnhancedAuditLogsPage() {
  const { selectedBusiness } = useAuth();

  return <AuditLogsView scope="business" businessId={selectedBusiness?.id} showTitle={true} showBorder={true} />;
}
