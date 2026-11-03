import { describe, expect, test } from "bun:test";
import { baseName, claimName, zipBase } from "./names";
import { emptyStats } from "./types";

describe("baseName edge cases", () => {
  test.each([
    ["https://app.example.com/v4/getItems?page=2#top", "getItems"],
    ["https://app.example.com/api/items/", "items"],
    ["https://app.example.com/", "index"],
    ["https://app.example.com/a/report%20v2.json", "report_v2"],
    ["https://app.example.com/a/%E0%A4%A", "_E0_A4_A"],
    ["https://app.example.com/_requests", "_requests_"],
  ])("%s -> %s", (url, want) => expect(baseName(url)).toBe(want));

  test("caps at 100 characters", () =>
    expect(baseName(`https://app.example.com/${"a".repeat(150)}`)).toHaveLength(
      100,
    ));
});

describe("claimName never reuses a name", () => {
  test("repeats get -2, -3", () => {
    const s = emptyStats().names;
    expect(["foo", "foo", "foo"].map((b) => claimName(b, s))).toEqual([
      "foo",
      "foo-2",
      "foo-3",
    ]);
  });

  test("a literal foo-2 is skipped over", () => {
    const s = emptyStats().names;
    expect(["foo-2", "foo", "foo"].map((b) => claimName(b, s))).toEqual([
      "foo-2",
      "foo",
      "foo-3",
    ]);
  });
});

test("zipBase uses local time and replaces ':'", () => {
  const at = new Date(2026, 10, 3, 12, 4);
  expect(zipBase("https://app.example.com", at)).toBe(
    "app.example.com-2026-11-03-1204",
  );
  expect(zipBase("http://localhost:3000", at)).toBe(
    "localhost_3000-2026-11-03-1204",
  );
});
