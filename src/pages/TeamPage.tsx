import { useState, useEffect } from 'react';
import { Users, Mail, UserPlus, Shield, Trash2, Copy, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePageTracking } from '../hooks/usePageTracking';
import { actionTracker } from '../lib/actionTracker';
import { logger } from '../lib/logger';

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
  const { user, selectedBusiness, userRole: contextUserRole } = useAuth();

  usePageTracking('Team', { section: 'team' });

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessOwnerId, setBusinessOwnerId] = useState<string | null>(null);
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
  }, [user, selectedBusiness]);

  useEffect(() => {
    if (user && selectedBusiness) {
      loadTeamData();
    }
  }, [currentMembersPage, currentInvitesPage]);

  const loadTeamData = async () => {
    if (!user || !selectedBusiness) {
      setLoading(false);
      return;
    }

    const startTime = performance.now();
    logger.info('Loading team data', { userId: user.id, businessId: selectedBusiness.id, membersPage: currentMembersPage, invitesPage: currentInvitesPage }, 'DATABASE');

    try {
      setLoading(true);
      setError('');

      setBusinessId(selectedBusiness.id);
      setUserRole(contextUserRole);

      const { data: businessData } = await supabase
        .from('businesses')
        .select('owner_id')
        .eq('id', selectedBusiness.id)
        .maybeSingle<{ owner_id: string }>();

      if (businessData) {
        setBusinessOwnerId(businessData.owner_id);
      }

      const membersStartIndex = (currentMembersPage - 1) * itemsPerPage;
      const membersEndIndex = membersStartIndex + itemsPerPage - 1;
      const invitesStartIndex = (currentInvitesPage - 1) * itemsPerPage;
      const invitesEndIndex = invitesStartIndex + itemsPerPage - 1;

      const [membersCountResult, membersResult, invitationsCountResult, invitationsResult] = await Promise.all([
        supabase
          .from('business_members')
          .select('*', { count: 'exact', head: true })
          .eq('business_id', selectedBusiness.id),

        supabase
          .from('business_members')
          .select('id, user_id, role, joined_at, profiles:profiles!user_id(full_name, email)')
          .eq('business_id', selectedBusiness.id)
          .order('joined_at', { ascending: false })
          .range(membersStartIndex, membersEndIndex),

        supabase
          .from('invitations')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', selectedBusiness.id)
          .eq('status', 'pending'),

        supabase
          .from('invitations')
          .select('id, email, role, status, expires_at, created_at, token')
          .eq('business_id', selectedBusiness.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .range(invitesStartIndex, invitesEndIndex)
      ]);

      if (membersResult.error) {
        logger.error('Failed to fetch team members', membersResult.error, { businessId: selectedBusiness.id });
        logger.database('select', 'business_members', false, { businessId: selectedBusiness.id, error: membersResult.error.message });
        throw membersResult.error;
      }
      if (invitationsResult.error) {
        logger.error('Failed to fetch invitations', invitationsResult.error, { businessId: selectedBusiness.id });
        logger.database('select', 'invitations', false, { businessId: selectedBusiness.id, error: invitationsResult.error.message });
        throw invitationsResult.error;
      }

      // The profiles are now included in the join, eliminating the N+1 query
      const membersList = (membersResult.data || []).map((member: any) => ({
        ...member,
        profiles: member.profiles || { full_name: 'Unknown', email: 'Unknown' }
      }));

      setMembers(membersList as TeamMember[]);
      setInvitations(invitationsResult.data || []);
      setTotalMembers(membersCountResult.count || 0);
      setTotalInvites(invitationsCountResult.count || 0);

      const executionTime = performance.now() - startTime;
      logger.performance('loadTeamData', executionTime, {
        membersCount: membersCountResult.count || 0,
        invitesCount: invitationsCountResult.count || 0
      });
      logger.info('Team data loaded successfully', {
        membersCount: membersCountResult.count || 0,
        invitesCount: invitationsCountResult.count || 0
      }, 'DATABASE');
      logger.database('select', 'team_data', true, {
        membersCount: membersCountResult.count || 0,
        invitesCount: invitationsCountResult.count || 0
      });
    } catch (err: any) {
      logger.error('Error loading team data', err, { userId: user.id });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !user) return;

    logger.info('Starting team invitation', { email: inviteEmail, role: inviteRole, businessId }, 'USER_ACTION');

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
        logger.warn('Duplicate invitation attempted', { email: inviteEmail, businessId }, 'USER_ACTION');
        setError('An invitation has already been sent to this email');
        return;
      }

      logger.debug('Inserting invitation record', { email: inviteEmail, role: inviteRole, businessId }, 'DATABASE');
      const { data: invitationData, error: inviteError } = await supabase
        .from('invitations')
        .insert({
          business_id: businessId,
          email: inviteEmail,
          role: inviteRole,
          invited_by: user.id
        })
        .select<'*, id, email, role, token'>()
        .single() as { data: { id: string; email: string; role: string; token: string } | null; error: any };

      if (inviteError || !invitationData) {
        logger.error('Failed to create invitation', inviteError, { email: inviteEmail, role: inviteRole, businessId });
        logger.database('insert', 'invitations', false, { email: inviteEmail, error: inviteError?.message });
        throw inviteError || new Error('Failed to create invitation');
      }

      logger.info('Invitation record created', { email: inviteEmail, role: inviteRole, invitationId: invitationData.id }, 'DATABASE');
      logger.database('insert', 'invitations', true, { email: inviteEmail, role: inviteRole });

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle<{ full_name: string }>();

      const { data: businessData } = await supabase
        .from('businesses')
        .select('name')
        .eq('id', businessId)
        .maybeSingle<{ name: string }>();

      try {
        logger.info('Calling send-invitation-email edge function', { email: inviteEmail }, 'EDGE_FUNCTION');

        const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation-email`;
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            email: invitationData.email,
            role: invitationData.role,
            token: invitationData.token,
            inviterName: profileData?.full_name,
            businessName: businessData?.name
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          logger.error('Edge function failed to send email', undefined, {
            email: inviteEmail,
            status: response.status,
            error: errorData
          });
          logger.edgeFunction('send-invitation-email', false, { error: errorData });
        } else {
          const result = await response.json();
          logger.info('Invitation email sent successfully', { email: inviteEmail, result }, 'EDGE_FUNCTION');
          logger.edgeFunction('send-invitation-email', true, { email: inviteEmail });
        }
      } catch (emailError: any) {
        logger.error('Failed to call edge function', emailError, { email: inviteEmail });
        logger.edgeFunction('send-invitation-email', false, { error: emailError.message });
      }

      logger.info('Team invitation completed', { email: inviteEmail, role: inviteRole }, 'USER_ACTION');
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('member');
      await loadTeamData();
    } catch (err: any) {
      logger.error('Error sending invitation', err, { email: inviteEmail, role: inviteRole, businessId });
      setError(err.message);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'owner' | 'manager' | 'member') => {
    if (!businessId) return;

    logger.info('Changing team member role', { memberId, newRole, businessId }, 'USER_ACTION');

    try {
      setError('');

      const { error } = await supabase
        .from('business_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) {
        logger.error('Failed to update team member role', error, { memberId, newRole, businessId });
        logger.database('update', 'business_members', false, { memberId, error: error.message });
        throw error;
      }

      logger.info('Team member role updated successfully', { memberId, newRole }, 'USER_ACTION');
      logger.database('update', 'business_members', true, { memberId, newRole });
      await loadTeamData();
    } catch (err: any) {
      logger.error('Error updating role', err, { memberId, newRole, businessId });
      setError(err.message);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;
    if (!businessId) return;

    logger.info('Removing team member', { memberId, businessId }, 'USER_ACTION');

    try {
      setError('');

      const { error } = await supabase
        .from('business_members')
        .delete()
        .eq('id', memberId);

      if (error) {
        logger.error('Failed to remove team member', error, { memberId, businessId });
        logger.database('delete', 'business_members', false, { memberId, error: error.message });
        throw error;
      }

      logger.info('Team member removed successfully', { memberId }, 'USER_ACTION');
      logger.database('delete', 'business_members', true, { memberId });
      await loadTeamData();
    } catch (err: any) {
      logger.error('Error removing member', err, { memberId, businessId });
      setError(err.message);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!businessId) return;

    logger.info('Canceling invitation', { invitationId, businessId }, 'USER_ACTION');

    try {
      setError('');

      const { error } = await supabase
        .from('invitations')
        .update({ status: 'expired' })
        .eq('id', invitationId);

      if (error) {
        logger.error('Failed to cancel invitation', error, { invitationId, businessId });
        logger.database('update', 'invitations', false, { invitationId, error: error.message });
        throw error;
      }

      logger.info('Invitation canceled successfully', { invitationId }, 'USER_ACTION');
      logger.database('update', 'invitations', true, { invitationId, status: 'expired' });
      await loadTeamData();
    } catch (err: any) {
      logger.error('Error canceling invitation', err, { invitationId, businessId });
      setError(err.message);
    }
  };

  const handleCopyInviteLink = (token: string) => {
    const baseUrl = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
    const inviteLink = `${baseUrl}/accept-invite?token=${token}`;
    logger.debug('Copying invitation link', { token: token.substring(0, 8) + '...' }, 'USER_ACTION');
    navigator.clipboard.writeText(inviteLink);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
    logger.info('Invitation link copied to clipboard', {}, 'USER_ACTION');
  };

  const handleResendInvitation = async (invitationId: string) => {
    if (!businessId || !user) return;

    logger.info('Resending invitation', { invitationId }, 'USER_ACTION');

    try {
      setError('');

      const { data: invitation, error: fetchError } = await supabase
        .from('invitations')
        .select('email, role, token')
        .eq('id', invitationId)
        .maybeSingle<{ email: string; role: string; token: string }>();

      if (fetchError) {
        logger.error('Failed to fetch invitation for resend', fetchError, { invitationId });
        logger.database('select', 'invitations', false, { invitationId, error: fetchError.message });
        throw fetchError;
      }

      if (!invitation) {
        const error = new Error('Invitation not found');
        logger.error('Invitation not found for resend', error, { invitationId });
        throw error;
      }

      const { error: updateError } = await supabase
        .from('invitations')
        .update({
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('id', invitationId);

      if (updateError) {
        logger.error('Failed to update invitation expiry', updateError, { invitationId });
        logger.database('update', 'invitations', false, { invitationId, error: updateError.message });
        throw updateError;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle<{ full_name: string }>();

      const { data: businessData } = await supabase
        .from('businesses')
        .select('name')
        .eq('id', businessId)
        .maybeSingle<{ name: string }>();

      try {
        logger.info('Calling send-invitation-email edge function for resend', { email: invitation.email }, 'EDGE_FUNCTION');

        const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation-email`;
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            email: invitation.email,
            role: invitation.role,
            token: invitation.token,
            inviterName: profileData?.full_name,
            businessName: businessData?.name
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          logger.error('Edge function failed to resend email', undefined, {
            email: invitation.email,
            status: response.status,
            error: errorData
          });
          logger.edgeFunction('send-invitation-email', false, { error: errorData });
        } else {
          const result = await response.json();
          logger.info('Invitation email resent successfully', { email: invitation.email, result }, 'EDGE_FUNCTION');
          logger.edgeFunction('send-invitation-email', true, { email: invitation.email });
        }
      } catch (emailError: any) {
        logger.error('Failed to call edge function for resend', emailError, { email: invitation.email });
        logger.edgeFunction('send-invitation-email', false, { error: emailError.message });
      }

      actionTracker.buttonClick('resend_invitation', {
        invitationId,
        email: invitation.email,
        role: invitation.role
      });

      logger.info('Invitation resent successfully', { invitationId, email: invitation.email }, 'USER_ACTION');
      logger.database('update', 'invitations', true, { invitationId, action: 'resend' });
      await loadTeamData();
      setError('');
      alert('Invitation resent successfully!');
    } catch (err: any) {
      logger.error('Error resending invitation', err, { invitationId });
      setError(err.message);
    }
  };

  const canManageTeam = userRole === 'owner' || userRole === 'manager';
  const isOwner = userRole === 'owner';

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
                {canManageTeam && member.user_id !== businessOwnerId ? (
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="member">Member</option>
                    <option value="manager">Manager</option>
                    {isOwner && <option value="owner">Owner</option>}
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
                {canManageTeam && member.user_id !== businessOwnerId && (
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
          <div className="flex flex-col items-center gap-3 px-6 py-4 border-t border-gray-200">
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
            <div className="text-sm text-gray-600">
              Showing {((currentMembersPage - 1) * itemsPerPage) + 1} to {Math.min(currentMembersPage * itemsPerPage, totalMembers)} of {totalMembers} members
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
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
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
                    <>
                      <button
                        onClick={() => handleResendInvitation(invitation.id)}
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title="Resend invitation"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleCancelInvitation(invitation.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete invitation"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalInvites > itemsPerPage && (
            <div className="flex flex-col items-center gap-3 px-6 py-4 border-t border-gray-200">
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
              <div className="text-sm text-gray-600">
                Showing {((currentInvitesPage - 1) * itemsPerPage) + 1} to {Math.min(currentInvitesPage * itemsPerPage, totalInvites)} of {totalInvites} invitations
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
                  <option value="manager">Manager - Can manage team and all receipts</option>
                  {isOwner && <option value="owner">Owner - Full access</option>}
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
