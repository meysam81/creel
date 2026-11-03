// Offscreen document: the only place that can turn the stored captures into a downloadable blob URL.
import { iterateCaptures, openDb } from "../lib/db";
import type { OffscreenMessage, ZipReply } from "../lib/types";
import { buildZip } from "../lib/zip";

async function zip(base: string): Promise<ZipReply> {
  try {
    const blob = await buildZip(iterateCaptures(await openDb()), base);
    return { url: URL.createObjectURL(blob), size: blob.size };
  } catch (error) {
    return { error: String(error) };
  }
}

chrome.runtime.onMessage.addListener(
  (msg: OffscreenMessage, _sender, sendResponse) => {
    if (msg.type === "offscreen-zip") {
      zip(msg.base).then(sendResponse, () => undefined);
      return true;
    }
    if (msg.type === "offscreen-revoke") {
      URL.revokeObjectURL(msg.url);
    }
    return false;
  },
);
