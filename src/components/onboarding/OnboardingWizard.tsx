import { useState } from 'react';
import { Building2, FolderPlus, CheckCircle, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../lib/logger';

interface OnboardingWizardProps {
  onComplete: () => void;
}

type Step = 'welcome' | 'create-business' | 'create-collection' | 'complete';

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('welcome');
  const [businessName, setBusinessName] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [createdBusinessId, setCreatedBusinessId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateBusiness = async () => {
    if (!businessName.trim()) {
      setError('Business name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: businessError } = await supabase
        .from('businesses')
        .insert({
          name: businessName.trim(),
          owner_id: user!.id,
          currency: 'CAD'
        })
        .select()
        .single();

      if (businessError) throw businessError;

      setCreatedBusinessId(data.id);
      logger.userAction('business_created', 'business', {
        businessId: data.id,
        page: 'OnboardingWizard'
      });

      // Auto-create default collection
      setCollectionName('General');
      setStep('create-collection');
    } catch (err: any) {
      logger.error('Failed to create business during onboarding', err as Error, {
        page: 'OnboardingWizard'
      });
      setError(err.message || 'Failed to create business');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!collectionName.trim()) {
      setError('Collection name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: collectionError } = await supabase
        .from('collections')
        .insert({
          name: collectionName.trim(),
          business_id: createdBusinessId
        })
        .select()
        .single();

      if (collectionError) throw collectionError;

      logger.userAction('collection_created', 'collection', {
        collectionId: data.id,
        businessId: createdBusinessId,
        page: 'OnboardingWizard'
      });

      setStep('complete');

      // Auto-complete after 2 seconds
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err: any) {
      logger.error('Failed to create collection during onboarding', err as Error, {
        page: 'OnboardingWizard'
      });
      setError(err.message || 'Failed to create collection');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full p-8 animate-fadeIn">

        {/* Welcome Step */}
        {step === 'welcome' && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto">
              <Building2 size={40} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
                Welcome to Audit Proof!
              </h2>
              <p className="text-lg text-slate-600 dark:text-gray-400">
                Let's get you started by setting up your first business and collection.
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-left space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Create a Business</p>
                  <p className="text-sm text-slate-600 dark:text-gray-400">
                    A business represents your company or organization
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Create a Collection</p>
                  <p className="text-sm text-slate-600 dark:text-gray-400">
                    Collections help organize your receipts by project, department, or category
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setStep('create-business')}
              className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Get Started
              <ArrowRight size={20} />
            </button>
          </div>
        )}

        {/* Create Business Step */}
        {step === 'create-business' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 size={32} className="text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Create Your Business
              </h2>
              <p className="text-slate-600 dark:text-gray-400">
                Enter the name of your business or organization
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                Business Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g., Acme Corp, John's Consulting"
                className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500"
                disabled={loading}
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    handleCreateBusiness();
                  }
                }}
              />
              <p className="text-xs text-slate-500 dark:text-gray-400">
                You can create additional businesses later in Settings
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('welcome')}
                disabled={loading}
                className="flex-1 px-6 py-3 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleCreateBusiness}
                disabled={loading || !businessName.trim()}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Create Collection Step */}
        {step === 'create-collection' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <FolderPlus size={32} className="text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Create Your First Collection
              </h2>
              <p className="text-slate-600 dark:text-gray-400">
                Collections help you organize receipts by project or category
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">
                Collection Name
              </label>
              <input
                type="text"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="e.g., General, Q1 2025, Travel Expenses"
                className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500"
                disabled={loading}
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    handleCreateCollection();
                  }
                }}
              />
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Start with "General" and create more collections later
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('create-business')}
                disabled={loading}
                className="flex-1 px-6 py-3 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleCreateCollection}
                disabled={loading || !collectionName.trim()}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <div className="text-center space-y-6 py-8">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle size={40} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
                All Set!
              </h2>
              <p className="text-lg text-slate-600 dark:text-gray-400">
                Your workspace is ready. You can now start uploading receipts.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium">
              <div className="w-5 h-5 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
              Loading your workspace...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
