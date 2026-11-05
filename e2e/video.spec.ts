/**
 * Captures for the promo video: `bun run video` renders the real popup at 6x into video/public/, one image per state, with the
 * position of every part the camera visits. Remotion animates around these frames.
 */
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Locator } from "@playwright/test";
import { EXTENSION, expect, test } from "./fixtures";

const SITE = "https://www.example.com/";
const FRAME = { width: 360, height: 400 };
const OUT = path.resolve(import.meta.dirname, "../video/public");
const CALLS = [
  "/api/orders",
  "/api/customers",
  "/api/products",
  "/api/invoices?page=1",
  "/api/inventory",
];

test.skip(process.env.VIDEO !== "1", "VIDEO=1 only");
test.use({ grants: ["https://www.example.com/*"] });

test("promo video captures", async ({ context, openPopup }) => {
  await mkdir(OUT, { recursive: true });
  await copyFile(
    path.join(EXTENSION, "icons/icon-128.png"),
    path.join(OUT, "mark.png"),
  );
  await context.route(/^https:\/\/www\.example\.com\//, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/")) {
      return route.fulfill({
        json: {
          resource: url.pathname.split("/").pop(),
          items: [{ id: 1 }, { id: 2 }],
        },
      });
    }
    return route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Example Orders</title><body></body>",
    });
  });
  const site = await context.newPage();
  await site.goto(SITE);
  const popup = await openPopup(SITE);
  await popup.setViewportSize(FRAME);

  const captures: Record<string, unknown> = {};
  const grab = async (name: string, marks: Record<string, Locator>) => {
    await popup.mouse.move(0, 0);
    const height = await popup.evaluate(() => document.body.scrollHeight);
    expect(height).toBeLessThanOrEqual(FRAME.height);
    const clip = { x: 0, y: 0, width: FRAME.width, height };
    await popup.screenshot({ path: path.join(OUT, `${name}.png`), clip });
    const boxes: Record<string, unknown> = {};
    for (const [key, locator] of Object.entries(marks)) {
      // oxlint-disable-next-line no-await-in-loop -- a handful of boxes
      const box = await locator.boundingBox();
      if (!box) {
        throw new Error(`${name}: ${key} is not on screen`);
      }
      boxes[key] = box;
    }
    captures[name] = { width: clip.width, height, marks: boxes };
  };

  await expect(popup.locator("#consent")).toBeVisible();
  await grab("consent", { accept: popup.locator("#accept") });

  await popup.locator("#accept").click();
  await expect(popup.locator("#primary")).toBeEnabled();
  await grab("idle", { record: popup.locator("#primary") });

  await popup.locator("#primary").click();
  await expect(popup.locator("#pill")).toContainText("REC");
  await site.reload();
  for (let i = 0; i < 12; i++) {
    const call = CALLS[i % CALLS.length]!;
    // oxlint-disable-next-line no-await-in-loop -- one call after another
    await site.evaluate((u) => fetch(u).then((r: Response) => r.json()), call);
  }
  await expect(popup.locator("#stats")).toContainText("12 responses", {
    timeout: 10_000,
  });
  await grab("rec", {
    list: popup.locator("#recent"),
    stop: popup.locator("#primary"),
  });

  await popup.locator("#primary").click();
  await expect(popup.locator("#pill")).toHaveText("Paused");
  await expect(popup.locator("#download")).toBeEnabled();
  await grab("done", {
    download: popup.locator("#download"),
    list: popup.locator("#recent"),
  });

  await writeFile(
    path.join(OUT, "captures.json"),
    `${JSON.stringify(captures, null, 2)}\n`,
  );
});
