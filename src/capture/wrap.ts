import { looksLikeJson, sameSite } from "../lib/site";
import type { PageMessage } from "../lib/types";

/** Bodies longer than this are counted as skipped, never sent (runtime messages cap at 64 MiB). */
export const MAX_BODY_CHARS = 33_554_432;

export interface PageCtx {
  post(msg: PageMessage): void;
  location: { hostname: string; href: string };
}

interface Req {
  url: string;
  method: string;
  body: string | null;
}

/** The request body as text when it is text; other body types are not recorded. */
export function requestBodyText(body: unknown): string | null {
  if (typeof body === "string") {
    return body;
  }
  if (body instanceof URLSearchParams) {
    return body.toString();
  }
  return null;
}

function resolve(ctx: PageCtx, raw: string): URL | null {
  try {
    return new URL(raw, ctx.location.href);
  } catch {
    return null;
  }
}

function emit(ctx: PageCtx, req: Req, status: number, text: string): void {
  try {
    if (text.length > MAX_BODY_CHARS) {
      ctx.post({ source: "creel", kind: "skipped" });
      return;
    }
    if (!looksLikeJson(text)) {
      return;
    }
    ctx.post({
      source: "creel",
      kind: "capture",
      capture: { ...req, status, page: ctx.location.href, text },
    });
  } catch {
    // a capture failure never reaches the page
  }
}

/** Wrap the page's fetch: the page always gets its own Response, and same-site JSON is posted. */
export function wrapFetch(fetch0: typeof fetch, ctx: PageCtx): typeof fetch {
  async function creelFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    let req: Req | null = null;
    try {
      const request = input instanceof Request ? input : null;
      const url = resolve(ctx, request ? request.url : String(input));
      if (url && sameSite(ctx.location.hostname, url.hostname)) {
        const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
        let body = requestBodyText(init?.body);
        if (request && method !== "GET" && init?.body === undefined) {
          body = await request
            .clone()
            .text()
            .catch(() => null);
        }
        req = { url: url.href, method, body };
      }
    } catch {
      req = null;
    }
    const res = await fetch0(input, init);
    if (req) {
      const captured = req;
      try {
        // clone before the page can consume the body
        res
          .clone()
          .text()
          .then(
            (text) => emit(ctx, captured, res.status, text),
            () => {
              /* empty */
            },
          );
      } catch {
        // an unclonable response is left alone
      }
    }
    return res;
  }
  return creelFetch as typeof fetch;
}

const pending = new WeakMap<XMLHttpRequest, { method: string; url: string }>();

/** Patch XMLHttpRequest the way the console capture did: record open(), read the body on load. */
export function patchXhr(proto: XMLHttpRequest, ctx: PageCtx): void {
  const open0 = proto.open;
  const send0 = proto.send;
  proto.open = function creelOpen(
    this: XMLHttpRequest,
    ...args: [string, string | URL, ...unknown[]]
  ) {
    try {
      pending.set(this, {
        method: String(args[0]).toUpperCase(),
        url: String(args[1]),
      });
    } catch {
      // never block the page's request
    }
    return Reflect.apply(open0, this, args);
  } as XMLHttpRequest["open"];
  proto.send = function creelSend(
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null,
  ) {
    try {
      const meta = pending.get(this);
      const url = meta ? resolve(ctx, meta.url) : null;
      if (meta && url && sameSite(ctx.location.hostname, url.hostname)) {
        const req: Req = {
          url: url.href,
          method: meta.method,
          body: requestBodyText(body),
        };
        this.addEventListener("load", () => {
          try {
            let text: string | null = null;
            if (this.responseType === "" || this.responseType === "text") {
              text = this.responseText;
            } else if (this.responseType === "json") {
              text = JSON.stringify(this.response);
            }
            if (text !== null) {
              emit(ctx, req, this.status, text);
            }
          } catch {
            // never reach the page
          }
        });
      }
    } catch {
      // never block the page's request
    }
    return Reflect.apply(send0, this, [body]);
  };
}
