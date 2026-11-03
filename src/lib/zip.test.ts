import { expect, test } from "bun:test";
import { strFromU8, unzipSync } from "fflate";
import type { Capture } from "./types";
import { buildZip } from "./zip";

const page = "https://app.example.com/r";
const fixture: Capture[] = [
  {
    name: "getItems",
    url: "https://app.example.com/v4/getItems",
    method: "POST",
    body: '{"p":1}',
    status: 200,
    page,
    text: '{"a":1}',
    capturedAt: "2026-11-03T12:04:00.000Z",
  },
  {
    name: "getItems-2",
    url: "https://app.example.com/v4/getItems",
    method: "POST",
    body: "q=1",
    status: 200,
    page,
    text: "[1]",
    capturedAt: "2026-11-03T12:04:05.000Z",
  },
  {
    name: "getUser",
    url: "https://app.example.com/v4/getUser",
    method: "GET",
    body: null,
    status: 200,
    page,
    text: '{"u":2}',
    capturedAt: "2026-11-03T12:04:09.000Z",
  },
];

const unzip = async (blob: Blob) =>
  unzipSync(new Uint8Array(await blob.arrayBuffer()));
const entry = (c: Capture, body: unknown) => ({
  url: c.url,
  method: c.method,
  body,
  status: c.status,
  page: c.page,
  capturedAt: c.capturedAt,
});

test("entries in capture order, _requests.json last", async () => {
  const files = await unzip(await buildZip(fixture, "f"));
  expect(Object.keys(files)).toEqual([
    "f/getItems.json",
    "f/getItems-2.json",
    "f/getUser.json",
    "f/_requests.json",
  ]);
  expect(strFromU8(files["f/getItems.json"]!)).toBe('{"a":1}');
  expect(strFromU8(files["f/getItems-2.json"]!)).toBe("[1]");
  expect(JSON.parse(strFromU8(files["f/_requests.json"]!))).toEqual({
    getItems: entry(fixture[0]!, { p: 1 }),
    "getItems-2": entry(fixture[1]!, "q=1"),
    getUser: entry(fixture[2]!, null),
  });
});

test("accepts an async iterable", async () => {
  async function* captures() {
    yield* fixture;
  }
  const files = await unzip(await buildZip(captures(), "f"));
  expect(Object.keys(files)).toHaveLength(4);
});

test("no captures gives only an empty _requests.json", async () => {
  const files = await unzip(await buildZip([], "f"));
  expect(Object.keys(files)).toEqual(["f/_requests.json"]);
  expect(JSON.parse(strFromU8(files["f/_requests.json"]!))).toEqual({});
});

test("the blob is a zip", async () => {
  expect((await buildZip([], "f")).type).toBe("application/zip");
});
