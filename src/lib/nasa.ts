import { getSecret } from '@/lib/secrets';

export const NASA_APOD_API = 'https://api.nasa.gov/planetary/apod';
export const NASA_IMAGE_API = 'https://images-api.nasa.gov';

/**
 * Resolve the NASA API key from the secrets store.
 * Returns null if not configured — callers must handle the missing-key case.
 */
export async function getNasaApiKey(): Promise<string | null> {
  return await getSecret('nasa_api_key');
}
