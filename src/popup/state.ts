import { recordableOrigin } from "../lib/site";
import type { Session, Stats } from "../lib/types";

export const COPY = {
  EMPTY: "Open the site you want to record, then press Record.",
  UNSUPPORTED: "Creel can't record this page.",
  STORAGE: "Storage is full. Download and clear to keep recording.",
  DOWNLOAD: "The download didn't finish. Try again.",
  other: (origin: string) => `Download or clear the ${origin} captures first.`,
  denied: (origin: string) => `Creel needs access to ${origin} to record it.`,
};

export interface PopupInput {
  session: Session | null;
  stats: Stats;
  tabUrl: string | undefined;
}

export interface PopupView {
  pill: "rec" | "paused" | "none";
  origin: string | null;
  primary: "record" | "stop";
  primaryDisabled: boolean;
  downloadDisabled: boolean;
  downloadLabel: "Download ZIP" | "Preparing ZIP...";
  clearDisabled: boolean;
  message: string | null;
}

const ERROR_COPY = { storage: COPY.STORAGE, download: COPY.DOWNLOAD };

/** What the popup shows and allows, from the session, its captures and the active tab. */
export function deriveView({ session, stats, tabUrl }: PopupInput): PopupView {
  const tab = recordableOrigin(tabUrl);
  const zipping = session?.zipping ?? false;
  const download = {
    downloadDisabled: stats.count === 0 || session === null || zipping,
    downloadLabel: zipping ? "Preparing ZIP..." : "Download ZIP",
  } as const;
  const error = session?.error ? ERROR_COPY[session.error] : null;

  if (session?.recording) {
    return {
      pill: "rec",
      origin: session.origin,
      primary: "stop",
      primaryDisabled: false,
      ...download,
      clearDisabled: true,
      message: error,
    };
  }

  const pending = session !== null && stats.count > 0 ? session.origin : null;
  const blocked = pending !== null && pending !== tab;
  let message = error;
  if (message === null && tab === null) {
    message = COPY.UNSUPPORTED;
  } else if (message === null && pending !== null && blocked) {
    message = COPY.other(pending);
  } else if (message === null && pending === null) {
    message = COPY.EMPTY;
  }
  return {
    pill: pending === null ? "none" : "paused",
    origin: pending ?? tab,
    primary: "record",
    primaryDisabled: tab === null || blocked,
    ...download,
    clearDisabled: pending === null || zipping,
    message,
  };
}

/** `N responses · X MB`, plus the skipped count when there is one. */
export function statsLine({
  count,
  bytes,
  skipped,
}: Pick<Stats, "count" | "bytes" | "skipped">): string {
  const line = `${count} ${count === 1 ? "response" : "responses"} · ${(bytes / 1_048_576).toFixed(1)} MB`;
  return skipped > 0 ? `${line} · ${skipped} skipped (too large)` : line;
}
