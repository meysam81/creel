import type { NameState } from "./types";

/** File name (no extension) for a captured URL: its last path segment, made filesystem-safe. */
export function baseName(url: string): string {
  const segment =
    new URL(url).pathname.split("/").findLast((s) => s !== "") ?? "";
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // keep the raw segment when it holds a malformed escape
  }
  const name = decoded
    .replaceAll(/[^A-Za-z0-9._-]/g, "_")
    .replace(/\.json$/i, "")
    .slice(0, 100);
  if (name === "") {
    return "index";
  }
  if (name === "_requests") {
    return "_requests_";
  }
  return name;
}

/** Hand out the first free name for `base`: base, base-2, base-3, ... Mutates `state`. */
export function claimName(base: string, state: NameState): string {
  let n = state.next[base] ?? 1;
  const candidate = (i: number) => (i === 1 ? base : `${base}-${i}`);
  while (state.taken[candidate(n)]) {
    n++;
  }
  const name = candidate(n);
  state.taken[name] = true;
  state.next[base] = n + 1;
  return name;
}

/** `<host>-<YYYY-MM-DD-HHmm>` in local time, with ":" (a port) replaced by "_". */
export function zipBase(origin: string, now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const host = new URL(origin).host.replaceAll(":", "_");
  return `${host}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}
