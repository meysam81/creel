import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

const icons = {
  "16": "icons/icon-16.png",
  "48": "icons/icon-48.png",
  "128": "icons/icon-128.png",
};

export default defineManifest({
  manifest_version: 3,
  name: "Creel",
  version: pkg.version,
  description:
    "Record a site's API responses as you browse, then download them as one ZIP.",
  minimum_chrome_version: "123",
  action: {
    default_popup: "src/popup/popup.html",
    default_icon: icons,
  },
  icons,
  background: {
    service_worker: "src/background/sw.ts",
    type: "module",
  },
  permissions: [
    "storage",
    "unlimitedStorage",
    "scripting",
    "downloads",
    "offscreen",
  ],
  optional_host_permissions: ["http://*/*", "https://*/*"],
});
