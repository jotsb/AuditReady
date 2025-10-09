import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, Trash2, Building2, ArrowRightLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Database } from '../../lib/database.types';

type Business = Database['public']['Tables']['businesses']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface BusinessWithOwner extends Business {
  owner?: Profile;
}

const CURRENCIES = [
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
];

export function BusinessManagement() {
  const { user, isSystemAdmin } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessWithOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [transferringBusiness, setTransferringBusiness] = useState<Business | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    tax_id: '',
    currency: 'CAD',
  });
  const [transferEmail, setTransferEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadBusinesses();
    }
  }, [user]);

  const loadBusinesses = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const [ownedResult, memberResult] = await Promise.all([
        supabase
          .from('businesses')
          .select('*, owner:profiles!businesses_owner_id_fkey(*)')
          .eq('owner_id', user.id)
          .order('name', { ascending: true }),

        supabase
          .from('business_members')
          .select('business_id, businesses(*, owner:profiles!businesses_owner_id_fkey(*))')
          .eq('user_id', user.id)
      ]);

      if (ownedResult.error) throw ownedResult.error;
      if (memberResult.error) throw memberResult.error;

      const ownedBusinesses = ownedResult.data || [];
      const memberBusinesses = memberResult.data?.map((m: any) => m.businesses).filter(Boolean) || [];

      const allBusinesses = [...ownedBusinesses, ...memberBusinesses];
      const uniqueBusinesses = Array.from(
        new Map(allBusinesses.map(b => [b.id, b])).values()
      );

      setBusinesses(uniqueBusinesses);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setError(null);
      setSuccess(null);

      const { error: insertError } = await supabase.from('businesses').insert({
        name: formData.name,
        tax_id: formData.tax_id || null,
        currency: formData.currency,
        owner_id: user.id,
      });

      if (insertError) throw insertError;

      setSuccess('Business created successfully!');
      setShowCreateModal(false);
      resetForm();
      await loadBusinesses();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBusiness) return;

    try {
      setError(null);
      setSuccess(null);

      const { error: updateError } = await supabase
        .from('businesses')
        .update({
          name: formData.name,
          tax_id: formData.tax_id || null,
          currency: formData.currency,
        })
        .eq('id', editingBusiness.id);

      if (updateError) throw updateError;

      setSuccess('Business updated successfully!');
      setEditingBusiness(null);
      resetForm();
      await loadBusinesses();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (businessId: string) => {
    if (!confirm('Are you sure you want to delete this business? All collections and receipts will also be deleted.')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const { error: deleteError } = await supabase
        .from('businesses')
        .delete()
        .eq('id', businessId);

      if (deleteError) throw deleteError;

      setSuccess('Business deleted successfully!');
      await loadBusinesses();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferringBusiness) return;

    try {
      setError(null);
      setSuccess(null);

      const { data: targetUser, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', transferEmail)
        .maybeSingle();

      if (userError) throw userError;
      if (!targetUser) {
        throw new Error('User not found. Please enter a valid user ID.');
      }

      const { error: transferError } = await supabase
        .from('businesses')
        .update({ owner_id: targetUser.id })
        .eq('id', transferringBusiness.id);

      if (transferError) throw transferError;

      setSuccess('Business ownership transferred successfully!');
      setTransferringBusiness(null);
      setTransferEmail('');
      await loadBusinesses();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const startEdit = (business: Business) => {
    setEditingBusiness(business);
    setFormData({
      name: business.name,
      tax_id: business.tax_id || '',
      currency: business.currency,
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      tax_id: '',
      currency: 'CAD',
    });
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingBusiness(null);
    setTransferringBusiness(null);
    resetForm();
    setTransferEmail('');
    setError(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Businesses</h3>
          <p className="text-sm text-slate-600 mt-1">
            Manage your business entities and their settings
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={20} />
          New Business
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 text-sm">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ">
        {businesses.map((business) => {
          const isOwner = business.owner_id === user?.id;
          return (
            <div
              key={business.id}
              className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Building2 size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-white">{business.name}</h4>
                    <p className="text-sm text-slate-500 dark:text-gray-400">
                      {business.currency} • {isOwner ? 'Owner' : 'Member'}
                    </p>
                  </div>
                </div>
                {isOwner && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(business)}
                      className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setTransferringBusiness(business)}
                      className="p-2 text-slate-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                      title="Transfer ownership"
                    >
                      <ArrowRightLeft size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(business.id)}
                      className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              {business.tax_id && (
                <div className="text-sm text-slate-600 mb-2">
                  <span className="font-medium">Tax ID:</span> {business.tax_id}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="text-sm text-slate-500 dark:text-gray-400">
                  Currency: {CURRENCIES.find(c => c.code === business.currency)?.name || business.currency}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {businesses.length === 0 && (
        <div className="text-center py-12 bg-slate-50 dark:bg-gray-800 rounded-lg border border-slate-200">
          <Building2 size={48} className="mx-auto text-slate-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No businesses yet</h3>
          <p className="text-slate-600 mb-4">Create your first business to start managing receipts</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            Create Business
          </button>
        </div>
      )}

      {(showCreateModal || editingBusiness) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-slate-800 mb-4">
              {editingBusiness ? 'Edit Business' : 'Create New Business'}
            </h3>

            <form onSubmit={editingBusiness ? handleUpdate : handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Business Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Acme Corp"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Tax ID / Business Number
                </label>
                <input
                  type="text"
                  value={formData.tax_id}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  placeholder="e.g., 123456789"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Currency *
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.name} ({currency.code})
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 dark:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {editingBusiness ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {transferringBusiness && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-slate-800 mb-4">
              Transfer Business Ownership
            </h3>

            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Warning:</strong> Transferring ownership will give another user complete control of this business. This action cannot be undone.
              </p>
            </div>

            <form onSubmit={handleTransferOwnership} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Business
                </label>
                <input
                  type="text"
                  value={transferringBusiness.name}
                  disabled
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg bg-slate-50 dark:bg-gray-800 text-slate-600 dark:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  New Owner User ID *
                </label>
                <input
                  type="text"
                  value={transferEmail}
                  onChange={(e) => setTransferEmail(e.target.value)}
                  required
                  placeholder="Enter user ID (UUID)"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                  Enter the UUID of the user you want to transfer ownership to
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 dark:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
