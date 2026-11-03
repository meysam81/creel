// Runs in the extension's isolated world: forwards the page script's captures to the service worker.
import { makeRelay } from "./forward";

type Listener = (event: MessageEvent) => void;
const scope = globalThis as typeof globalThis & { __creelRelay?: Listener };

const forward = makeRelay({
  send: (msg) => chrome.runtime.sendMessage(msg),
  alive: () => chrome.runtime?.id !== undefined,
  stop: () => window.removeEventListener("message", relay),
});

function relay(event: MessageEvent): void {
  if (event.source === window) {
    forward(event.data);
  }
}

// A second injection (Record again on an open tab) replaces the first listener instead of doubling it.
if (scope.__creelRelay) {
  window.removeEventListener("message", scope.__creelRelay);
}
scope.__creelRelay = relay;
window.addEventListener("message", relay);
