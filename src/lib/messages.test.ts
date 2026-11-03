import { describe, expect, test } from "bun:test";
import { acceptCapture, parsePageMessage } from "./messages";
import type { Session } from "./types";

const capture = {
  url: "https://app.example.com/v4/getItems",
  method: "POST",
  body: '{"p":1}',
  status: 200,
  page: "https://app.example.com/report",
  text: '{"a":1}',
};

describe("parsePageMessage", () => {
  test("accepts a capture message", () => {
    const msg = { source: "creel", kind: "capture", capture } as const;
    expect(parsePageMessage(msg)).toBe(msg);
  });

  test("accepts a skipped notice", () => {
    const msg = { source: "creel", kind: "skipped" } as const;
    expect(parsePageMessage(msg)).toBe(msg);
  });

  const noText = {
    url: capture.url,
    method: capture.method,
    body: capture.body,
    status: capture.status,
    page: capture.page,
  };
  test.each([
    ["null", null],
    ["a string", "str"],
    ["another source", { source: "other", kind: "skipped" }],
    [
      "a capture missing text",
      { source: "creel", kind: "capture", capture: noText },
    ],
    [
      "a string status",
      {
        source: "creel",
        kind: "capture",
        capture: { ...capture, status: "200" },
      },
    ],
    [
      "a numeric body",
      { source: "creel", kind: "capture", capture: { ...capture, body: 5 } },
    ],
  ])("rejects %s", (_label, data) => expect(parsePageMessage(data)).toBeNull());
});

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
    expect(acceptCapture(session(true), origin)).toBe(true));
  test("drops when not recording", () =>
    expect(acceptCapture(session(false), origin)).toBe(false));
  test("drops another origin", () =>
    expect(acceptCapture(session(true), "https://other.example.org")).toBe(
      false,
    ));
  test("drops without a session", () =>
    expect(acceptCapture(null, origin)).toBe(false));
  test("drops an unknown sender", () =>
    expect(acceptCapture(session(true), undefined)).toBe(false));
});
