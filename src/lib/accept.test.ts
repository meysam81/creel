import { describe, expect, test } from "bun:test";
import { acceptCapture } from "./accept";
import type { Session } from "./types";

const capture = { url: "https://app.example.com/v4/getItems" };

describe("acceptCapture", () => {
  const origin = "https://app.example.com";
  const session = (recording: boolean): Session => ({
    origin,
    recording,
    startedAt: 0,
    zipping: false,
    error: null,
    version: "0.1.0",
  });

  test("accepts the recorded origin while recording", () =>
    expect(acceptCapture(session(true), origin, capture.url)).toBe(true));
  test("drops when not recording", () =>
    expect(acceptCapture(session(false), origin, capture.url)).toBe(false));
  test("drops another origin", () =>
    expect(
      acceptCapture(session(true), "https://other.example.org", capture.url),
    ).toBe(false));
  test("drops without a session", () =>
    expect(acceptCapture(null, origin, capture.url)).toBe(false));
  test("drops an unknown sender", () =>
    expect(acceptCapture(session(true), undefined, capture.url)).toBe(false));

  // the page prefilter lets other hosts under the same last two labels through
  test.each([
    ["a subdomain of the page", origin, "https://api.example.com/x", true],
    [
      "another site under a public suffix",
      "https://example.com.au",
      "https://other.com.au/x",
      false,
    ],
    [
      "a sibling private-suffix tenant",
      "https://a.github.io",
      "https://b.github.io/x",
      false,
    ],
    ["a URL that does not parse", origin, "not a url", false],
  ])("for %s", (_label, here, url, want) =>
    expect(acceptCapture({ ...session(true), origin: here }, here, url)).toBe(
      want,
    ),
  );
});
