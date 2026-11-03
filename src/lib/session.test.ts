import { describe, expect, test } from "bun:test";
import {
  needsRegister,
  orphanedZip,
  planRecord,
  startSession,
} from "./session";
import type { Session } from "./types";

const A = "https://app.example.com";
const B = "https://other.example.org";
const s = (over: Partial<Session> = {}): Session => ({
  origin: A,
  recording: false,
  startedAt: 0,
  zipping: false,
  error: null,
  version: "0.1.0",
  ...over,
});

describe("planRecord", () => {
  test("no session starts fresh", () =>
    expect(planRecord(null, 0, A)).toBe("fresh"));
  test("stale captures without a session are replaced, not merged", () =>
    expect(planRecord(null, 3, A)).toBe("fresh"));
  test("same origin resumes", () =>
    expect(planRecord(s(), 3, A)).toBe("resume"));
  test("another origin with nothing pending starts fresh", () =>
    expect(planRecord(s(), 0, B)).toBe("fresh"));
  test("another origin with captures pending is blocked", () =>
    expect(planRecord(s(), 3, B)).toBe("blocked"));
});

describe("startSession", () => {
  test("resume keeps an in-flight download's zipping flag", () => {
    const next = startSession(
      s({ zipping: true, error: "download", startedAt: 1 }),
      "resume",
      A,
      500,
      "0.2.0",
    );
    expect(next).toEqual(
      s({
        recording: true,
        zipping: true,
        error: null,
        startedAt: 500,
        version: "0.2.0",
      }),
    );
  });
  test("fresh starts clean on the new origin", () =>
    expect(
      startSession(s({ zipping: true }), "fresh", B, 500, "0.2.0"),
    ).toEqual(
      s({ origin: B, recording: true, startedAt: 500, version: "0.2.0" }),
    ));
});

describe("orphanedZip", () => {
  test("zipping with no download in flight is orphaned", () =>
    expect(orphanedZip(s({ zipping: true }), undefined)).toBe(true));
  test("zipping with a download in flight is not", () =>
    expect(orphanedZip(s({ zipping: true }), { id: 1, url: "blob:x" })).toBe(
      false,
    ));
  test("not zipping is not", () =>
    expect(orphanedZip(s(), undefined)).toBe(false));
  test("no session is not", () =>
    expect(orphanedZip(null, undefined)).toBe(false));
});

describe("needsRegister", () => {
  const ok = [
    { id: "creel-relay", matches: [`${A}/*`] },
    { id: "creel-page", matches: [`${A}/*`] },
  ];
  test("both scripts on the origin need nothing", () =>
    expect(needsRegister(ok, A)).toBe(false));
  test("none registered", () => expect(needsRegister([], A)).toBe(true));
  test("one missing", () =>
    expect(needsRegister(ok.slice(0, 1), A)).toBe(true));
  test("registered for another origin", () =>
    expect(needsRegister(ok, B)).toBe(true));
});
