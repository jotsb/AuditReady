import { supabase } from './supabase';
import { sessionManager } from './sessionManager';
import { captureException, captureMessage } from './sentry';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
type LogCategory = 'AUTH' | 'DATABASE' | 'API' | 'EDGE_FUNCTION' | 'CLIENT_ERROR' | 'SECURITY' | 'PERFORMANCE' | 'USER_ACTION' | 'PAGE_VIEW' | 'NAVIGATION';

interface LogOptions {
  level: LogLevel;
  category: LogCategory;
  message: string;
  metadata?: Record<string, any>;
  stackTrace?: string;
  executionTimeMs?: number;
}

class Logger {
  private async sendToServer(options: LogOptions): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const sessionId = sessionManager.getSessionId();

      await supabase.rpc('log_system_event', {
        p_level: options.level,
        p_category: options.category,
        p_message: options.message,
        p_metadata: options.metadata || {},
        p_user_id: user?.id || null,
        p_session_id: sessionId,
        p_ip_address: null,
        p_user_agent: navigator.userAgent,
        p_stack_trace: options.stackTrace || null,
        p_execution_time_ms: options.executionTimeMs || null
      });
    } catch (error) {
      // Silently fail if logging fails - don't interrupt app flow
      console.error('Failed to send log to server:', error);
    }
  }

  debug(message: string, metadata?: Record<string, any>, category: LogCategory = 'CLIENT_ERROR'): void {
    console.debug(message, metadata);
    this.sendToServer({ level: 'DEBUG', category, message, metadata });
  }

  info(message: string, metadata?: Record<string, any>, category: LogCategory = 'CLIENT_ERROR'): void {
    console.info(message, metadata);
    this.sendToServer({ level: 'INFO', category, message, metadata });
  }

  warn(message: string, metadata?: Record<string, any>, category: LogCategory = 'CLIENT_ERROR'): void {
    console.warn(message, metadata);
    this.sendToServer({ level: 'WARN', category, message, metadata });

    // Only send warnings to Sentry in production if they're critical
    if (import.meta.env.MODE === 'production' && category === 'SECURITY') {
      captureMessage(message, 'warning', metadata);
    }
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    console.error(message, error, metadata);

    if (error) {
      captureException(error, { message, ...metadata });
    } else {
      captureMessage(message, 'error', metadata);
    }

    this.sendToServer({
      level: 'ERROR',
      category: 'CLIENT_ERROR',
      message,
      metadata: { ...metadata, error: error?.message },
      stackTrace: error?.stack
    });
  }

  critical(message: string, error?: Error, metadata?: Record<string, any>): void {
    console.error('[CRITICAL]', message, error, metadata);

    // Send critical errors to Sentry
    if (error) {
      captureException(error, { message, severity: 'critical', ...metadata });
    } else {
      captureMessage(message, 'fatal', metadata);
    }

    this.sendToServer({
      level: 'CRITICAL',
      category: 'CLIENT_ERROR',
      message,
      metadata: { ...metadata, error: error?.message },
      stackTrace: error?.stack
    });
  }

  performance(operation: string, executionTimeMs: number, metadata?: Record<string, any>): void {
    const level = executionTimeMs > 5000 ? 'WARN' : 'INFO';
    this.sendToServer({
      level,
      category: 'PERFORMANCE',
      message: `${operation} took ${executionTimeMs}ms`,
      metadata: { ...metadata, operation },
      executionTimeMs
    });
  }

  auth(eventType: string, success: boolean, metadata?: Record<string, any>): void {
    const level = success ? 'INFO' : 'WARN';
    this.sendToServer({
      level,
      category: 'AUTH',
      message: `Authentication event: ${eventType}`,
      metadata: { ...metadata, eventType, success }
    });
  }

  security(eventType: string, severity: LogLevel, metadata?: Record<string, any>): void {
    this.sendToServer({
      level: severity,
      category: 'SECURITY',
      message: `Security event: ${eventType}`,
      metadata: { ...metadata, eventType }
    });
  }

  pageView(pageName: string, metadata?: Record<string, any>): void {
    this.sendToServer({
      level: 'INFO',
      category: 'PAGE_VIEW',
      message: `Page view: ${pageName}`,
      metadata: { ...metadata, pageName, path: window.location.pathname }
    });
  }

  userAction(action: string, target: string, metadata?: Record<string, any>): void {
    this.sendToServer({
      level: 'INFO',
      category: 'USER_ACTION',
      message: `User action: ${action} on ${target}`,
      metadata: { ...metadata, action, target }
    });
  }

  navigation(from: string, to: string, metadata?: Record<string, any>): void {
    this.sendToServer({
      level: 'DEBUG',
      category: 'NAVIGATION',
      message: `Navigation: ${from} → ${to}`,
      metadata: { ...metadata, from, to }
    });
  }

  formSubmit(formName: string, data: Record<string, any>, metadata?: Record<string, any>): void {
    this.sendToServer({
      level: 'INFO',
      category: 'USER_ACTION',
      message: `Form submitted: ${formName}`,
      metadata: { ...metadata, formName, formData: data }
    });
  }

  dataLoad(resourceType: string, count: number, filters?: Record<string, any>): void {
    // Removed - excessive DEBUG logging of successful data loads
    // Only log data load failures via error() method
  }

  database(operation: string, table: string, success: boolean, metadata?: Record<string, any>): void {
    const level = success ? 'INFO' : 'ERROR';
    this.sendToServer({
      level,
      category: 'DATABASE',
      message: `Database ${operation} on ${table}: ${success ? 'success' : 'failed'}`,
      metadata: { ...metadata, operation, table, success }
    });
  }

  api(endpoint: string, method: string, statusCode: number, metadata?: Record<string, any>): void {
    const level = statusCode >= 400 ? 'ERROR' : statusCode >= 300 ? 'WARN' : 'INFO';
    this.sendToServer({
      level,
      category: 'API',
      message: `API ${method} ${endpoint} - ${statusCode}`,
      metadata: { ...metadata, endpoint, method, statusCode }
    });
  }

  edgeFunction(functionName: string, success: boolean, metadata?: Record<string, any>): void {
    const level = success ? 'INFO' : 'ERROR';
    this.sendToServer({
      level,
      category: 'EDGE_FUNCTION',
      message: `Edge function ${functionName}: ${success ? 'success' : 'failed'}`,
      metadata: { ...metadata, functionName, success }
    });
  }

  trace(message: string, metadata?: Record<string, any>): void {
    console.trace(message, metadata);
    this.sendToServer({ level: 'DEBUG', category: 'CLIENT_ERROR', message, metadata });
  }

  async mfa(action: string, details: Record<string, any>, level: LogLevel = 'INFO'): Promise<void> {
    await this.sendToServer({
      level,
      category: 'SECURITY',
      message: `MFA: ${action}`,
      metadata: { ...details, mfa_action: action }
    });

    const auditActions = [
      'enable_mfa',
      'disable_mfa',
      'admin_reset_mfa',
      'recovery_code_used',
      'regenerate_recovery_codes',
      'mfa_verification_failed_multiple'
    ];

    if (auditActions.includes(action)) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from('audit_logs').insert({
          action,
          actor_id: user.id,
          resource_type: 'profile',
          resource_id: details.target_user_id || user.id,
          details: details,
          status: details.status || 'success'
        });
      } catch (error) {
        console.error('Failed to log MFA audit event:', error);
      }
    }
  }
}

export const logger = new Logger();

// Global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logger.error('Unhandled JavaScript error', event.error, {
      errorMessage: event.message,
      errorType: event.error?.name || 'Error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      userAgent: navigator.userAgent,
      url: window.location.href
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const errorMessage = reason?.message || String(reason);
    const errorType = reason?.name || typeof reason;

    logger.error('Unhandled promise rejection', reason instanceof Error ? reason : undefined, {
      errorMessage,
      errorType,
      reason: String(reason),
      url: window.location.href,
      userAgent: navigator.userAgent
    });
  });
}
