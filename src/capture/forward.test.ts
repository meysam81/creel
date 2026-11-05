import { describe, expect, test } from "bun:test";
import type { WorkerMessage } from "../lib/types";
import { makeRelay } from "./forward";

const capture = {
  url: "https://app.example.com/v4/getItems",
  method: "GET",
  body: null,
  status: 200,
  page: "https://app.example.com/r",
  text: '{"a":1}',
};
const msg = { source: "creel", kind: "capture", capture };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(send: (m: WorkerMessage) => Promise<unknown>, alive = true) {
  const sent: WorkerMessage[] = [];
  let stopped = false;
  const relay = makeRelay({
    send: (m) => {
      sent.push(m);
      return send(m);
    },
    alive: () => alive,
    stop: () => {
      stopped = true;
    },
  });
  return { relay, sent, stopped: () => stopped };
}

describe("makeRelay", () => {
  test("forwards a capture", () => {
    const { relay, sent } = setup(() => Promise.resolve());
    relay(msg);
    expect(sent).toEqual([{ type: "capture", capture }]);
  });

  test("ignores anything that is not a Creel message", () => {
    const { relay, sent } = setup(() => Promise.resolve());
    relay({ source: "other" });
    relay("hello");
    expect(sent).toEqual([]);
  });

  test("a failed send while the extension is alive keeps the relay listening", async () => {
    const { relay, stopped } = setup(() =>
      Promise.reject(new Error("Could not establish connection")),
    );
    relay(msg);
    await tick();
    expect(stopped()).toBe(false);
  });

  test("a message too large to send counts as skipped", () => {
    const { relay, sent, stopped } = setup((m) => {
      if (m.type === "capture") {
        throw new Error("Message length exceeded maximum allowed length");
      }
      return Promise.resolve();
    });
    relay(msg);
    expect(sent.at(-1)).toEqual({ type: "skipped", url: expect.any(String) });
    expect(stopped()).toBe(false);
  });

  test("a dead extension context stops the relay", async () => {
    const { relay, stopped } = setup(
      () => Promise.reject(new Error("Extension context invalidated")),
      false,
    );
    relay(msg);
    await tick();
    expect(stopped()).toBe(true);
  });
});
