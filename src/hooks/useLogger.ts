import { useCallback } from 'react';
import { logger } from '../lib/logger';

export function useLogger() {
  const logError = useCallback((message: string, error?: Error, metadata?: Record<string, any>) => {
    logger.error(message, error, metadata);
  }, []);

  const logInfo = useCallback((message: string, metadata?: Record<string, any>) => {
    logger.info(message, metadata);
  }, []);

  const logWarning = useCallback((message: string, metadata?: Record<string, any>) => {
    logger.warn(message, metadata);
  }, []);

  const logPerformance = useCallback((operation: string, executionTimeMs: number, metadata?: Record<string, any>) => {
    logger.performance(operation, executionTimeMs, metadata);
  }, []);

  const logAuth = useCallback((eventType: string, success: boolean, metadata?: Record<string, any>) => {
    logger.auth(eventType, success, metadata);
  }, []);

  const logSecurity = useCallback((eventType: string, severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL', metadata?: Record<string, any>) => {
    logger.security(eventType, severity, metadata);
  }, []);

  return {
    logError,
    logInfo,
    logWarning,
    logPerformance,
    logAuth,
    logSecurity
  };
}
