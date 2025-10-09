import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { generateRecoveryCodes, hashRecoveryCode, createTrustedDevice, isDeviceTrusted, type TrustedDevice } from '../lib/mfaUtils';
import { logger } from '../lib/logger';

// Helper to create audit log entries
const createAuditLog = async (action: string, details: Record<string, unknown> = {}) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action,
    resource_type: 'mfa',
    resource_id: user.id,
    details,
  });
};

interface MFAFactor {
  id: string;
  friendly_name: string;
  factor_type: 'totp';
  status: 'verified' | 'unverified';
  created_at: string;
  updated_at: string;
  totp?: {
    qr_code: string;
    secret: string;
    uri: string;
  };
}

interface Challenge {
  id: string;
  expires_at: number;
}

export function useMFA() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enrollMFA = useCallback(async (friendlyName: string = 'Authenticator App') => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName
      });

      if (enrollError) throw enrollError;

      await logger.mfa('mfa_enrollment_started', {
        friendly_name: friendlyName
      });

      await createAuditLog('mfa_enrollment_started', {
        friendly_name: friendlyName,
        factor_type: 'totp'
      });

      return data as { id: string; type: 'totp'; totp: { qr_code: string; secret: string; uri: string } };
    } catch (err: any) {
      const message = err.message || 'Failed to enroll MFA';
      setError(message);
      await logger.mfa('mfa_enrollment_failed', { error: message }, 'ERROR');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyEnrollment = useCallback(async (factorId: string, code: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code
      });

      if (verify.error) throw verify.error;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      await supabase
        .from('profiles')
        .update({
          mfa_enabled: true,
          mfa_method: 'authenticator'
        })
        .eq('id', user.id);

      await logger.mfa('enable_mfa', {
        mfa_method: 'authenticator',
        factor_id: factorId
      });

      await createAuditLog('enable_mfa', {
        mfa_method: 'authenticator',
        factor_id: factorId,
        verification_method: 'totp'
      });

      return true;
    } catch (err: any) {
      const message = err.message || 'Failed to verify MFA code';
      setError(message);
      await logger.mfa('mfa_verification_failed', { error: message }, 'WARN');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const generateAndStoreRecoveryCodes = useCallback(async (userId: string): Promise<string[]> => {
    try {
      setLoading(true);
      setError(null);

      const codes = generateRecoveryCodes(10);

      const hashedCodes = await Promise.all(
        codes.map(async (code) => ({
          user_id: userId,
          code_hash: await hashRecoveryCode(code),
          used: false
        }))
      );

      const { error: insertError } = await supabase
        .from('recovery_codes')
        .insert(hashedCodes);

      if (insertError) throw insertError;

      await logger.mfa('generate_recovery_codes', {
        count: codes.length
      });

      await createAuditLog('generate_recovery_codes', {
        count: codes.length,
        action_type: 'created'
      });

      return codes;
    } catch (err: any) {
      const message = err.message || 'Failed to generate recovery codes';
      setError(message);
      await logger.mfa('generate_recovery_codes_failed', { error: message }, 'ERROR');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const regenerateRecoveryCodes = useCallback(async (userId: string): Promise<string[]> => {
    try {
      setLoading(true);
      setError(null);

      // Delete all existing codes (both used and unused)
      const { error: deleteError } = await supabase
        .from('recovery_codes')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Generate new codes
      const codes = generateRecoveryCodes(10);

      const hashedCodes = await Promise.all(
        codes.map(async (code) => ({
          user_id: userId,
          code_hash: await hashRecoveryCode(code),
          used: false
        }))
      );

      const { error: insertError } = await supabase
        .from('recovery_codes')
        .insert(hashedCodes);

      if (insertError) throw insertError;

      await logger.mfa('regenerate_recovery_codes', {
        count: codes.length,
        action_type: 'regenerated'
      });

      await createAuditLog('regenerate_recovery_codes', {
        count: codes.length,
        action_type: 'regenerated',
        old_codes_deleted: true
      });

      return codes;
    } catch (err: any) {
      const message = err.message || 'Failed to regenerate recovery codes';
      setError(message);
      await logger.mfa('regenerate_recovery_codes_failed', { error: message }, 'ERROR');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const listFactors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;

      return data.totp || [];
    } catch (err: any) {
      const message = err.message || 'Failed to list MFA factors';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const challengeFactor = useCallback(async (factorId: string): Promise<Challenge> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      return data as Challenge;
    } catch (err: any) {
      const message = err.message || 'Failed to create MFA challenge';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyChallenge = useCallback(async (
    factorId: string,
    challengeId: string,
    code: string
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code
      });

      if (verifyError) {
        await logger.mfa('mfa_verification_failed', {
          factor_id: factorId,
          error: verifyError.message
        }, 'WARN');
        throw verifyError;
      }

      await logger.mfa('mfa_verification_success', {
        factor_id: factorId,
        method: 'totp'
      });

      return true;
    } catch (err: any) {
      const message = err.message || 'Invalid verification code';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const unenrollFactor = useCallback(async (factorId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollError) throw unenrollError;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      await supabase
        .from('profiles')
        .update({
          mfa_enabled: false,
          mfa_method: null,
          trusted_devices: null
        })
        .eq('id', user.id);

      await supabase
        .from('recovery_codes')
        .delete()
        .eq('user_id', user.id);

      await logger.mfa('disable_mfa', {
        factor_id: factorId,
        reason: 'user_requested'
      }, 'WARN');

      await createAuditLog('disable_mfa', {
        factor_id: factorId,
        reason: 'user_requested',
        recovery_codes_deleted: true
      });
    } catch (err: any) {
      const message = err.message || 'Failed to unenroll MFA';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getAssuranceLevel = useCallback(async (): Promise<'aal1' | 'aal2' | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.aal || null;
    } catch (err) {
      return null;
    }
  }, []);

  const addTrustedDevice = useCallback(async (userId: string, durationDays: number = 30): Promise<string> => {
    try {
      setLoading(true);
      setError(null);

      const device = createTrustedDevice(durationDays);

      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('trusted_devices')
        .eq('id', userId)
        .single();

      if (fetchError) throw fetchError;

      const existingDevices = (profile.trusted_devices as TrustedDevice[]) || [];
      const validDevices = existingDevices.filter(d => new Date(d.expires_at) > new Date());
      const updatedDevices = [...validDevices, device];

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ trusted_devices: updatedDevices })
        .eq('id', userId);

      if (updateError) throw updateError;

      localStorage.setItem('mfa_device_id', device.id);

      await logger.mfa('add_trusted_device', {
        device_name: device.name,
        device_id: device.id,
        expires_at: device.expires_at
      });

      await createAuditLog('add_trusted_device', {
        device_name: device.name,
        device_id: device.id,
        expires_at: device.expires_at
      });

      return device.id;
    } catch (err: any) {
      const message = err.message || 'Failed to add trusted device';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkTrustedDevice = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const deviceId = localStorage.getItem('mfa_device_id');
      if (!deviceId) return false;

      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('trusted_devices')
        .eq('id', userId)
        .single();

      if (fetchError) throw fetchError;

      return isDeviceTrusted(profile.trusted_devices, deviceId);
    } catch (err) {
      return false;
    }
  }, []);

  const removeTrustedDevice = useCallback(async (userId: string, deviceId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('trusted_devices')
        .eq('id', userId)
        .single();

      if (fetchError) throw fetchError;

      const existingDevices = (profile.trusted_devices as TrustedDevice[]) || [];
      const updatedDevices = existingDevices.filter(d => d.id !== deviceId);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ trusted_devices: updatedDevices })
        .eq('id', userId);

      if (updateError) throw updateError;

      if (localStorage.getItem('mfa_device_id') === deviceId) {
        localStorage.removeItem('mfa_device_id');
      }

      await logger.mfa('remove_trusted_device', {
        device_id: deviceId
      });

      await createAuditLog('remove_trusted_device', {
        device_id: deviceId
      });
    } catch (err: any) {
      const message = err.message || 'Failed to remove trusted device';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    enrollMFA,
    verifyEnrollment,
    generateAndStoreRecoveryCodes,
    regenerateRecoveryCodes,
    listFactors,
    challengeFactor,
    verifyChallenge,
    unenrollFactor,
    getAssuranceLevel,
    addTrustedDevice,
    checkTrustedDevice,
    removeTrustedDevice
  };
}
