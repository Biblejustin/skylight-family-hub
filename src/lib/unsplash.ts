import { getSecret } from '@/lib/secrets';
import { fetchWithTimeout } from '@/lib/api-utils';

export const UNSPLASH_API = 'https://api.unsplash.com';

/**
 * Resolve the Unsplash access key from the secrets store.
 */
export async function getUnsplashAccessKey(): Promise<string | null> {
  return await getSecret('unsplash_access_key');
}

/**
 * Trigger Unsplash download tracking (required by Unsplash API guidelines).
 * Fires and forgets — errors are silently ignored.
 */
export function trackDownload(downloadUrl: string, accessKey: string): void {
  fetchWithTimeout(downloadUrl, {
    headers: { Authorization: `Client-ID ${accessKey}` },
  }).catch(() => {});
}
