import { Zip, ZipDeflate, strToU8 } from "fflate";
import type { Capture } from "./types";

interface RequestEntry {
  url: string;
  method: string;
  body: unknown;
  status: number;
  page: string;
  capturedAt: string;
}

/** A request body as JSON when it parses, else the raw string, else null. */
function parseLoose(body: string | null): unknown {
  if (body === null) {
    return null;
  }
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

/**
 * Stream captures into one ZIP: `<folder>/<name>.json` per capture in order, then
 * `<folder>/_requests.json`. Holds the compressed output plus one body at a time.
 */
export async function buildZip(
  captures: AsyncIterable<Capture> | Iterable<Capture>,
  folder: string,
): Promise<Blob> {
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let zip: Zip | undefined;
  const result = new Promise<Blob>((resolve, reject) => {
    zip = new Zip((err, chunk, final) => {
      if (err) {
        reject(err);
        return;
      }
      chunks.push(chunk as Uint8Array<ArrayBuffer>);
      if (final) {
        resolve(new Blob(chunks, { type: "application/zip" }));
      }
    });
  });
  // a deflate error surfaces when awaited below, not as an unhandled rejection
  result.catch(() => undefined);
  const archive = zip as Zip;
  const add = (name: string, text: string, mtime: Date) => {
    const file = new ZipDeflate(`${folder}/${name}`, { level: 6 });
    file.mtime = mtime;
    archive.add(file);
    file.push(strToU8(text), true);
  };

  const requests: Record<string, RequestEntry> = {};
  for await (const c of captures) {
    add(`${c.name}.json`, c.text, new Date(c.capturedAt));
    requests[c.name] = {
      url: c.url,
      method: c.method,
      body: parseLoose(c.body),
      status: c.status,
      page: c.page,
      capturedAt: c.capturedAt,
    };
  }
  add("_requests.json", JSON.stringify(requests, null, 2), new Date());
  archive.end();
  return result;
}
