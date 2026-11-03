const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/** Hosts that only ever match themselves: IPs, localhost, single-label names. */
function exactOnly(host: string): boolean {
  return (
    IPV4.test(host) ||
    host.includes(":") ||
    host.includes("[") ||
    host === "localhost" ||
    !host.includes(".")
  );
}

// ponytail: last-two-labels; multi-part TLDs (example.co.uk) match the whole co.uk. Upgrade: public-suffix list.
/** Whether a request host belongs to the same site as the page host. */
export function sameSite(pageHost: string, reqHost: string): boolean {
  if (pageHost === reqHost) {
    return true;
  }
  if (exactOnly(pageHost) || exactOnly(reqHost)) {
    return false;
  }
  const site = (host: string) => host.split(".").slice(-2).join(".");
  return site(pageHost) === site(reqHost);
}

/** A JSON object or array (not a bare string or number). */
export function looksLikeJson(text: string): boolean {
  const first = text.trimStart()[0];
  if (first !== "{" && first !== "[") {
    return false;
  }
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** The origin Creel may record on this tab, or null for pages Chrome won't let it script. */
export function recordableOrigin(url: string | undefined): string | null {
  if (!url) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  if (parsed.hostname === "chromewebstore.google.com") {
    return null;
  }
  if (
    parsed.hostname === "chrome.google.com" &&
    parsed.pathname.startsWith("/webstore")
  ) {
    return null;
  }
  return parsed.origin;
}
