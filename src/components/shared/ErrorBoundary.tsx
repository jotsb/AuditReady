import React from 'react';
import { logger } from '../../lib/logger';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.critical('React component error', error, {
      componentStack: errorInfo.componentStack,
      boundary: this.props.name || 'unknown',
      errorMessage: error.message,
      errorStack: error.stack,
      location: window.location.pathname
    });

    this.setState({
      error,
      errorInfo
    });
  }

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });

    logger.info('Error boundary reset', {
      boundary: this.props.name || 'unknown',
      location: window.location.pathname
    }, 'USER_ACTION');
  };

  private handleReload = (): void => {
    logger.info('User reloading page after error', {
      boundary: this.props.name || 'unknown',
      location: window.location.pathname
    }, 'USER_ACTION');

    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
            <div className="flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-2">
              Something went wrong
            </h2>

            <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
              We've logged the error and will look into it. You can try refreshing the page or going back to continue.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-auto max-h-48">
                <p className="text-sm font-mono text-red-600 dark:text-red-400 break-all">
                  {this.state.error.message}
                </p>
                {this.state.error.stack && (
                  <pre className="text-xs text-gray-600 dark:text-gray-400 mt-2 whitespace-pre-wrap">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Refresh Page
              </button>
            </div>

            <div className="mt-4 text-center">
              <a
                href="/"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                onClick={() => {
                  logger.info('User navigating to home after error', {
                    boundary: this.props.name || 'unknown'
                  }, 'USER_ACTION');
                }}
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
