import { describe, expect, test } from "bun:test";
import { parsePageMessage } from "./messages";

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
    const msg = {
      source: "creel",
      kind: "skipped",
      url: capture.url,
    } as const;
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
    ["another source", { source: "other", kind: "skipped", url: capture.url }],
    ["a skipped notice without a URL", { source: "creel", kind: "skipped" }],
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
