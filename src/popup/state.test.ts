import { describe, expect, test } from "bun:test";
import { emptyStats, type Session } from "../lib/types";
import { COPY, deriveView, statsLine, type PopupView } from "./state";

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
const view = (over: Partial<PopupView>): PopupView => ({
  pill: "none",
  origin: null,
  primary: "record",
  primaryDisabled: false,
  downloadDisabled: true,
  downloadLabel: "Download ZIP",
  clearDisabled: true,
  message: null,
  consent: false,
  ...over,
});

describe("deriveView", () => {
  test.each<[string, Session | null, number, string, PopupView]>([
    [
      "no session on a site",
      null,
      0,
      `${A}/x`,
      view({ origin: A, message: COPY.EMPTY }),
    ],
    [
      "first run: the notice comes before Record",
      null,
      0,
      `${A}/x`,
      view({
        origin: A,
        primaryDisabled: true,
        consent: true,
        message: null,
      }),
    ],
    [
      "no session on chrome://",
      null,
      0,
      "chrome://extensions/",
      view({ primaryDisabled: true, message: COPY.UNSUPPORTED }),
    ],
    [
      "recording, viewed from another tab",
      s({ recording: true }),
      2,
      `${B}/`,
      view({
        pill: "rec",
        origin: A,
        primary: "stop",
        downloadDisabled: false,
      }),
    ],
    [
      "paused on its own site",
      s(),
      3,
      `${A}/`,
      view({
        pill: "paused",
        origin: A,
        downloadDisabled: false,
        clearDisabled: false,
      }),
    ],
    [
      "paused, viewed from another site",
      s(),
      3,
      `${B}/`,
      view({
        pill: "paused",
        origin: A,
        primaryDisabled: true,
        downloadDisabled: false,
        clearDisabled: false,
        message: COPY.other(A),
      }),
    ],
    [
      "empty session, another site",
      s(),
      0,
      `${B}/`,
      view({ origin: B, message: COPY.EMPTY }),
    ],
    [
      "zipping",
      s({ zipping: true }),
      3,
      `${A}/`,
      view({ pill: "paused", origin: A, downloadLabel: "Preparing ZIP..." }),
    ],
    [
      "storage error wins over the other-site hint",
      s({ error: "storage" }),
      3,
      `${B}/`,
      view({
        pill: "paused",
        origin: A,
        primaryDisabled: true,
        downloadDisabled: false,
        clearDisabled: false,
        message: COPY.STORAGE,
      }),
    ],
    [
      "download error",
      s({ error: "download" }),
      3,
      `${A}/`,
      view({
        pill: "paused",
        origin: A,
        downloadDisabled: false,
        clearDisabled: false,
        message: COPY.DOWNLOAD,
      }),
    ],
  ])("%s", (label, session, count, tabUrl, want) =>
    expect(
      deriveView({
        session,
        stats: { ...emptyStats(), count },
        tabUrl,
        consented: !label.startsWith("first run"),
      }),
    ).toEqual(want),
  );

  test("a session that already exists is never hidden behind the notice", () =>
    expect(
      deriveView({
        session: s({ recording: true }),
        stats: { ...emptyStats(), count: 2 },
        tabUrl: `${A}/`,
        consented: false,
      }).consent,
    ).toBe(false));
});

test("copy is verbatim", () => {
  expect(COPY.EMPTY).toBe(
    "Open the site you want to record, then press Record.",
  );
  expect(COPY.UNSUPPORTED).toBe("Creel can't record this page.");
  expect(COPY.STORAGE).toBe(
    "Storage is full. Download and clear to keep recording.",
  );
  expect(COPY.DOWNLOAD).toBe("The download didn't finish. Try again.");
  expect(COPY.other(A)).toBe(
    "Download or clear the https://app.example.com captures first.",
  );
  expect(COPY.CONSENT).toBe(
    "Creel keeps the JSON responses a site makes while you record it, with their URLs and request bodies. These can hold whatever the site returns, including personal data and credentials. All of it stays on this device until you download or clear it, and Creel sends it nowhere.",
  );
  expect(COPY.denied(A)).toBe(
    "Creel needs access to https://app.example.com to record it.",
  );
});

describe("statsLine", () => {
  test("singular, no skips", () =>
    expect(statsLine({ count: 1, bytes: 0, skipped: 0 })).toBe(
      "1 response · 0.0 MB",
    ));
  test("plural with skips", () =>
    expect(statsLine({ count: 37, bytes: 4_404_019, skipped: 2 })).toBe(
      "37 responses · 4.2 MB · 2 skipped (too large)",
    ));
});
