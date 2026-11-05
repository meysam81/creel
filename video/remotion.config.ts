import { readdirSync } from "node:fs";
import path from "node:path";
import { Config } from "@remotion/cli/config";

// PNG frames keep the UI text sharp; JPEG smears it before H.264 does.
Config.setVideoImageFormat("png");

// Remotion downloads a headless shell, which some systems cannot run. BROWSER_PATH
// picks any Chromium; PLAYWRIGHT_BROWSERS_PATH reuses Playwright's headless shell.
const browsers = process.env.PLAYWRIGHT_BROWSERS_PATH;
const shell =
  browsers &&
  readdirSync(browsers).find((d) => d.startsWith("chromium_headless_shell-"));
const browser =
  process.env.BROWSER_PATH ??
  (browsers && shell
    ? path.join(
        browsers,
        shell,
        "chrome-headless-shell-linux64/chrome-headless-shell",
      )
    : undefined);
if (browser) {
  Config.setBrowserExecutable(browser);
}
