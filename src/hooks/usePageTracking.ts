import { useEffect, useRef } from 'react';
import { logger } from '../lib/logger';

export function usePageTracking(pageName: string, metadata?: Record<string, any>) {
  const startTime = useRef<number>(Date.now());
  const hasLogged = useRef(false);

  useEffect(() => {
    if (!hasLogged.current) {
      startTime.current = Date.now();
      logger.pageView(pageName, metadata);
      hasLogged.current = true;
    }

    return () => {
      const timeSpent = Date.now() - startTime.current;
      if (timeSpent > 1000) {
        logger.performance(`Page view duration: ${pageName}`, timeSpent, {
          ...metadata,
          pageName,
        });
      }
    };
  }, [pageName, metadata]);
}

export function useDataLoadTracking(resourceType: string) {
  return (count: number, filters?: Record<string, any>) => {
    logger.dataLoad(resourceType, count, filters);
  };
}
