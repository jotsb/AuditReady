const COMMON_PASSWORDS = [
  'password', 'password123', '12345678', '123456789', '1234567890',
  'qwerty', 'qwerty123', 'abc123', 'abcd1234', 'password1',
  'letmein', 'welcome', 'monkey', 'dragon', 'master',
  'sunshine', 'princess', 'football', 'baseball', 'shadow',
  'admin', 'admin123', 'root', 'test', 'test123',
  'user', 'pass', 'demo', 'guest', 'login',
  '111111', '123123', '696969', '000000', '121212'
];

export interface PasswordStrength {
  score: number;
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  color: string;
  bgColor: string;
  suggestions: string[];
}

export function checkPasswordStrength(password: string): PasswordStrength {
  let score = 0;
  const suggestions: string[] = [];

  if (password.length === 0) {
    return {
      score: 0,
      label: 'Weak',
      color: 'text-red-600',
      bgColor: 'bg-red-500',
      suggestions: ['Enter a password']
    };
  }

  if (password.length >= 8) {
    score += 1;
  } else {
    suggestions.push('Use at least 8 characters');
  }

  if (password.length >= 12) {
    score += 1;
  } else if (password.length >= 8) {
    suggestions.push('Use 12+ characters for better security');
  }

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score += 1;
  } else {
    suggestions.push('Include both uppercase and lowercase letters');
  }

  if (/\d/.test(password)) {
    score += 1;
  } else {
    suggestions.push('Include at least one number');
  }

  if (/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\\/`~]/.test(password)) {
    score += 1;
  } else {
    suggestions.push('Include special characters (!@#$%^&*)');
  }

  const lowerPassword = password.toLowerCase();
  if (COMMON_PASSWORDS.includes(lowerPassword)) {
    score = Math.max(0, score - 2);
    suggestions.unshift('This is a commonly used password - choose something unique');
  }

  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 1);
    suggestions.push('Avoid repeated characters');
  }

  if (/^[0-9]+$/.test(password)) {
    score = Math.max(0, score - 1);
    suggestions.push('Avoid using only numbers');
  }

  const strengthMap: Record<number, PasswordStrength> = {
    0: { score: 0, label: 'Weak', color: 'text-red-600', bgColor: 'bg-red-500', suggestions },
    1: { score: 1, label: 'Weak', color: 'text-red-600', bgColor: 'bg-red-500', suggestions },
    2: { score: 2, label: 'Fair', color: 'text-orange-600', bgColor: 'bg-orange-500', suggestions },
    3: { score: 3, label: 'Good', color: 'text-yellow-600', bgColor: 'bg-yellow-500', suggestions },
    4: { score: 4, label: 'Strong', color: 'text-green-600', bgColor: 'bg-green-500', suggestions },
    5: { score: 5, label: 'Strong', color: 'text-green-600', bgColor: 'bg-green-500', suggestions },
  };

  return strengthMap[Math.min(score, 5)];
}

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.includes(password.toLowerCase());
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }

  if (isCommonPassword(password)) {
    return { valid: false, error: 'This password is too common. Please choose a more secure password' };
  }

  return { valid: true };
}
