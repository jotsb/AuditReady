import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  suspendUser,
  unsuspendUser,
  sendPasswordResetEmail,
  changeUserPassword,
  softDeleteUser,
  hardDeleteUser,
  restoreDeletedUser,
  updateUserProfile,
  getUserDetails,
  validatePassword,
  forceLogoutUser,
  type UserDetails,
} from '../../lib/adminService';
import {
  UserX,
  UserCheck,
  Key,
  Mail,
  Trash2,
  RefreshCw,
  Edit,
  AlertTriangle,
  X,
  Check,
  Eye,
  EyeOff,
  LogOut,
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  last_login_at: string | null;
  suspended: boolean;
  deleted_at: string | null;
}

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);

  // Action states
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form states
  const [suspendReason, setSuspendReason] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    phone_number: '',
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');

      // Query profiles which are linked to auth.users
      // System admins have permission to view all profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name, suspended, deleted_at, last_login_at, created_at')
        .order('created_at', { ascending: false });

      if (profileError) throw profileError;

      const enrichedUsers = profiles?.map(p => ({
        id: p.id,
        email: p.email || '',
        full_name: p.full_name || null,
        created_at: p.created_at,
        last_login_at: p.last_login_at || null,
        suspended: p.suspended || false,
        deleted_at: p.deleted_at || null,
      })) || [];

      setUsers(enrichedUsers);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (user: User) => {
    try {
      setSelectedUser(user);
      setShowDetails(true);
      const details = await getUserDetails(user.id, currentUser!.id);
      setUserDetails(details);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleSuspend = async () => {
    if (!selectedUser || !suspendReason.trim()) return;

    try {
      setActionLoading(true);
      setActionError('');
      await suspendUser(selectedUser.id, suspendReason, currentUser!.id);
      setActionSuccess('User suspended successfully');
      setShowSuspendModal(false);
      setSuspendReason('');
      await loadUsers();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsuspend = async (user: User) => {
    try {
      setActionLoading(true);
      setActionError('');
      await unsuspendUser(user.id, currentUser!.id);
      setActionSuccess('User unsuspended successfully');
      await loadUsers();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendPasswordReset = async (user: User) => {
    try {
      setActionLoading(true);
      setActionError('');
      await sendPasswordResetEmail(user.email, currentUser!.id);
      setActionSuccess('Password reset email sent successfully');
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser || !newPassword) return;

    const validation = await validatePassword(newPassword);
    if (!validation.valid) {
      setActionError(validation.errors.join(', '));
      return;
    }

    try {
      setActionLoading(true);
      setActionError('');
      await changeUserPassword(selectedUser.id, newPassword, currentUser!.id);
      setActionSuccess('Password changed successfully');
      setShowPasswordModal(false);
      setNewPassword('');
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!selectedUser || !deleteReason.trim()) return;

    try {
      setActionLoading(true);
      setActionError('');
      await softDeleteUser(selectedUser.id, deleteReason, currentUser!.id);
      setActionSuccess('User soft deleted successfully');
      setShowDeleteModal(false);
      setDeleteReason('');
      await loadUsers();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleHardDelete = async (user: User) => {
    if (!confirm('PERMANENT DELETE: This will permanently delete the user and all their data. This action cannot be undone. Are you absolutely sure?')) {
      return;
    }

    try {
      setActionLoading(true);
      setActionError('');
      await hardDeleteUser(user.id, currentUser!.id);
      setActionSuccess('User permanently deleted');
      await loadUsers();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (user: User) => {
    try {
      setActionLoading(true);
      setActionError('');
      await restoreDeletedUser(user.id, currentUser!.id);
      setActionSuccess('User restored successfully');
      await loadUsers();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!selectedUser) return;

    try {
      setActionLoading(true);
      setActionError('');
      await updateUserProfile(selectedUser.id, editForm, currentUser!.id);
      setActionSuccess('User profile updated successfully');
      setShowEditModal(false);
      await loadUsers();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleForceLogout = async (user: User) => {
    if (!confirm(`Force logout ${user.email} from all devices?`)) {
      return;
    }

    try {
      setActionLoading(true);
      setActionError('');
      await forceLogoutUser(user.id, currentUser!.id);
      setActionSuccess('User logged out from all devices');
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      full_name: user.full_name || '',
      email: user.email,
      phone_number: '',
    });
    setShowEditModal(true);
  };

  if (loading) {
    return <div className="text-center py-12">Loading users...</div>;
  }

  if (error) {
    return <div className="text-center py-12 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">User Management</h2>
        <button
          onClick={loadUsers}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          <RefreshCw className="w-5 h-5" />
          Refresh
        </button>
      </div>

      {actionSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          {actionSuccess}
        </div>
      )}

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {actionError}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow -mx-4 sm:mx-0">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className={user.deleted_at ? 'bg-red-50' : user.suspended ? 'bg-yellow-50' : ''}>
                <td className="px-6 py-4">
                  <div>
                    <div className="font-medium text-gray-900">{user.full_name || 'No name'}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {user.deleted_at ? (
                    <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">Deleted</span>
                  ) : user.suspended ? (
                    <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">Suspended</span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">Active</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewDetails(user)}
                      className="text-blue-600 hover:text-blue-700"
                      title="View Details"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => openEditModal(user)}
                      className="text-gray-600 hover:text-gray-700"
                      title="Edit Profile"
                      disabled={!!user.deleted_at}
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    {!user.deleted_at && (
                      <button
                        onClick={() => handleForceLogout(user)}
                        className="text-orange-600 hover:text-orange-700"
                        title="Force Logout from All Devices"
                      >
                        <LogOut className="w-5 h-5" />
                      </button>
                    )}
                    {user.deleted_at ? (
                      <>
                        <button
                          onClick={() => handleRestore(user)}
                          className="text-green-600 hover:text-green-700"
                          title="Restore User"
                        >
                          <RefreshCw className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleHardDelete(user)}
                          className="text-red-600 hover:text-red-700"
                          title="Permanent Delete"
                        >
                          <AlertTriangle className="w-5 h-5" />
                        </button>
                      </>
                    ) : user.suspended ? (
                      <>
                        <button
                          onClick={() => handleUnsuspend(user)}
                          className="text-green-600 hover:text-green-700"
                          title="Unsuspend"
                        >
                          <UserCheck className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => { setSelectedUser(user); setShowDeleteModal(true); }}
                          className="text-red-600 hover:text-red-700"
                          title="Delete User"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setSelectedUser(user); setShowSuspendModal(true); }}
                          className="text-yellow-600 hover:text-yellow-700"
                          title="Suspend"
                        >
                          <UserX className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleSendPasswordReset(user)}
                          className="text-blue-600 hover:text-blue-700"
                          title="Send Password Reset Email"
                        >
                          <Mail className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => { setSelectedUser(user); setShowPasswordModal(true); }}
                          className="text-purple-600 hover:text-purple-700"
                          title="Change Password"
                        >
                          <Key className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => { setSelectedUser(user); setShowDeleteModal(true); }}
                          className="text-red-600 hover:text-red-700"
                          title="Delete User"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* User Details Modal */}
      {showDetails && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">User Details</h3>
              <button onClick={() => setShowDetails(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            {userDetails && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                    <p className="font-medium">{userDetails.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Full Name</p>
                    <p className="font-medium">{userDetails.full_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                    <p className="font-medium">{userDetails.phone_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">MFA Enabled</p>
                    <p className="font-medium">{userDetails.mfa_enabled ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Businesses Owned</p>
                    <p className="font-medium">{userDetails.business_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Business Memberships</p>
                    <p className="font-medium">{userDetails.member_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Receipts Uploaded</p>
                    <p className="font-medium">{userDetails.receipt_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Last Login</p>
                    <p className="font-medium">
                      {userDetails.last_login_at
                        ? new Date(userDetails.last_login_at).toLocaleString()
                        : 'Never'}
                    </p>
                  </div>
                </div>
                {userDetails.suspended && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="font-medium text-yellow-800">Suspension Reason:</p>
                    <p className="text-yellow-700">{userDetails.suspension_reason || 'No reason provided'}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Suspend User</h3>
            <p className="text-gray-600 mb-4">Suspending: {selectedUser.email}</p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Reason for suspension..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              rows={4}
            />
            <div className="flex gap-3">
              <button
                onClick={handleSuspend}
                disabled={actionLoading || !suspendReason.trim()}
                className="flex-1 bg-yellow-600 text-white py-2 rounded-lg hover:bg-yellow-700 disabled:opacity-50"
              >
                {actionLoading ? 'Suspending...' : 'Suspend User'}
              </button>
              <button
                onClick={() => { setShowSuspendModal(false); setSuspendReason(''); }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Change User Password</h3>
            <p className="text-gray-600 mb-4">User: {selectedUser.email}</p>
            <div className="relative mb-4">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Password must be at least 8 characters, include uppercase, lowercase, number, and special character
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleChangePassword}
                disabled={actionLoading || !newPassword}
                className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {actionLoading ? 'Changing...' : 'Change Password'}
              </button>
              <button
                onClick={() => { setShowPasswordModal(false); setNewPassword(''); }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h3 className="text-xl font-bold text-red-600">Delete User</h3>
            </div>
            <p className="text-gray-600 mb-2">Deleting: {selectedUser.email}</p>
            <p className="text-sm text-gray-500 mb-4">
              This is a soft delete. The user will be marked as deleted but data will be retained.
              You can restore the user later or permanently delete them.
            </p>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Reason for deletion..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              rows={4}
            />
            <div className="flex gap-3">
              <button
                onClick={handleSoftDelete}
                disabled={actionLoading || !deleteReason.trim()}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Deleting...' : 'Delete User'}
              </button>
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteReason(''); }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Edit User Profile</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={editForm.phone_number}
                  onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdateProfile}
                disabled={actionLoading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? 'Updating...' : 'Update Profile'}
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
