import { readFile } from "node:fs/promises";
import path from "node:path";
import { EXTENSION, expect, test } from "./fixtures";

const SITE = "https://www.example.com/";

test("the shipped build asks for no host access at install", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(EXTENSION, "manifest.json"), "utf8"),
  );
  expect(manifest.host_permissions).toBeUndefined();
  expect(manifest.optional_host_permissions).toEqual([
    "http://*/*",
    "https://*/*",
  ]);
});

test("the first-run notice comes before Record, and the choice is remembered", async ({
  openPopup,
}) => {
  const popup = await openPopup(SITE);
  await expect(popup.locator("#consent")).toBeVisible();
  await expect(popup.locator("#consent-text")).toContainText(
    "Creel keeps the JSON responses a site makes while you record it",
  );
  await expect(popup.locator("#actions")).toBeHidden();

  // a record command without the notice accepted does nothing
  const session = await popup.evaluate(async () => {
    await chrome.runtime.sendMessage({
      type: "record",
      origin: "https://www.example.com",
    });
    return (await chrome.storage.local.get("session")).session;
  });
  expect(session).toBeUndefined();

  await popup.locator("#accept").click();
  await expect(popup.locator("#consent")).toBeHidden();
  await expect(popup.locator("#primary")).toBeEnabled();

  const again = await openPopup(SITE);
  await expect(again.locator("#primary")).toBeEnabled();
  await expect(again.locator("#consent")).toBeHidden();
});
