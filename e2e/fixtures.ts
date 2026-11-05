/**
 * Playwright fixtures: the built extension loaded into Playwright's Chromium (the one
 * build that still accepts --load-extension; it works headless). A tab stands in for the
 * popup, because Playwright cannot open the toolbar popup itself.
 *
 * Env: EXTENSION_DIR (default ../dist), VIDEO=1 captures at 6x for the promo video,
 *      HEADED=1 shows the window.
 */
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  test as base,
  chromium,
  type BrowserContext,
  type Page,
} from "@playwright/test";

export const EXTENSION = path.resolve(
  process.env.EXTENSION_DIR ?? path.join(import.meta.dirname, "../dist"),
);

interface Fixtures {
  /**
   * Hosts the test build may read without Chrome's prompt, which a headless run cannot
   * answer. Granted in a throwaway copy of dist/ under the OS temp directory: the
   * shipped build never holds them, and e2e/consent.spec.ts checks that.
   */
  grants: string[];
  context: BrowserContext;
  extensionId: string;
  /** Opens the popup as a tab; `tabUrl` stands in for the tab the popup sees. */
  openPopup: (tabUrl?: string) => Promise<Page>;
}

async function extensionDir(grants: string[]): Promise<{
  dir: string;
  cleanup: () => Promise<void>;
}> {
  if (grants.length === 0) {
    return { dir: EXTENSION, cleanup: () => Promise.resolve() };
  }
  const dir = await mkdtemp(path.join(os.tmpdir(), "creel-e2e-"));
  await cp(EXTENSION, dir, { recursive: true });
  const file = path.join(dir, "manifest.json");
  const manifest = JSON.parse(await readFile(file, "utf8"));
  manifest.host_permissions = grants;
  await writeFile(file, JSON.stringify(manifest, null, 2));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

export const test = base.extend<Fixtures>({
  grants: [[], { option: true }],

  context: async ({ grants }, use) => {
    const { dir, cleanup } = await extensionDir(grants);
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      headless: process.env.HEADED !== "1",
      viewport: { width: 420, height: 900 },
      // The video zooms into the UI at 4K: capture at 6x so no zoom stretches it.
      deviceScaleFactor: process.env.VIDEO === "1" ? 6 : 1,
      args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
    });
    await use(context);
    await context.close();
    await cleanup();
  },

  extensionId: async ({ context }, use) => {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent("serviceworker"));
    await use(new URL(worker.url()).host);
  },

  openPopup: async ({ context, extensionId }, use) => {
    await use(async (tabUrl) => {
      const page = await context.newPage();
      if (tabUrl !== undefined) {
        await page.addInitScript((url) => {
          chrome.tabs.query = (() =>
            Promise.resolve([
              { url, id: 1, active: true },
            ])) as unknown as typeof chrome.tabs.query;
        }, tabUrl);
      }
      await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
      return page;
    });
  },
});

export const { expect } = test;
