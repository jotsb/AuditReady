import { useEffect, useRef } from 'react';
import { logger } from '../lib/logger';

export function usePageTracking(pageName: string, metadata?: Record<string, any>) {
  const startTime = useRef<number>(Date.now());
  const hasLogged = useRef(false);

  useEffect(() => {
    if (!hasLogged.current) {
      startTime.current = Date.now();
      hasLogged.current = true;
    }

    return () => {
      const timeSpent = Date.now() - startTime.current;
      // Only log if page view was meaningful (>1s) and include duration in the page view log
      if (timeSpent > 1000) {
        logger.pageView(pageName, {
          ...metadata,
          duration_ms: timeSpent,
        });

        // Only log performance warning if slow (>5s)
        if (timeSpent > 5000) {
          logger.performance(`Page view duration: ${pageName}`, timeSpent, {
            ...metadata,
            pageName,
          });
        }
      }
    };
  }, [pageName, metadata]);
}

export function useDataLoadTracking(resourceType: string) {
  return (count: number, filters?: Record<string, any>) => {
    logger.dataLoad(resourceType, count, filters);
  };
}
