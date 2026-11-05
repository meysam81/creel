import { getDomain } from "tldts";

/** Lowercase ASCII (punycode) host without a trailing dot, or null when it is not a host. */
function normalize(host: string): string | null {
  try {
    const { hostname } = new URL(`http://${host}`);
    const bare = hostname.replace(/\.$/, "");
    return bare === "" ? null : bare;
  } catch {
    return null;
  }
}

/**
 * Whether two hosts belong to the same site (IPs, localhost and single-label names have
 * no registrable domain, so they only match themselves): the same registrable domain under the
 * public suffix list, private suffixes included (a.github.io and b.github.io differ).
 * Only the service worker runs this: the page keeps a cheap superset in `site.ts`.
 */
export function sameSite(pageHost: string, reqHost: string): boolean {
  const a = normalize(pageHost);
  const b = normalize(reqHost);
  if (a === null || b === null) {
    return false;
  }
  if (a === b) {
    return true;
  }
  const site = (host: string) => getDomain(host, { allowPrivateDomains: true });
  const left = site(a);
  return left !== null && left === site(b);
}

/** `sameSite` for an origin (the recorded page) and a request URL. */
export function sameSiteUrl(pageOrigin: string, requestUrl: string): boolean {
  try {
    return sameSite(new URL(pageOrigin).hostname, new URL(requestUrl).hostname);
  } catch {
    return false;
  }
}
