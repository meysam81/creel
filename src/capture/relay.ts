// Runs in the extension's isolated world: forwards the page script's captures to the service worker.
import { parsePageMessage } from "../lib/messages";
import type { WorkerMessage } from "../lib/types";

type Listener = (event: MessageEvent) => void;
const scope = globalThis as typeof globalThis & { __creelRelay?: Listener };

function stop(): void {
  window.removeEventListener("message", relay);
}

function relay(event: MessageEvent): void {
  if (event.source !== window) {
    return;
  }
  const msg = parsePageMessage(event.data);
  if (!msg) {
    return;
  }
  const out: WorkerMessage =
    msg.kind === "capture"
      ? { type: "capture", capture: msg.capture }
      : { type: "skipped" };
  try {
    chrome.runtime.sendMessage(out).catch(stop);
  } catch {
    // the extension was reloaded or removed: this relay is dead
    stop();
  }
}

// A second injection (Record again on an open tab) replaces the first listener instead of doubling it.
if (scope.__creelRelay) {
  window.removeEventListener("message", scope.__creelRelay);
}
scope.__creelRelay = relay;
window.addEventListener("message", relay);
