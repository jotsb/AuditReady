export function generateRecoveryCodes(count: number = 10): string[] {
  const codes: string[] = [];
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  for (let i = 0; i < count; i++) {
    let code = '';
    for (let j = 0; j < 8; j++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    codes.push(code);
  }

  return codes;
}

export async function hashRecoveryCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code.toUpperCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function verifyRecoveryCode(code: string, hash: string): Promise<boolean> {
  try {
    const codeHash = await hashRecoveryCode(code);
    return codeHash === hash;
  } catch (error) {
    console.error('Error verifying recovery code:', error);
    return false;
  }
}

export function generateDeviceFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}`,
    new Date().getTimezoneOffset().toString(),
    navigator.hardwareConcurrency?.toString() || 'unknown',
  ];

  const fingerprint = components.join('|');
  return btoa(fingerprint).slice(0, 32);
}

export function getDeviceName(): string {
  const ua = navigator.userAgent;

  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';

  if (ua.includes('Mac')) return 'Mac';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';

  return 'Unknown Device';
}

export interface TrustedDevice {
  id: string;
  name: string;
  fingerprint: string;
  added_at: string;
  expires_at: string;
  last_used: string;
}

export function createTrustedDevice(durationDays: number = 30): TrustedDevice {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  return {
    id: crypto.randomUUID(),
    name: getDeviceName(),
    fingerprint: generateDeviceFingerprint(),
    added_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    last_used: now.toISOString()
  };
}

export function isDeviceTrusted(devices: TrustedDevice[] | null, deviceId: string | null): boolean {
  if (!devices || !deviceId) return false;

  const device = devices.find(d => d.id === deviceId);
  if (!device) return false;

  const now = new Date();
  const expiresAt = new Date(device.expires_at);

  return expiresAt > now;
}

export function formatRecoveryCode(code: string): string {
  return code.toUpperCase().trim();
}

export function downloadRecoveryCodes(codes: string[], filename: string = 'recovery-codes.txt'): void {
  const content = [
    'AuditReady - Multi-Factor Authentication Recovery Codes',
    '========================================================',
    '',
    'IMPORTANT: Keep these codes safe and secure!',
    '- Each code can only be used once',
    '- Use these codes if you lose access to your authenticator app',
    '- Generate new codes if you use all of them',
    '',
    'Your Recovery Codes:',
    '-------------------',
    ...codes.map((code, i) => `${(i + 1).toString().padStart(2, '0')}. ${code}`),
    '',
    `Generated: ${new Date().toLocaleString()}`,
    'Expires: 1 year from generation date',
    '',
    'Store these codes in a safe place such as:',
    '- A password manager',
    '- A secure note on your device',
    '- A printed copy in a safe location'
  ].join('\n');

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);

  return Promise.resolve();
}

export function formatTOTPCode(code: string): string {
  const cleaned = code.replace(/\D/g, '');
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)}`;
}

export function cleanTOTPCode(code: string): string {
  return code.replace(/\D/g, '').slice(0, 6);
}
