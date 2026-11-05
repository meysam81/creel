import { describe, expect, test } from "bun:test";
import type { PageMessage } from "../lib/types";
import {
  MAX_BODY_CHARS,
  patchXhr,
  requestBodyText,
  wrapFetch,
  type PageCtx,
} from "./wrap";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(respond: () => Promise<Response>) {
  const posts: PageMessage[] = [];
  const ctx: PageCtx = {
    post: (msg) => posts.push(msg),
    location: {
      hostname: "app.example.com",
      href: "https://app.example.com/report",
    },
  };
  const fetch0 = (() => respond()) as unknown as typeof fetch;
  return { posts, wrapped: wrapFetch(fetch0, ctx) };
}

describe("wrapFetch", () => {
  test("returns the page's own Response object", async () => {
    const r = new Response('{"a":1}');
    const { wrapped } = setup(() => Promise.resolve(r));
    expect(await wrapped("/x")).toBe(r);
  });

  test("posts same-site JSON", async () => {
    const { posts, wrapped } = setup(() =>
      Promise.resolve(new Response('{"a":1}')),
    );
    await wrapped("/v4/getItems", { method: "POST", body: '{"p":2}' });
    await tick();
    expect(posts).toEqual([
      {
        source: "creel",
        kind: "capture",
        capture: {
          url: "https://app.example.com/v4/getItems",
          method: "POST",
          body: '{"p":2}',
          status: 200,
          page: "https://app.example.com/report",
          text: '{"a":1}',
        },
      },
    ]);
  });

  test("reads a Request body for non-GET", async () => {
    const { posts, wrapped } = setup(() =>
      Promise.resolve(new Response("[1]")),
    );
    await wrapped(
      new Request("https://app.example.com/x", { method: "POST", body: "q=1" }),
    );
    await tick();
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      capture: { method: "POST", body: "q=1" },
    });
  });

  test("ignores cross-site and non-JSON", async () => {
    const json = setup(() => Promise.resolve(new Response('{"a":1}')));
    await json.wrapped("https://cdn.other.com/x");
    const html = setup(() => Promise.resolve(new Response("<html>")));
    await html.wrapped("/page");
    await tick();
    expect([...json.posts, ...html.posts]).toEqual([]);
  });

  test("propagates the page's fetch rejection unchanged", async () => {
    const err = new TypeError("net");
    const { wrapped } = setup(() => Promise.reject(err));
    await expect(wrapped("/x")).rejects.toBe(err);
  });

  test("a body read error neither throws nor posts", async () => {
    const broken = new Response(
      new ReadableStream({
        pull(controller) {
          controller.error(new Error("boom"));
        },
      }),
    );
    const { posts, wrapped } = setup(() => Promise.resolve(broken));
    expect(await wrapped("/x")).toBe(broken);
    await tick();
    expect(posts).toEqual([]);
  });

  test("oversize body posts skipped", async () => {
    const { posts, wrapped } = setup(() =>
      Promise.resolve(new Response("x".repeat(MAX_BODY_CHARS + 1))),
    );
    await wrapped("/big");
    await tick();
    expect(posts).toEqual([
      {
        source: "creel",
        kind: "skipped",
        url: "https://app.example.com/big",
      },
    ]);
  });
});

describe("wrapFetch on large and binary responses", () => {
  test("a declared length over the cap posts skipped without reading", async () => {
    const { posts, wrapped } = setup(() =>
      Promise.resolve(
        new Response('{"a":1}', {
          headers: { "content-length": String(MAX_BODY_CHARS + 1) },
        }),
      ),
    );
    await wrapped("/export");
    await tick();
    expect(posts).toEqual([
      {
        source: "creel",
        kind: "skipped",
        url: "https://app.example.com/export",
      },
    ]);
  });

  test("binary content types are not read", async () => {
    const { posts, wrapped } = setup(() =>
      Promise.resolve(
        new Response('{"a":1}', { headers: { "content-type": "image/png" } }),
      ),
    );
    await wrapped("/logo");
    await tick();
    expect(posts).toEqual([]);
  });

  test("a streaming request body does not hold the page's request back", async () => {
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });
    const request = new Request("https://app.example.com/upload", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit);
    const posts: PageMessage[] = [];
    const ctx: PageCtx = {
      post: (msg) => posts.push(msg),
      location: {
        hostname: "app.example.com",
        href: "https://app.example.com/report",
      },
    };
    // the upload only finishes once the request is under way
    const fetch0 = (() => {
      controller?.enqueue(new TextEncoder().encode("q=1"));
      controller?.close();
      return Promise.resolve(new Response('{"ok":1}'));
    }) as unknown as typeof fetch;
    await wrapFetch(fetch0, ctx)(request);
    await tick();
    expect(posts[0]).toMatchObject({ capture: { body: "q=1" } });
  }, 1000);
});

class FakeXhr extends EventTarget {
  responseType = "";
  responseText = "";
  response: unknown = null;
  status = 200;
  opened: unknown[][] = [];
  sent: unknown[] = [];
  open(...args: unknown[]) {
    this.opened.push(args);
  }
  send(body?: unknown) {
    this.sent.push(body);
  }
  respond(text: string, type = "") {
    this.responseType = type;
    this.responseText = text;
    this.response = type === "json" ? JSON.parse(text) : text;
    this.dispatchEvent(new Event("load"));
  }
}

function setupXhr() {
  const posts: PageMessage[] = [];
  // a fresh prototype per test, so patches never stack
  const proto = Object.create(FakeXhr.prototype) as FakeXhr;
  patchXhr(proto as unknown as XMLHttpRequest, {
    post: (msg) => posts.push(msg),
    location: {
      hostname: "app.example.com",
      href: "https://app.example.com/report",
    },
  });
  return {
    posts,
    xhr: () => Object.setPrototypeOf(new FakeXhr(), proto) as FakeXhr,
  };
}

describe("patchXhr", () => {
  test("captures a text response with its request body", () => {
    const { posts, xhr } = setupXhr();
    const x = xhr();
    x.open("post", "/v4/getItems");
    x.send(new URLSearchParams("a=1"));
    x.respond('{"a":1}');
    expect(posts).toEqual([
      {
        source: "creel",
        kind: "capture",
        capture: {
          url: "https://app.example.com/v4/getItems",
          method: "POST",
          body: "a=1",
          status: 200,
          page: "https://app.example.com/report",
          text: '{"a":1}',
        },
      },
    ]);
    expect(x.opened).toHaveLength(1);
    expect(x.sent).toHaveLength(1);
  });

  test("serialises a json responseType", () => {
    const { posts, xhr } = setupXhr();
    const x = xhr();
    x.open("GET", "/v4/getUser");
    x.send();
    x.respond('{"u":2}', "json");
    expect(posts[0]).toMatchObject({ capture: { text: '{"u":2}' } });
  });

  test("skips binary response types and cross-site requests", () => {
    const { posts, xhr } = setupXhr();
    const binary = xhr();
    binary.open("GET", "/v4/file");
    binary.send();
    binary.respond('{"a":1}', "arraybuffer");
    const other = xhr();
    other.open("GET", "https://cdn.other.com/x");
    other.send();
    other.respond('{"a":1}');
    expect(posts).toEqual([]);
  });

  test("a reused request object captures each response once, under its own URL", () => {
    const { posts, xhr } = setupXhr();
    const x = xhr();
    x.open("GET", "/v4/first");
    x.send();
    x.respond('{"first":1}');
    x.open("GET", "/v4/second");
    x.send();
    x.respond('{"second":2}');
    expect(
      posts.map((p) =>
        p.kind === "capture" ? [p.capture.url, p.capture.text] : [],
      ),
    ).toEqual([
      ["https://app.example.com/v4/first", '{"first":1}'],
      ["https://app.example.com/v4/second", '{"second":2}'],
    ]);
  });
});

describe("requestBodyText", () => {
  test("keeps a string", () =>
    expect(requestBodyText('{"a":1}')).toBe('{"a":1}'));
  test("serialises URLSearchParams", () =>
    expect(requestBodyText(new URLSearchParams("a=1&b=2"))).toBe("a=1&b=2"));
  test("drops FormData", () =>
    expect(requestBodyText(new FormData())).toBeNull());
  test("drops undefined", () => expect(requestBodyText(undefined)).toBeNull());
});
