import { sameSiteUrl } from "./same-site";
import type { Session } from "./types";

/**
 * The worker keeps a capture only while recording, from the recorded origin, and when
 * the request went to the same site. The page script only prefilters that last test.
 */
export function acceptCapture(
  session: Session | null,
  senderOrigin: string | undefined,
  requestUrl: string,
): boolean {
  return (
    session !== null &&
    session.recording &&
    senderOrigin === session.origin &&
    sameSiteUrl(session.origin, requestUrl)
  );
}
