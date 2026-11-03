// Runs in the page's own JavaScript world (MAIN), from document_start.
import { patchXhr, wrapFetch, type PageCtx } from "./wrap";

declare global {
  interface Window {
    __creel?: true;
  }
}

if (!window.__creel) {
  window.__creel = true;
  const ctx: PageCtx = {
    post: (msg) => window.postMessage(msg, location.origin),
    location,
  };
  window.fetch = wrapFetch(window.fetch.bind(window), ctx);
  patchXhr(XMLHttpRequest.prototype, ctx);
}
