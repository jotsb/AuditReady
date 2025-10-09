import { logger } from './logger';

interface QueryOptions {
  operation: string;
  table: string;
  metadata?: Record<string, any>;
}

interface QueryResult<T = any> {
  data: T | null;
  error: any;
  executionTime: number;
}

const SLOW_QUERY_THRESHOLD_MS = 1000;
const VERY_SLOW_QUERY_THRESHOLD_MS = 3000;

export class DatabaseMonitor {
  static async monitorQuery<T>(
    queryPromise: Promise<{ data: T | null; error: any }>,
    options: QueryOptions
  ): Promise<QueryResult<T>> {
    const startTime = performance.now();

    try {
      const result = await queryPromise;
      const executionTime = performance.now() - startTime;

      if (result.error) {
        logger.error(`Database query failed: ${options.operation}`, result.error, {
          operation: options.operation,
          table: options.table,
          executionTime,
          errorCode: result.error.code,
          errorMessage: result.error.message,
          ...options.metadata
        });
      } else {
        if (executionTime > VERY_SLOW_QUERY_THRESHOLD_MS) {
          logger.warn(`Very slow query detected: ${options.operation}`, {
            operation: options.operation,
            table: options.table,
            executionTime,
            threshold: VERY_SLOW_QUERY_THRESHOLD_MS,
            category: 'PERFORMANCE',
            ...options.metadata
          }, 'PERFORMANCE');
        } else if (executionTime > SLOW_QUERY_THRESHOLD_MS) {
          logger.warn(`Slow query detected: ${options.operation}`, {
            operation: options.operation,
            table: options.table,
            executionTime,
            threshold: SLOW_QUERY_THRESHOLD_MS,
            category: 'PERFORMANCE',
            ...options.metadata
          }, 'PERFORMANCE');
        } else {
          logger.info(`Query completed: ${options.operation}`, {
            operation: options.operation,
            table: options.table,
            executionTime,
            ...options.metadata
          }, 'DATABASE');
        }
      }

      return {
        data: result.data,
        error: result.error,
        executionTime
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;

      logger.error(`Database query exception: ${options.operation}`, error as Error, {
        operation: options.operation,
        table: options.table,
        executionTime,
        ...options.metadata
      });

      return {
        data: null,
        error,
        executionTime
      };
    }
  }

  static logSlowQuery(operation: string, table: string, executionTime: number, metadata?: Record<string, any>): void {
    if (executionTime > VERY_SLOW_QUERY_THRESHOLD_MS) {
      logger.warn(`Very slow query: ${operation}`, {
        operation,
        table,
        executionTime,
        threshold: VERY_SLOW_QUERY_THRESHOLD_MS,
        severity: 'high',
        ...metadata
      }, 'PERFORMANCE');
    } else if (executionTime > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn(`Slow query: ${operation}`, {
        operation,
        table,
        executionTime,
        threshold: SLOW_QUERY_THRESHOLD_MS,
        severity: 'medium',
        ...metadata
      }, 'PERFORMANCE');
    }
  }

  static logQuerySuccess(operation: string, table: string, executionTime: number, metadata?: Record<string, any>): void {
    logger.performance(`Database query: ${operation}`, executionTime, {
      operation,
      table,
      ...metadata
    });
  }

  static logQueryError(operation: string, table: string, error: any, executionTime: number, metadata?: Record<string, any>): void {
    logger.error(`Database query failed: ${operation}`, error, {
      operation,
      table,
      executionTime,
      errorCode: error?.code,
      errorMessage: error?.message,
      ...metadata
    });
  }
}

export function monitorDatabaseQuery<T>(
  queryPromise: Promise<{ data: T | null; error: any }>,
  options: QueryOptions
): Promise<QueryResult<T>> {
  return DatabaseMonitor.monitorQuery(queryPromise, options);
}

export function createQueryMonitor(defaultTable: string) {
  return {
    monitor: <T>(
      queryPromise: Promise<{ data: T | null; error: any }>,
      operation: string,
      metadata?: Record<string, any>
    ): Promise<QueryResult<T>> => {
      return DatabaseMonitor.monitorQuery(queryPromise, {
        operation,
        table: defaultTable,
        metadata
      });
    },

    logSuccess: (operation: string, executionTime: number, metadata?: Record<string, any>): void => {
      DatabaseMonitor.logQuerySuccess(operation, defaultTable, executionTime, metadata);
    },

    logError: (operation: string, error: any, executionTime: number, metadata?: Record<string, any>): void => {
      DatabaseMonitor.logQueryError(operation, defaultTable, error, executionTime, metadata);
    },

    logSlowQuery: (operation: string, executionTime: number, metadata?: Record<string, any>): void => {
      DatabaseMonitor.logSlowQuery(operation, defaultTable, executionTime, metadata);
    }
  };
}

export const QUERY_THRESHOLDS = {
  SLOW: SLOW_QUERY_THRESHOLD_MS,
  VERY_SLOW: VERY_SLOW_QUERY_THRESHOLD_MS
};
