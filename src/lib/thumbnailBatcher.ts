import { supabase } from './supabase';
import { createRequestBatcher } from './requestBatcher';

const urlCache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_TTL_MS = 50 * 60 * 1000;

async function batchLoadThumbnails(paths: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const now = Date.now();

  const uncachedPaths: string[] = [];
  for (const path of paths) {
    const cached = urlCache.get(path);
    if (cached && cached.expiresAt > now) {
      results.set(path, cached.url);
    } else {
      uncachedPaths.push(path);
    }
  }

  if (uncachedPaths.length === 0) return results;

  try {
    const { data, error } = await supabase.storage
      .from('receipts')
      .createSignedUrls(uncachedPaths, 3600);

    if (!error && data) {
      for (const item of data) {
        if (item.signedUrl && item.path) {
          results.set(item.path, item.signedUrl);
          urlCache.set(item.path, {
            url: item.signedUrl,
            expiresAt: now + CACHE_TTL_MS
          });
        }
      }
    }
  } catch (error) {
    console.error('Error batch loading thumbnails:', error);
  }

  return results;
}

export const loadThumbnailUrl = createRequestBatcher(batchLoadThumbnails, 30);
