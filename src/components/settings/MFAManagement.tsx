import { useState, useEffect } from 'react';
import { Shield, ShieldOff, RefreshCw, Trash2, Smartphone, AlertTriangle, Check, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useMFA } from '../../hooks/useMFA';
import { supabase } from '../../lib/supabase';
import { MFASetup } from './MFASetup';
import { RecoveryCodesDisplay } from './RecoveryCodesDisplay';
import type { TrustedDevice } from '../../lib/mfaUtils';
import { logger } from '../../lib/logger';

export function MFAManagement() {
  const { user } = useAuth();
  const {
    listFactors,
    unenrollFactor,
    generateAndStoreRecoveryCodes,
    regenerateRecoveryCodes,
    removeTrustedDevice,
    loading
  } = useMFA();

  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaMethod, setMfaMethod] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showMFAVerifyModal, setShowMFAVerifyModal] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[]>([]);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [recoveryCodesCount, setRecoveryCodesCount] = useState(0);
  const [expiringCodesWarning, setExpiringCodesWarning] = useState<{ count: number; days: number } | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadMFAStatus();
  }, [user]);

  const loadMFAStatus = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('mfa_enabled, mfa_method, trusted_devices')
        .eq('id', user.id)
        .single();

      if (profile) {
        setMfaEnabled(profile.mfa_enabled || false);
        setMfaMethod(profile.mfa_method);
        setTrustedDevices(profile.trusted_devices || []);
      }

      if (profile?.mfa_enabled) {
        const factors = await listFactors();
        if (factors.length > 0) {
          setFactorId(factors[0].id);
        }
      }

      const { count } = await supabase
        .from('recovery_codes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('used', false)
        .gte('expires_at', new Date().toISOString());

      setRecoveryCodesCount(count || 0);

      // Check for expiring codes
      if (profile?.mfa_enabled) {
        const { data: expiringData } = await supabase.rpc('check_expiring_recovery_codes', {
          p_user_id: user.id
        });

        if (expiringData && expiringData.has_expiring_codes) {
          setExpiringCodesWarning({
            count: expiringData.expiring_count,
            days: Math.floor(expiringData.days_until_expiry)
          });
        } else {
          setExpiringCodesWarning(null);
        }
      }
    } catch (err) {
      logger.error('Failed to load MFA status', err as Error, {
        userId: user?.id,
        component: 'MFAManagement',
        operation: 'load_mfa_status'
      });
    }
  };

  const handleSetupComplete = () => {
    setShowSetup(false);
    setSuccess('Two-factor authentication enabled successfully!');
    setTimeout(() => setSuccess(''), 5000);
    loadMFAStatus();
  };

  const handleDisable = async () => {
    if (!confirmPassword) {
      setError('Please enter your password to confirm');
      return;
    }

    if (!factorId) {
      setError('No MFA factor found');
      return;
    }

    try {
      setError('');

      // Re-authenticate with password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: confirmPassword
      });

      if (signInError) {
        setError('Incorrect password');
        return;
      }

      // Check if we need to verify MFA first (AAL2 required)
      const { data: { session } } = await supabase.auth.getSession();
      const currentAAL = session?.user?.aal;

      if (currentAAL !== 'aal2') {
        // Need to challenge and verify MFA first
        setError('Please verify your authenticator code before disabling MFA');
        setShowDisableModal(false);
        setShowMFAVerifyModal(true);
        return;
      }

      // Now we can unenroll
      await unenrollFactor(factorId);

      setShowDisableModal(false);
      setConfirmPassword('');
      setSuccess('Two-factor authentication disabled successfully');
      setTimeout(() => setSuccess(''), 5000);
      loadMFAStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to disable MFA');
    }
  };

  const handleVerifyForDisable = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    if (!factorId) {
      setError('No MFA factor found');
      return;
    }

    try {
      setError('');

      // Challenge the factor
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId
      });

      if (challengeError || !challenge) {
        setError('Failed to create MFA challenge');
        return;
      }

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: verifyCode
      });

      if (verifyError) {
        setError('Invalid code. Please try again.');
        return;
      }

      // Now we have AAL2, unenroll the factor
      await unenrollFactor(factorId);

      setShowMFAVerifyModal(false);
      setVerifyCode('');
      setConfirmPassword('');
      setSuccess('Two-factor authentication disabled successfully');
      setTimeout(() => setSuccess(''), 5000);
      loadMFAStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to verify MFA');
    }
  };

  const handleRegenerateRecoveryCodes = async () => {
    if (!user) return;

    if (!confirm('Are you sure you want to regenerate recovery codes? All existing codes will be invalidated.')) {
      return;
    }

    try {
      setError('');

      const codes = await regenerateRecoveryCodes(user.id);
      setNewRecoveryCodes(codes);
      setShowRegenerateModal(false);
      setSuccess('Recovery codes regenerated successfully! Save your new codes.');
      setTimeout(() => setSuccess(''), 5000);
      loadMFAStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to regenerate recovery codes');
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (!user) return;

    if (!confirm('Remove this trusted device? You will need to verify with MFA next time you sign in from this device.')) {
      return;
    }

    try {
      await removeTrustedDevice(user.id, deviceId);
      setSuccess('Trusted device removed');
      setTimeout(() => setSuccess(''), 3000);
      loadMFAStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to remove device');
    }
  };

  const getDeviceInfo = (device: TrustedDevice) => {
    const addedDate = new Date(device.added_at).toLocaleDateString();
    const expiresDate = new Date(device.expires_at).toLocaleDateString();
    const isExpired = new Date(device.expires_at) < new Date();

    return { addedDate, expiresDate, isExpired };
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Two-Factor Authentication</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Add an extra layer of security to your account by requiring a verification code when signing in.
        </p>
      </div>

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg flex items-center gap-2">
          <Check className="w-5 h-5" />
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {mfaEnabled ? (
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-green-600" />
              </div>
            ) : (
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <ShieldOff className="w-6 h-6 text-gray-400" />
              </div>
            )}
            <div>
              <h4 className="font-semibold text-lg">
                {mfaEnabled ? 'Enabled' : 'Disabled'}
              </h4>
              {mfaEnabled && mfaMethod && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Method: {mfaMethod === 'authenticator' ? 'Authenticator App' : mfaMethod}
                </p>
              )}
            </div>
          </div>

          {!mfaEnabled ? (
            <button
              onClick={() => setShowSetup(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
            >
              <Shield className="w-4 h-4" />
              Enable MFA
            </button>
          ) : (
            <button
              onClick={() => setShowDisableModal(true)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-medium flex items-center gap-2"
            >
              <ShieldOff className="w-4 h-4" />
              Disable MFA
            </button>
          )}
        </div>

        {mfaEnabled && (
          <div className="space-y-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            {/* Low Recovery Codes Warning */}
            {recoveryCodesCount > 0 && recoveryCodesCount < 3 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 px-4 py-3 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Low on Recovery Codes</p>
                  <p className="text-sm mt-1">
                    You only have {recoveryCodesCount} recovery code{recoveryCodesCount === 1 ? '' : 's'} left.
                    Consider regenerating codes to ensure you always have backup access to your account.
                  </p>
                </div>
              </div>
            )}

            {recoveryCodesCount === 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">No Recovery Codes Left!</p>
                  <p className="text-sm mt-1">
                    You've used all your recovery codes. Generate new ones immediately to maintain backup access to your account.
                  </p>
                </div>
              </div>
            )}

            {/* Expiring Codes Warning */}
            {expiringCodesWarning && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300 px-4 py-3 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Recovery Codes Expiring Soon</p>
                  <p className="text-sm mt-1">
                    {expiringCodesWarning.count} recovery code{expiringCodesWarning.count === 1 ? '' : 's'} will expire in {expiringCodesWarning.days} day{expiringCodesWarning.days === 1 ? '' : 's'}.
                    Regenerate your codes to maintain backup access to your account.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Recovery Codes</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {recoveryCodesCount} unused codes remaining
                </p>
              </div>
              <button
                onClick={() => setShowRegenerateModal(true)}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </button>
            </div>

            {recoveryCodesCount < 3 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-lg text-sm">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                You're running low on recovery codes. Consider regenerating them.
              </div>
            )}
          </div>
        )}
      </div>

      {mfaEnabled && trustedDevices.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Trusted Devices
          </h4>
          <div className="space-y-3">
            {trustedDevices.map((device) => {
              const { addedDate, expiresDate, isExpired } = getDeviceInfo(device);
              return (
                <div
                  key={device.id}
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    isExpired
                      ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div>
                    <p className="font-medium">{device.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Added: {addedDate}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {isExpired ? 'Expired' : `Expires: ${expiresDate}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveDevice(device.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Remove device"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showSetup && (
        <MFASetup
          onComplete={handleSetupComplete}
          onCancel={() => setShowSetup(false)}
        />
      )}

      {showDisableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h3 className="text-xl font-bold">Disable Two-Factor Authentication</h3>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This will remove the extra security layer from your account. Enter your password to confirm.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your password"
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleDisable}
                disabled={loading || !confirmPassword}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
              >
                {loading ? 'Disabling...' : 'Disable MFA'}
              </button>
              <button
                onClick={() => {
                  setShowDisableModal(false);
                  setConfirmPassword('');
                  setError('');
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showMFAVerifyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Verify Authenticator Code</h3>

            <p className="text-gray-600 dark:text-gray-400 mb-4">
              To disable MFA, please enter the 6-digit code from your authenticator app.
            </p>

            <div className="mb-4">
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
                placeholder="000000"
                maxLength={6}
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleVerifyForDisable}
                disabled={loading || verifyCode.length !== 6}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {loading ? 'Verifying...' : 'Verify & Disable'}
              </button>
              <button
                onClick={() => {
                  setShowMFAVerifyModal(false);
                  setVerifyCode('');
                  setError('');
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showRegenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Regenerate Recovery Codes</h3>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-lg mb-4">
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              This will invalidate all existing recovery codes. Any unused codes will no longer work.
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You'll receive 10 new recovery codes. Make sure to save them in a secure location.
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleRegenerateRecoveryCodes}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {loading ? 'Generating...' : 'Regenerate Codes'}
              </button>
              <button
                onClick={() => setShowRegenerateModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {newRecoveryCodes.length > 0 && (
        <RecoveryCodesDisplay
          codes={newRecoveryCodes}
          onConfirm={() => {
            setNewRecoveryCodes([]);
            setSuccess('Recovery codes regenerated successfully');
            setTimeout(() => setSuccess(''), 5000);
            loadMFAStatus();
          }}
        />
      )}
    </div>
  );
}
