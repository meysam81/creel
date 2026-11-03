import { expect, test } from "bun:test";
import { looksLikeJson, recordableOrigin, sameSite } from "./site";

test.each([
  ["app.example.com", "app.example.com", true],
  ["app.example.com", "api.example.com", true],
  ["example.com", "api.example.com", true],
  ["app.example.com", "cdn.other.com", false],
  ["127.0.0.1", "127.0.0.1", true],
  ["127.0.0.1", "127.0.0.2", false],
  ["[::1]", "[::1]", true],
  ["localhost", "api.localhost", false],
])("sameSite(%s, %s) = %p", (a, b, want) => expect(sameSite(a, b)).toBe(want));

test.each([
  ['{"a":1}', true],
  ["  [1]", true],
  ["<html>", false],
  ["", false],
  ["{bad", false],
  ['"s"', false],
  ["42", false],
])("looksLikeJson(%p) = %p", (text, want) =>
  expect(looksLikeJson(text)).toBe(want),
);

test.each([
  ["https://app.example.com/x?y=1", "https://app.example.com"],
  ["http://localhost:3000/", "http://localhost:3000"],
  ["chrome://extensions/", null],
  ["file:///tmp/a.html", null],
  ["https://chromewebstore.google.com/detail/x", null],
  ["https://chrome.google.com/webstore/detail/x", null],
  [undefined, null],
])("recordableOrigin(%p) = %p", (url, want) =>
  expect(recordableOrigin(url)).toBe(want),
);
