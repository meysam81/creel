import { looksLikeJson, maybeSameSite } from "../lib/site";
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
      ctx.post({ source: "creel", kind: "skipped", url: req.url });
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

/** Response types never worth reading as text. */
const BINARY =
  /^(?:image|video|audio|font)\/|^application\/(?:octet-stream|zip|pdf)/i;

interface Pending {
  url: string;
  method: string;
  body: Promise<string | null>;
}

function captureResponse(ctx: PageCtx, target: Pending, res: Response): void {
  if (Number(res.headers.get("content-length")) > MAX_BODY_CHARS) {
    ctx.post({ source: "creel", kind: "skipped", url: target.url });
    return;
  }
  if (BINARY.test(res.headers.get("content-type") ?? "")) {
    return;
  }
  // clone before the page can consume the body
  const copy = res.clone();
  Promise.all([target.body, copy.text()]).then(
    ([body, text]) =>
      emit(
        ctx,
        { url: target.url, method: target.method, body },
        res.status,
        text,
      ),
    () => undefined,
  );
}

/** Wrap the page's fetch: the page always gets its own Response, and same-site JSON is posted. */
export function wrapFetch(fetch0: typeof fetch, ctx: PageCtx): typeof fetch {
  async function creelFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    let target: Pending | null = null;
    try {
      const request = input instanceof Request ? input : null;
      const url = resolve(ctx, request ? request.url : String(input));
      if (url && maybeSameSite(ctx.location.hostname, url.hostname)) {
        const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
        let body = Promise.resolve(requestBodyText(init?.body));
        if (request && method !== "GET" && init?.body === undefined) {
          // clone now, finish reading later: a streaming upload must never wait on Creel
          body = request
            .clone()
            .text()
            .catch(() => null);
        }
        target = { url: url.href, method, body };
      }
    } catch {
      target = null;
    }
    const res = await fetch0(input, init);
    if (target) {
      try {
        captureResponse(ctx, target, res);
      } catch {
        // an unclonable response is left alone
      }
    }
    return res;
  }
  return creelFetch as typeof fetch;
}

const opened = new WeakMap<XMLHttpRequest, { method: string; url: string }>();
const inFlight = new WeakMap<XMLHttpRequest, Req>();
const listening = new WeakSet<XMLHttpRequest>();

function onXhrLoad(ctx: PageCtx, xhr: XMLHttpRequest): void {
  try {
    const req = inFlight.get(xhr);
    inFlight.delete(xhr);
    if (!req) {
      return;
    }
    let text: string | null = null;
    if (xhr.responseType === "" || xhr.responseType === "text") {
      text = xhr.responseText;
    } else if (xhr.responseType === "json") {
      text = JSON.stringify(xhr.response);
    }
    if (text !== null) {
      emit(ctx, req, xhr.status, text);
    }
  } catch {
    // never reach the page
  }
}

/** Patch XMLHttpRequest: record open(), read the body on load. One listener per object, so a reused object captures each response once. */
export function patchXhr(proto: XMLHttpRequest, ctx: PageCtx): void {
  const open0 = proto.open;
  const send0 = proto.send;
  proto.open = function creelOpen(
    this: XMLHttpRequest,
    ...args: [string, string | URL, ...unknown[]]
  ) {
    try {
      opened.set(this, {
        method: String(args[0]).toUpperCase(),
        url: String(args[1]),
      });
      inFlight.delete(this);
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
      const meta = opened.get(this);
      const url = meta ? resolve(ctx, meta.url) : null;
      if (meta && url && maybeSameSite(ctx.location.hostname, url.hostname)) {
        inFlight.set(this, {
          url: url.href,
          method: meta.method,
          body: requestBodyText(body),
        });
        if (!listening.has(this)) {
          listening.add(this);
          this.addEventListener("load", () => onXhrLoad(ctx, this));
        }
      }
    } catch {
      // never block the page's request
    }
    return Reflect.apply(send0, this, [body]);
  };
}
