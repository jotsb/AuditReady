import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

interface RealtimeInvalidationOptions {
  table: string;
  queryKeys: string[][];
  filter?: string;
  enabled?: boolean;
}

export function useRealtimeInvalidation({ table, queryKeys, filter, enabled = true }: RealtimeInvalidationOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channelName = `realtime-invalidation-${table}-${filter || 'all'}`;

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        () => {
          queryKeys.forEach(key => {
            queryClient.invalidateQueries({ queryKey: key });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, enabled, queryClient, ...queryKeys.map(k => k.join(','))]);
}
