/**
 * Store images from the real UI: STORE=1 bunx playwright test e2e/store.spec.ts
 * writes 1280x800 screenshots and the 440x280 and 1400x560 tiles.
 *
 * Copy to e2e/store.spec.ts and edit CONFIG. Use example.com, example.net and
 * example.org in every shot, so no real company appears. Every UI shot is placed
 * 1:1 at 1x: resampling it would blur the text.
 */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { EXTENSION, expect, test } from "./fixtures";

const CONFIG = {
  name: "Creel",
  mark: "icons/icon-128.png",
  colors: {
    from: "#0f766e",
    to: "#042f2e",
    onColor: "#ffffff",
    page: "#f1f5f9",
    text: "#0f172a",
    muted: "#475569",
  },
  /** The popup's own size. The screenshot canvas is 800 tall, so keep 760 or less. */
  frame: { width: 360, height: 400 },
  tile: { headline: "Record API responses" },
  marquee: { headline: "Record a site's JSON API responses" },
};

const SITE = "https://www.example.com/";
const PAGE = `<!doctype html><title>Example Orders</title><body><h1>Orders</h1></body>`;
const CALLS = [
  "/api/orders",
  "/api/customers",
  "/api/products",
  "/api/invoices?page=1",
  "/api/inventory",
];

const OUT = path.resolve(
  process.env.STORE_DIR ??
    path.join(import.meta.dirname, "../store/screenshots"),
);
const { colors, frame } = CONFIG;

async function markUri() {
  const file = path.join(EXTENSION, CONFIG.mark);
  const type = file.endsWith(".svg") ? "image/svg+xml" : "image/png";
  return `data:${type};base64,${(await readFile(file)).toString("base64")}`;
}

const FONT = `font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;`;

async function capture(page: Page) {
  await page.setViewportSize(frame);
  await page.mouse.move(0, 0);
  const height = await page.evaluate(() => document.body.scrollHeight);
  expect(height, "popup taller than the frame").toBeLessThanOrEqual(
    frame.height,
  );
  return page.screenshot({
    clip: { x: 0, y: 0, width: frame.width, height },
  });
}

async function screenshot(
  canvas: Page,
  shot: Buffer,
  title: string,
  body: string,
  file: string,
) {
  await canvas.setViewportSize({ width: 1280, height: 800 });
  await canvas.setContent(`<!doctype html><html><head><style>
    * { box-sizing: border-box; }
    body { margin: 0; width: 1280px; height: 800px; display: flex; align-items: center; gap: 72px;
      padding: 0 96px; ${FONT} color: ${colors.text}; background: ${colors.page}; }
    .copy { flex: 1; }
    .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; font-size: 20px; font-weight: 600; }
    h1 { margin: 0 0 20px; font-size: 46px; line-height: 1.12; letter-spacing: -0.02em; }
    p { margin: 0; font-size: 21px; line-height: 1.5; color: ${colors.muted}; }
    .shot { flex: none; border-radius: 18px; overflow: hidden; box-shadow: 0 20px 50px rgb(0 0 0 / 0.18); }
    .shot img { display: block; }
  </style></head><body>
    <div class="copy"><div class="brand"><img src="${await markUri()}" width="30" alt="">${CONFIG.name}</div>
      <h1>${title}</h1><p>${body}</p></div>
    <div class="shot"><img src="data:image/png;base64,${shot.toString("base64")}" alt=""></div>
  </body></html>`);
  await canvas.screenshot({ path: path.join(OUT, file) });
}

// Tile rules: saturated color edge to edge, little text, legible at half size on
// the store's light gray page.
async function tile(
  canvas: Page,
  size: { width: number; height: number },
  style: string,
  html: string,
  file: string,
) {
  await canvas.setViewportSize(size);
  await canvas.setContent(`<!doctype html><html><head><style>
    * { box-sizing: border-box; }
    body { margin: 0; width: ${size.width}px; height: ${size.height}px; position: relative; overflow: hidden;
      ${FONT} color: ${colors.onColor};
      background: linear-gradient(135deg, ${colors.from}, ${colors.to} 85%); }
    .brand { display: flex; align-items: center; font-weight: 700; letter-spacing: -0.02em; }
    h1 { margin: 0; line-height: 1.04; letter-spacing: -0.035em; }
    ${style}
  </style></head><body>${html}</body></html>`);
  await canvas.screenshot({ path: path.join(OUT, file) });
}

test.skip(process.env.STORE !== "1", "STORE=1 only");
test.use({ grants: ["https://www.example.com/*"] });

test("store images", async ({ context, openPopup }) => {
  await mkdir(OUT, { recursive: true });
  await context.route(/^https:\/\/www\.example\.com\//, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/")) {
      const key = url.pathname.split("/").pop();
      return route.fulfill({
        json: {
          resource: key,
          items: [
            { id: 1, label: "Sample A" },
            { id: 2, label: "Sample B" },
          ],
          total: 2,
        },
      });
    }
    return route.fulfill({ contentType: "text/html", body: PAGE });
  });
  const canvas = await context.newPage();
  const site = await context.newPage();
  await site.goto(SITE);

  // 1: the first-run notice
  const popup = await openPopup(SITE);
  await expect(popup.locator("#consent")).toBeVisible();
  const notice = await capture(popup);
  await screenshot(
    canvas,
    notice,
    "Told what it keeps, before it records",
    "Creel says what it stores and where, and asks you to confirm.",
    "01-consent.png",
  );

  // 2: ready to record
  await popup.locator("#accept").click();
  await expect(popup.locator("#primary")).toBeEnabled();
  const idle = await capture(popup);
  await screenshot(
    canvas,
    idle,
    "Press Record on the site you are on",
    "Your browser asks to let Creel in, one site at a time.",
    "02-record.png",
  );

  // 3: recording, with real captures
  await popup.locator("#primary").click();
  await expect(popup.locator("#pill")).toContainText("REC");
  await site.reload();
  for (let i = 0; i < 12; i++) {
    const call = CALLS[i % CALLS.length]!;
    // oxlint-disable-next-line no-await-in-loop -- one call after another
    await site.evaluate((u) => fetch(u).then((r) => r.json()), call);
  }
  await expect(popup.locator("#stats")).toContainText("12 responses", {
    timeout: 10_000,
  });
  const rec = await capture(popup);
  await screenshot(
    canvas,
    rec,
    "Every JSON response, counted as it lands",
    "The popup counts live and lists the latest files.",
    "03-recording.png",
  );

  // 4: paused, ready to download
  await popup.locator("#primary").click();
  await expect(popup.locator("#pill")).toHaveText("Paused");
  await expect(popup.locator("#download")).toBeEnabled();
  const done = await capture(popup);
  await screenshot(
    canvas,
    done,
    "Download everything as one ZIP",
    "One JSON file per response, plus the list of requests behind them.",
    "04-download.png",
  );
  await popup.close();

  const mark = await markUri();
  await tile(
    canvas,
    { width: 440, height: 280 },
    `body { padding: 34px 32px; }
     .brand { gap: 10px; font-size: 22px; margin-bottom: 18px; }
     h1 { font-size: 38px; }`,
    `<div class="brand"><img src="${mark}" width="30" alt="">${CONFIG.name}</div>
     <h1>${CONFIG.tile.headline}</h1>`,
    "promo-small-440x280.png",
  );
  await tile(
    canvas,
    { width: 1400, height: 560 },
    `.copy { position: absolute; left: 96px; top: 0; bottom: 0; width: 700px;
       display: flex; flex-direction: column; justify-content: center; }
     .brand { gap: 16px; font-size: 38px; margin-bottom: 36px; }
     h1 { font-size: 56px; }
     .card { position: absolute; right: 96px; top: 56px; display: block;
       border-radius: 14px 14px 0 0; box-shadow: 0 20px 50px rgb(0 0 0 / 0.3); }`,
    `<div class="copy"><div class="brand"><img src="${mark}" width="54" alt="">${CONFIG.name}</div>
       <h1>${CONFIG.marquee.headline}</h1></div>
     <img class="card" src="data:image/png;base64,${rec.toString("base64")}" alt="">`,
    "promo-marquee-1400x560.png",
  );
});
