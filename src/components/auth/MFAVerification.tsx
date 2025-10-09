import { useState, useEffect } from 'react';
import { Shield, AlertCircle } from 'lucide-react';
import { useMFA } from '../../hooks/useMFA';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { cleanTOTPCode, formatTOTPCode, verifyRecoveryCode } from '../../lib/mfaUtils';
import { logger } from '../../lib/logger';

interface MFAVerificationProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

export function MFAVerification({ onSuccess, onCancel }: MFAVerificationProps) {
  const { user, completeMFA } = useAuth();
  const { listFactors, challengeFactor, verifyChallenge, checkTrustedDevice, addTrustedDevice, loading } = useMFA();

  const [code, setCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState('');
  const [factorId, setFactorId] = useState<string>('');
  const [challengeId, setChallengeId] = useState<string>('');
  const [attemptCount, setAttemptCount] = useState(0);

  useEffect(() => {
    initializeChallenge();
  }, []);

  const initializeChallenge = async () => {
    try {
      if (!user) {
        setError('No user session found');
        return;
      }

      const isTrusted = await checkTrustedDevice(user.id);
      if (isTrusted) {
        onSuccess();
        return;
      }

      const factors = await listFactors();
      if (factors.length === 0) {
        setError('No MFA factors found. Please contact support.');
        return;
      }

      const factor = factors[0];
      setFactorId(factor.id);

      const challenge = await challengeFactor(factor.id);
      setChallengeId(challenge.id);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize MFA verification');
    }
  };

  const handleVerifyTOTP = async () => {
    if (!code || cleanTOTPCode(code).length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    try {
      setError('');
      const success = await verifyChallenge(factorId, challengeId, cleanTOTPCode(code));

      if (success) {
        if (trustDevice && user) {
          await addTrustedDevice(user.id, 30);
        }
        await logger.mfa('mfa_verification_success', {
          method: 'totp',
          trusted_device: trustDevice
        });
        completeMFA();
        onSuccess();
      } else {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        setError('Invalid code. Please try again.');

        if (newAttemptCount >= 3) {
          await logger.mfa('mfa_verification_failed_multiple', {
            failure_count: newAttemptCount,
            method: 'totp'
          }, 'WARN');
        }

        if (newAttemptCount >= 5) {
          setError('Too many failed attempts. Please wait a few minutes before trying again.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    }
  };

  const handleVerifyRecoveryCode = async () => {
    if (!recoveryCodeInput.trim() || recoveryCodeInput.length < 8) {
      setError('Please enter a valid recovery code');
      return;
    }

    try {
      setError('');

      if (!user) throw new Error('No user found');

      const { data: recoveryCodes, error: fetchError } = await supabase
        .from('recovery_codes')
        .select('*')
        .eq('user_id', user.id)
        .eq('used', false)
        .gte('expires_at', new Date().toISOString());

      if (fetchError) throw fetchError;

      if (!recoveryCodes || recoveryCodes.length === 0) {
        setError('No valid recovery codes found. Please contact support.');
        return;
      }

      let matchedCode = null;
      for (const dbCode of recoveryCodes) {
        const isMatch = await verifyRecoveryCode(recoveryCodeInput, dbCode.code_hash);
        if (isMatch) {
          matchedCode = dbCode;
          break;
        }
      }

      if (!matchedCode) {
        setError('Invalid recovery code. Please try again.');
        return;
      }

      const { error: updateError } = await supabase
        .from('recovery_codes')
        .update({
          used: true,
          used_at: new Date().toISOString()
        })
        .eq('id', matchedCode.id);

      if (updateError) throw updateError;

      const { data: remainingCodes } = await supabase
        .from('recovery_codes')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('used', false)
        .gte('expires_at', new Date().toISOString());

      const remainingCount = remainingCodes?.length || 0;

      await logger.mfa('recovery_code_used', {
        remaining_codes: remainingCount
      }, 'WARN');

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Recovery code verification failed');
    }
  };

  const handleCodeInput = (value: string) => {
    const cleaned = cleanTOTPCode(value);
    setCode(formatTOTPCode(cleaned));
    setError('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (useRecoveryCode) {
        handleVerifyRecoveryCode();
      } else {
        handleVerifyTOTP();
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-8">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center mb-2">
          Two-Factor Authentication
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
          {useRecoveryCode
            ? 'Enter one of your recovery codes'
            : 'Enter the 6-digit code from your authenticator app'}
        </p>

        {!useRecoveryCode ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Verification Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => handleCodeInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="000 000"
                maxLength={7}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl font-mono tracking-wider focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
                disabled={loading || attemptCount >= 5}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="trustDevice"
                checked={trustDevice}
                onChange={(e) => setTrustDevice(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="trustDevice" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Trust this device for 30 days
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Recovery Code
              </label>
              <input
                type="text"
                value={recoveryCodeInput}
                onChange={(e) => setRecoveryCodeInput(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                placeholder="XXXXXXXX"
                maxLength={8}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-xl font-mono tracking-wider focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-2">
                Enter the 8-character recovery code
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <button
          onClick={useRecoveryCode ? handleVerifyRecoveryCode : handleVerifyTOTP}
          disabled={loading || attemptCount >= 5 || (!useRecoveryCode && cleanTOTPCode(code).length !== 6) || (useRecoveryCode && recoveryCodeInput.length < 8)}
          className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>

        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setUseRecoveryCode(!useRecoveryCode);
              setError('');
              setCode('');
              setRecoveryCodeInput('');
            }}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {useRecoveryCode
              ? 'Use authenticator app instead'
              : 'Use a recovery code instead'}
          </button>
        </div>

        {onCancel && (
          <div className="mt-4 text-center">
            <button
              onClick={onCancel}
              className="text-sm text-gray-600 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Lost access to your authenticator app? Use a recovery code or contact your administrator for help.
          </p>
        </div>
      </div>
    </div>
  );
}
