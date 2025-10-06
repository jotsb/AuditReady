import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Building2, Users, Receipt, TrendingUp, AlertCircle } from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  totalBusinesses: number;
  totalReceipts: number;
  systemAdmins: number;
}

interface Business {
  id: string;
  name: string;
  created_at: string;
  owner_id: string;
  owner_email?: string;
  receipt_count: number;
  member_count: number;
}

export function AdminPage() {
  const { isSystemAdmin, user } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalBusinesses: 0,
    totalReceipts: 0,
    systemAdmins: 0,
  });
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isSystemAdmin) {
      loadAdminData();
    }
  }, [isSystemAdmin]);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      setError('');

      const [businessesResult, receiptsResult, systemRolesResult] = await Promise.all([
        supabase
          .from('businesses')
          .select('id, name, created_at, owner_id')
          .order('created_at', { ascending: false }),

        supabase
          .from('receipts')
          .select('id', { count: 'exact', head: true }),

        supabase
          .from('system_roles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'admin')
      ]);

      if (businessesResult.error) throw businessesResult.error;
      if (receiptsResult.error) throw receiptsResult.error;
      if (systemRolesResult.error) throw systemRolesResult.error;

      const businessesData = businessesResult.data || [];
      const uniqueOwners = new Set(businessesData.map(b => b.owner_id)).size;

      const enrichedBusinesses = await Promise.all(
        businessesData.map(async (business) => {
          const [receiptCount, memberCount, ownerEmail] = await Promise.all([
            supabase
              .from('receipts')
              .select('id', { count: 'exact', head: true })
              .eq('business_id', business.id)
              .then(res => res.count || 0),

            supabase
              .from('business_members')
              .select('id', { count: 'exact', head: true })
              .eq('business_id', business.id)
              .then(res => res.count || 0),

            supabase
              .from('profiles')
              .select('email')
              .eq('id', business.owner_id)
              .maybeSingle()
              .then(res => res.data?.email || 'Unknown')
          ]);

          return {
            ...business,
            owner_email: ownerEmail,
            receipt_count: receiptCount,
            member_count: memberCount,
          };
        })
      );

      setStats({
        totalUsers: uniqueOwners,
        totalBusinesses: businessesData.length,
        totalReceipts: receiptsResult.count || 0,
        systemAdmins: systemRolesResult.count || 0,
      });

      setBusinesses(enrichedBusinesses);
    } catch (err: any) {
      console.error('Error loading admin data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isSystemAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="mx-auto mb-4 text-red-600" size={48} />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-600">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">System Administration</h1>
          <p className="text-slate-600">Manage all businesses and users across the platform</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building2 className="text-blue-600" size={24} />
              </div>
              <TrendingUp className="text-blue-600" size={20} />
            </div>
            <h3 className="text-slate-600 text-sm font-medium mb-1">Total Businesses</h3>
            <p className="text-3xl font-bold text-slate-800">{stats.totalBusinesses}</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="text-green-600" size={24} />
              </div>
              <TrendingUp className="text-green-600" size={20} />
            </div>
            <h3 className="text-slate-600 text-sm font-medium mb-1">Total Users</h3>
            <p className="text-3xl font-bold text-slate-800">{stats.totalUsers}</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Receipt className="text-purple-600" size={24} />
              </div>
              <TrendingUp className="text-purple-600" size={20} />
            </div>
            <h3 className="text-slate-600 text-sm font-medium mb-1">Total Receipts</h3>
            <p className="text-3xl font-bold text-slate-800">{stats.totalReceipts}</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <Users className="text-red-600" size={24} />
              </div>
            </div>
            <h3 className="text-slate-600 text-sm font-medium mb-1">System Admins</h3>
            <p className="text-3xl font-bold text-slate-800">{stats.systemAdmins}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-800">All Businesses</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Business Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Owner Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Members
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Receipts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Created At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {businesses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No businesses found
                    </td>
                  </tr>
                ) : (
                  businesses.map((business) => (
                    <tr key={business.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{business.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600">{business.owner_email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600">{business.member_count}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600">{business.receipt_count}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600">
                          {new Date(business.created_at).toLocaleDateString()}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
