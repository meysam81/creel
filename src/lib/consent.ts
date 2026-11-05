/** Bump when the first-run notice changes what it says, so people are asked again. */
export const CONSENT_VERSION = 1;
export const CONSENT_KEY = "consent";

export interface Consent {
  version: number;
  at: string;
}

export function consentRecord(now: Date): Consent {
  return { version: CONSENT_VERSION, at: now.toISOString() };
}

/** Whether the stored value is an acceptance of the current notice. */
export function hasConsent(stored: unknown): boolean {
  return (
    typeof stored === "object" &&
    stored !== null &&
    (stored as { version?: unknown }).version === CONSENT_VERSION
  );
}
