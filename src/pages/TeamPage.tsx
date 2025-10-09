import { useState, useEffect } from 'react';
import { Users, Mail, UserPlus, Shield, Trash2, X, Link2, Copy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePageTracking } from '../hooks/usePageTracking';
import { actionTracker } from '../lib/actionTracker';

interface TeamMember {
  id: string;
  user_id: string;
  role: 'owner' | 'manager' | 'member';
  joined_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

interface Invitation {
  id: string;
  email: string;
  role: 'owner' | 'manager' | 'member';
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  expires_at: string;
  created_at: string;
  token?: string;
}

export default function TeamPage() {
  const { user } = useAuth();

  usePageTracking('Team', { section: 'team' });

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'owner' | 'manager' | 'member'>('member');
  const [error, setError] = useState('');
  const [currentMembersPage, setCurrentMembersPage] = useState(1);
  const [currentInvitesPage, setCurrentInvitesPage] = useState(1);
  const [totalMembers, setTotalMembers] = useState(0);
  const [totalInvites, setTotalInvites] = useState(0);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    loadTeamData();
  }, [user]);

  useEffect(() => {
    if (user) {
      loadTeamData();
    }
  }, [currentMembersPage, currentInvitesPage]);

  const loadTeamData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError('');

      const { data: memberData, error: memberError } = await supabase
        .from('business_members')
        .select('business_id, role')
        .eq('user_id', user.id)
        .single();

      if (memberError) throw memberError;

      setBusinessId(memberData.business_id);
      setUserRole(memberData.role);

      const membersStartIndex = (currentMembersPage - 1) * itemsPerPage;
      const membersEndIndex = membersStartIndex + itemsPerPage - 1;
      const invitesStartIndex = (currentInvitesPage - 1) * itemsPerPage;
      const invitesEndIndex = invitesStartIndex + itemsPerPage - 1;

      const [membersCountResult, membersResult, invitationsCountResult, invitationsResult] = await Promise.all([
        supabase
          .from('business_members')
          .select('*', { count: 'exact', head: true })
          .eq('business_id', memberData.business_id),

        supabase
          .from('business_members')
          .select('id, user_id, role, joined_at')
          .eq('business_id', memberData.business_id)
          .order('joined_at', { ascending: false })
          .range(membersStartIndex, membersEndIndex),

        supabase
          .from('invitations')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', memberData.business_id)
          .eq('status', 'pending'),

        supabase
          .from('invitations')
          .select('id, email, role, status, expires_at, created_at, token')
          .eq('business_id', memberData.business_id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .range(invitesStartIndex, invitesEndIndex)
      ]);

      if (membersResult.error) throw membersResult.error;
      if (invitationsResult.error) throw invitationsResult.error;

      const enrichedMembers = await Promise.all(
        (membersResult.data || []).map(async (member: any) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', member.user_id)
            .maybeSingle();

          return {
            ...member,
            profiles: {
              full_name: profileData?.full_name || 'Unknown',
              email: profileData?.email || 'Unknown'
            }
          };
        })
      );

      setMembers(enrichedMembers as TeamMember[]);
      setInvitations(invitationsResult.data || []);
      setTotalMembers(membersCountResult.count || 0);
      setTotalInvites(invitationsCountResult.count || 0);
    } catch (err: any) {
      console.error('Error loading team data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !user) return;

    try {
      setError('');

      const { data: existingInvite } = await supabase
        .from('invitations')
        .select('id')
        .eq('business_id', businessId)
        .eq('email', inviteEmail)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingInvite) {
        setError('An invitation has already been sent to this email');
        return;
      }

      const { error: inviteError } = await supabase
        .from('invitations')
        .insert({
          business_id: businessId,
          email: inviteEmail,
          role: inviteRole,
          invited_by: user.id
        });

      if (inviteError) throw inviteError;

      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('member');
      await loadTeamData();
    } catch (err: any) {
      console.error('Error sending invitation:', err);
      setError(err.message);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'owner' | 'manager' | 'member') => {
    if (!businessId) return;

    try {
      setError('');

      const { error } = await supabase
        .from('business_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      await loadTeamData();
    } catch (err: any) {
      console.error('Error updating role:', err);
      setError(err.message);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;
    if (!businessId) return;

    try {
      setError('');

      const { error } = await supabase
        .from('business_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      await loadTeamData();
    } catch (err: any) {
      console.error('Error removing member:', err);
      setError(err.message);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!businessId) return;

    try {
      setError('');

      const { error } = await supabase
        .from('invitations')
        .update({ status: 'expired' })
        .eq('id', invitationId);

      if (error) throw error;

      await loadTeamData();
    } catch (err: any) {
      console.error('Error canceling invitation:', err);
      setError(err.message);
    }
  };

  const handleCopyInviteLink = (token: string) => {
    const baseUrl = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
    const inviteLink = `${baseUrl}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const canManageTeam = userRole === 'owner';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading team...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Team Management</h1>
        </div>
        {canManageTeam && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Invite Member
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Team Members ({totalMembers})</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {members.map((member) => (
            <div key={member.id} className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{member.profiles.full_name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{member.profiles.email}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Joined {new Date(member.joined_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {canManageTeam && member.role !== 'owner' ? (
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="member">Member</option>
                    <option value="manager">Manager</option>
                    <option value="owner">Owner</option>
                  </select>
                ) : (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    member.role === 'owner' ? 'bg-purple-100 text-purple-700' :
                    member.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    <Shield className="w-4 h-4 inline mr-1" />
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </span>
                )}
                {canManageTeam && member.role !== 'owner' && (
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {totalMembers > itemsPerPage && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Showing {((currentMembersPage - 1) * itemsPerPage) + 1} to {Math.min(currentMembersPage * itemsPerPage, totalMembers)} of {totalMembers} members
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentMembersPage(p => Math.max(1, p - 1))}
                disabled={currentMembersPage === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentMembersPage(p => Math.min(Math.ceil(totalMembers / itemsPerPage), p + 1))}
                disabled={currentMembersPage >= Math.ceil(totalMembers / itemsPerPage)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {totalInvites > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Pending Invitations ({totalInvites})</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Mail className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{invitation.email}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Invited as {invitation.role}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Expires {new Date(invitation.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {invitation.token && (
                    <button
                      onClick={() => handleCopyInviteLink(invitation.token!)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Copy invitation link"
                    >
                      {copiedToken === invitation.token ? (
                        <span className="text-xs font-medium px-2">Copied!</span>
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  )}
                  {canManageTeam && (
                    <button
                      onClick={() => handleCancelInvitation(invitation.id)}
                      className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalInvites > itemsPerPage && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing {((currentInvitesPage - 1) * itemsPerPage) + 1} to {Math.min(currentInvitesPage * itemsPerPage, totalInvites)} of {totalInvites} invitations
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentInvitesPage(p => Math.max(1, p - 1))}
                  disabled={currentInvitesPage === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentInvitesPage(p => Math.min(Math.ceil(totalInvites / itemsPerPage), p + 1))}
                  disabled={currentInvitesPage >= Math.ceil(totalInvites / itemsPerPage)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Invite Team Member</h2>
            </div>
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="colleague@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="member">Member - Can view and create receipts</option>
                  <option value="manager">Manager - Can manage receipts and collections</option>
                  <option value="owner">Owner - Full access</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail('');
                    setInviteRole('member');
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
