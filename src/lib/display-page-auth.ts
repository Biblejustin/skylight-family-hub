import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireDisplayAuth } from './auth';
import type { DisplaySearchParams } from './display-search-params';

/** Guard server rendering before reading private config or issuing a token. */
export async function requireDisplayPageAuth(
  pathname: string,
  searchParams: DisplaySearchParams,
): Promise<void> {
  // This Request is only an auth input, never fetched. The fixed origin avoids
  // trusting Host/forwarded headers; auth checks the path and credentials.
  const url = new URL(pathname, 'http://localhost');
  for (const [name, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') url.searchParams.append(name, value);
    else if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(name, item);
    }
  }
  const request = new Request(url, { headers: await headers() });
  try {
    // No IP-bypass shortcut: the page can disclose private feed URLs and the
    // display credential, so password-enabled pages require a real credential.
    await requireDisplayAuth(request);
  } catch (error) {
    if (!(error instanceof Response) || error.status !== 401) throw error;
    // Never carry a rejected token into the login URL or its return target.
    url.searchParams.delete('token');
    redirect(`/login?from=${encodeURIComponent(url.pathname + url.search)}`);
  }
}
