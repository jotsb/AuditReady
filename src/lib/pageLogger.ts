import { logger } from './logger';

export interface PageLoadOptions {
  page: string;
  metadata?: Record<string, any>;
}

export interface DataLoadOptions {
  page: string;
  operation: string;
  table?: string;
  metadata?: Record<string, any>;
}

export interface ErrorOptions {
  page: string;
  operation: string;
  error: any;
  metadata?: Record<string, any>;
}

export class PageLogger {
  private startTime: number;
  private pageName: string;

  constructor(pageName: string) {
    this.pageName = pageName;
    this.startTime = performance.now();

    logger.info(`Page loaded: ${pageName}`, {
      page: pageName,
      path: window.location.pathname,
      search: window.location.search
    }, 'PAGE_VIEW');
  }

  logDataLoad(options: Omit<DataLoadOptions, 'page'>): void {
    logger.info(`Data load: ${options.operation}`, {
      page: this.pageName,
      operation: options.operation,
      table: options.table,
      ...options.metadata
    }, 'DATABASE');
  }

  logDataLoadSuccess(options: Omit<DataLoadOptions, 'page'> & { count?: number }): void {
    const loadTime = performance.now() - this.startTime;

    logger.performance(`${options.operation} completed`, loadTime, {
      page: this.pageName,
      operation: options.operation,
      table: options.table,
      itemCount: options.count,
      ...options.metadata
    });
  }

  logError(options: Omit<ErrorOptions, 'page'>): void {
    const error = options.error;
    const errorMessage = error?.message || 'Unknown error';
    const errorCode = error?.code || error?.status || 'UNKNOWN';

    logger.error(`${options.operation} failed`, error, {
      page: this.pageName,
      operation: options.operation,
      errorCode,
      errorMessage,
      ...options.metadata
    });
  }

  logUserAction(action: string, target: string, metadata?: Record<string, any>): void {
    logger.userAction(action, target, {
      page: this.pageName,
      ...metadata
    });
  }

  logWarning(message: string, metadata?: Record<string, any>): void {
    logger.warn(message, {
      page: this.pageName,
      ...metadata
    }, 'CLIENT_ERROR');
  }

  logInfo(message: string, metadata?: Record<string, any>): void {
    logger.info(message, {
      page: this.pageName,
      ...metadata
    }, 'USER_ACTION');
  }

  getPageLoadTime(): number {
    return performance.now() - this.startTime;
  }
}

export function usePageLogger(pageName: string): PageLogger {
  return new PageLogger(pageName);
}
