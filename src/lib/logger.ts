import { supabase } from './supabase';
import { sessionManager } from './sessionManager';

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

  debug(message: string, metadata?: Record<string, any>): void {
    console.debug(message, metadata);
    this.sendToServer({ level: 'DEBUG', category: 'CLIENT_ERROR', message, metadata });
  }

  info(message: string, metadata?: Record<string, any>): void {
    console.info(message, metadata);
    this.sendToServer({ level: 'INFO', category: 'CLIENT_ERROR', message, metadata });
  }

  warn(message: string, metadata?: Record<string, any>): void {
    console.warn(message, metadata);
    this.sendToServer({ level: 'WARN', category: 'CLIENT_ERROR', message, metadata });
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    console.error(message, error, metadata);
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
    this.sendToServer({
      level: 'DEBUG',
      category: 'PAGE_VIEW',
      message: `Data loaded: ${count} ${resourceType}`,
      metadata: { resourceType, count, filters: filters || {} }
    });
  }
}

export const logger = new Logger();

// Global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logger.error('Unhandled error', event.error, {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', event.reason, {
      promise: 'Promise rejection'
    });
  });
}
