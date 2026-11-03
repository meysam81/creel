import { describe, expect, test } from "bun:test";
import type { PageMessage } from "../lib/types";
import {
  MAX_BODY_CHARS,
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
    expect(posts).toEqual([{ source: "creel", kind: "skipped" }]);
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
