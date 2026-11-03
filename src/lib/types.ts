/** What the page wrapper sees for one fetch/XHR response. */
export interface CaptureInput {
  url: string;
  method: string;
  body: string | null;
  status: number;
  page: string;
  text: string;
}

/** A stored capture: its file name and capture time (ISO 8601). */
export interface Capture extends CaptureInput {
  name: string;
  capturedAt: string;
}

/** File names handed out so far, so no two captures share one. */
export interface NameState {
  next: Record<string, number>;
  taken: Record<string, true>;
}

export interface Stats {
  count: number;
  bytes: number;
  skipped: number;
  recent: { name: string; capturedAt: string }[];
  names: NameState;
}

export interface Session {
  origin: string;
  recording: boolean;
  startedAt: number;
  zipping: boolean;
  error: "storage" | "download" | null;
  version: string;
}

export type PageMessage =
  | { source: "creel"; kind: "capture"; capture: CaptureInput }
  | { source: "creel"; kind: "skipped" };

export type Command =
  | { type: "record"; origin: string }
  | { type: "stop" }
  | { type: "clear" }
  | { type: "download" };

export type WorkerMessage =
  Command | { type: "capture"; capture: CaptureInput } | { type: "skipped" };

export type OffscreenMessage =
  | { type: "offscreen-zip"; base: string }
  | { type: "offscreen-revoke"; url: string };

export type ZipReply = { url: string; size: number } | { error: string };

export function emptyStats(): Stats {
  return {
    count: 0,
    bytes: 0,
    skipped: 0,
    recent: [],
    names: { next: {}, taken: {} },
  };
}
