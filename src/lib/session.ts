import type { Session } from "./types";

export type RecordPlan = "blocked" | "resume" | "fresh";

/** What Record on `origin` means given the stored session and how many captures it holds. */
export function planRecord(
  session: Session | null,
  pendingCount: number,
  origin: string,
): RecordPlan {
  if (session?.origin === origin) {
    return "resume";
  }
  if (session && pendingCount > 0) {
    return "blocked";
  }
  // no session (any leftover captures are stale) or an empty session elsewhere
  return "fresh";
}

/** The session after Record. A resume keeps an in-flight download's `zipping` flag. */
export function startSession(
  prev: Session | null,
  plan: Exclude<RecordPlan, "blocked">,
  origin: string,
  now: number,
  version: string,
): Session {
  const base: Session =
    plan === "resume" && prev
      ? prev
      : {
          origin,
          recording: false,
          startedAt: 0,
          zipping: false,
          error: null,
          version,
        };
  return {
    ...base,
    origin,
    recording: true,
    startedAt: now,
    error: null,
    version,
  };
}

/** A worker that starts with `zipping` set but no download in flight lost its ZIP build. */
export function orphanedZip(
  session: Session | null,
  activeDownload: unknown,
): boolean {
  return Boolean(session?.zipping) && activeDownload === undefined;
}

/** Whether both capture scripts are registered for exactly this origin. */
export function needsRegister(
  registered: { id: string; matches?: string[] }[],
  origin: string,
): boolean {
  const want = `${origin}/*`;
  return !["creel-relay", "creel-page"].every((id) =>
    registered.some(
      (s) => s.id === id && s.matches?.length === 1 && s.matches[0] === want,
    ),
  );
}
