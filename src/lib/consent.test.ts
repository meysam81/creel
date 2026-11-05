import { expect, test } from "bun:test";
import { CONSENT_VERSION, consentRecord, hasConsent } from "./consent";

test("a stored record of the current version is consent", () =>
  expect(hasConsent(consentRecord(new Date("2026-11-05T10:00:00Z")))).toBe(
    true,
  ));

test.each([
  ["nothing stored", undefined],
  ["null", null],
  ["a bare true", true],
  ["an older version", { version: CONSENT_VERSION - 1, at: "2026-11-05" }],
  [
    "a newer version than this build knows",
    { version: CONSENT_VERSION + 1, at: "x" },
  ],
  ["a string version", { version: "1", at: "x" }],
])("%s is not consent", (_label, stored) =>
  expect(hasConsent(stored)).toBe(false),
);

test("the record keeps the time as ISO 8601", () =>
  expect(consentRecord(new Date("2026-11-05T10:00:00Z"))).toEqual({
    version: CONSENT_VERSION,
    at: "2026-11-05T10:00:00.000Z",
  }));
