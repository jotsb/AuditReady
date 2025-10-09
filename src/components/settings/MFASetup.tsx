import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Shield, Copy, Check, Smartphone, Key, ChevronRight, ChevronLeft } from 'lucide-react';
import { useMFA } from '../../hooks/useMFA';
import { useAuth } from '../../contexts/AuthContext';
import { RecoveryCodesDisplay } from './RecoveryCodesDisplay';
import { cleanTOTPCode, formatTOTPCode, copyToClipboard } from '../../lib/mfaUtils';

interface MFASetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function MFASetup({ onComplete, onCancel }: MFASetupProps) {
  const { user } = useAuth();
  const { enrollMFA, verifyEnrollment, generateAndStoreRecoveryCodes, loading } = useMFA();

  const [step, setStep] = useState(1);
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [factorId, setFactorId] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);

  useEffect(() => {
    if (step === 2 && !qrCode) {
      initializeEnrollment();
    }
  }, [step]);

  const initializeEnrollment = async () => {
    try {
      setError('');
      const data = await enrollMFA('Authenticator App');

      setFactorId(data.id);
      setSecret(data.totp.secret);

      const qrCodeDataUrl = await QRCode.toDataURL(data.totp.uri, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      setQrCode(qrCodeDataUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize MFA setup');
    }
  };

  const handleVerify = async () => {
    const cleaned = cleanTOTPCode(verificationCode);
    if (!cleaned || cleaned.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    try {
      setError('');
      const success = await verifyEnrollment(factorId, cleaned);

      if (success && user) {
        const codes = await generateAndStoreRecoveryCodes(user.id);
        setRecoveryCodes(codes);
        setStep(4);
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    }
  };

  const handleCopySecret = async () => {
    await copyToClipboard(secret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const handleCodeInput = (value: string) => {
    const cleaned = cleanTOTPCode(value);
    setVerificationCode(formatTOTPCode(cleaned));
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        {step !== 4 && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-600" />
                Enable Two-Factor Authentication
              </h2>
              <button
                onClick={onCancel}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-center mb-6">
              {[1, 2, 3].map((stepNum) => (
                <div key={stepNum} className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      step >= stepNum
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {stepNum}
                  </div>
                  {stepNum < 3 && (
                    <div
                      className={`h-1 w-16 ${
                        step > stepNum ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">What is Two-Factor Authentication?</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Two-factor authentication (2FA) adds an extra layer of security to your account.
                In addition to your password, you'll need to enter a 6-digit code from your
                authenticator app when signing in.
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Benefits:</h4>
              <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Protect your account from unauthorized access
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Meet security compliance requirements
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Peace of mind knowing your data is secure
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">You'll need:</h4>
              <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-gray-500" />
                  An authenticator app (Google Authenticator, Microsoft Authenticator, Authy, etc.)
                </li>
                <li className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-gray-500" />
                  A few minutes to complete the setup
                </li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
              >
                Get Started
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={onCancel}
                className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Scan QR Code</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Open your authenticator app and scan this QR code to add your account.
              </p>
            </div>

            {qrCode && (
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                  <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Can't scan the QR code? Enter this code manually:
              </p>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                <code className="flex-1 font-mono text-sm break-all">{secret}</code>
                <button
                  onClick={handleCopySecret}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
                  title="Copy secret key"
                >
                  {secretCopied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium flex items-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" />
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!qrCode || loading}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                Next: Verify
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Verify Setup</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Enter the 6-digit code from your authenticator app to verify the setup.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Verification Code
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => handleCodeInput(e.target.value)}
                placeholder="000 000"
                maxLength={7}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl font-mono tracking-wider"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                Enter the code as shown in your authenticator app
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium flex items-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" />
                Back
              </button>
              <button
                onClick={handleVerify}
                disabled={loading || cleanTOTPCode(verificationCode).length !== 6}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </button>
            </div>
          </div>
        )}

        {step === 4 && recoveryCodes.length > 0 && (
          <RecoveryCodesDisplay
            codes={recoveryCodes}
            onConfirm={onComplete}
          />
        )}
      </div>
    </div>
  );
}
