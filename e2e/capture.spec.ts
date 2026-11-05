import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const CORS = { "access-control-allow-origin": "*" };

/** Serves a page that calls `fetch` on demand, and answers every URL in `calls` with JSON. */
async function site(context: BrowserContext, page: Page, url: string) {
  await context.route(/^https:\/\//, (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") {
      return route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Example</title><body></body>",
      });
    }
    return route.fulfill({
      headers: CORS,
      json: { path: pathname, items: [{ id: 1 }] },
    });
  });
  await page.goto(url);
}

async function record(popup: Page) {
  await popup.locator("#accept").click();
  await popup.locator("#primary").click();
  await expect(popup.locator("#pill")).toContainText("REC");
}

// Each case lists what the page fetches and how many of those the extension must keep.
const CASES = [
  {
    name: "a subdomain of the page and a sibling API host",
    grant: "https://*.example.com/*",
    page: "https://www.example.com/",
    fetches: [
      "https://www.example.com/api/orders",
      "https://api.example.com/v1/customers",
      "https://cdn.example.net/other-site",
    ],
    kept: 2,
  },
  {
    name: "example.co.uk, where co.uk is a suffix and not a site",
    grant: "https://*.example.co.uk/*",
    page: "https://shop.example.co.uk/",
    fetches: [
      "https://api.example.co.uk/stock",
      "https://shop.example.co.uk/basket",
      "https://other.co.uk/not-ours",
    ],
    kept: 2,
  },
  {
    name: "github.io, where every tenant is its own site",
    grant: "https://a.github.io/*",
    page: "https://a.github.io/",
    fetches: [
      "https://a.github.io/data.json",
      "https://docs.a.github.io/index.json",
      "https://b.github.io/not-ours.json",
    ],
    kept: 2,
  },
];

for (const { name, grant, page: url, fetches, kept } of CASES) {
  test.describe(name, () => {
    test.use({ grants: [grant] });

    test(`keeps ${kept} of ${fetches.length} responses`, async ({
      context,
      openPopup,
    }) => {
      const page = await context.newPage();
      const popup = await openPopup(url);
      await record(popup);
      await site(context, page, url);
      await page.reload();
      // one after another, so the order is the page's order
      await page.evaluate(async (targets) => {
        for (const u of targets) {
          // oxlint-disable-next-line no-await-in-loop -- sequential on purpose
          await fetch(u).then((r) => r.json());
        }
      }, fetches);
      await expect(popup.locator("#stats")).toContainText(`${kept} responses`, {
        timeout: 10_000,
      });
      // the dropped one never shows up later either
      await page.waitForTimeout(500);
      await expect(popup.locator("#stats")).toContainText(`${kept} responses`);
    });
  });
}
