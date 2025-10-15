import * as Sentry from '@sentry/react';

export function initSentry() {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

  if (!sentryDsn) {
    console.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  console.log('Initializing Sentry with DSN:', sentryDsn.substring(0, 30) + '...');
  console.log('Environment:', import.meta.env.MODE);

  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE || 'development',

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,

    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    beforeSend(event, hint) {
      const error = hint.originalException;

      if (error instanceof Error) {
        if (error.message.includes('ResizeObserver loop')) {
          return null;
        }

        if (error.message.includes('Non-Error promise rejection')) {
          return null;
        }
      }

      if (event.request?.url) {
        const url = new URL(event.request.url);
        url.searchParams.delete('token');
        url.searchParams.delete('key');
        url.searchParams.delete('password');
        event.request.url = url.toString();
      }

      return event;
    },

    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      'Network request failed',
      'Failed to fetch',
      'NetworkError',
      'AbortError',
    ],
  });
}

export function captureException(error: Error, context?: Record<string, any>) {
  console.error('Sentry capturing exception:', error, context);

  Sentry.captureException(error, {
    extra: context,
  });
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>) {
  console.log(`Sentry capturing message [${level}]:`, message, context);

  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

export function setUserContext(user: { id: string; email?: string; fullName?: string } | null) {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.fullName,
    });
  } else {
    Sentry.setUser(null);
  }
}

export { Sentry };
