import { AlertCircle, X } from 'lucide-react';

interface ErrorAlertProps {
  message: string | null;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorAlert({ message, onDismiss, className = '' }: ErrorAlertProps) {
  if (!message) return null;

  return (
    <div className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-red-800 dark:text-red-200">
            {message}
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
