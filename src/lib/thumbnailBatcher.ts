import { supabase } from './supabase';
import { createRequestBatcher } from './requestBatcher';

async function batchLoadThumbnails(paths: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  const promises = paths.map(async (path) => {
    try {
      const { data, error } = await supabase.storage
        .from('receipts')
        .createSignedUrl(path, 3600);

      if (!error && data?.signedUrl) {
        results.set(path, data.signedUrl);
      }
    } catch (error) {
      console.error(`Error loading thumbnail for ${path}:`, error);
    }
  });

  await Promise.all(promises);
  return results;
}

export const loadThumbnailUrl = createRequestBatcher(batchLoadThumbnails, 100);
