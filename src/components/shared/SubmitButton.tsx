import { Loader2 } from 'lucide-react';
import { ButtonHTMLAttributes, ReactNode, memo } from 'react';

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: ReactNode;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  fullWidth?: boolean;
}

function SubmitButtonComponent({
  loading = false,
  children,
  loadingText = 'Loading...',
  variant = 'primary',
  fullWidth = true,
  className = '',
  disabled,
  ...props
}: SubmitButtonProps) {
  const baseClasses = 'font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';

  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${widthClass} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-5 h-5 animate-spin" />}
      {loading ? loadingText : children}
    </button>
  );
}

export const SubmitButton = memo(SubmitButtonComponent);
