import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

interface Collection {
  id: string;
  name: string;
  business_id: string;
  businesses?: {
    name: string;
  };
}

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collections')
        .select(`
          *,
          businesses(name)
        `)
        .order('name');

      if (error) {
        logger.error('Error fetching collections', error, { hook: 'useCollections' });
        throw error;
      }

      return data as Collection[];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - collections don't change often
  });
}

export function useBusinessCollections(businessId: string | undefined) {
  return useQuery({
    queryKey: ['collections', 'business', businessId],
    queryFn: async () => {
      if (!businessId) throw new Error('Business ID is required');

      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('business_id', businessId)
        .order('name');

      if (error) {
        logger.error('Error fetching business collections', error, {
          hook: 'useBusinessCollections',
          businessId
        });
        throw error;
      }

      return data;
    },
    enabled: !!businessId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (collection: { name: string; business_id: string }) => {
      const { data, error } = await supabase
        .from('collections')
        .insert(collection)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

export function useUpdateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Collection> }) => {
      const { error } = await supabase
        .from('collections')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}
