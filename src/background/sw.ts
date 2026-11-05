// Service worker: the only writer. Owns the session, the capture scripts, IndexedDB, the badge and the download.
import { addCapture, addSkipped, clearAll, openDb, readStats } from "../lib/db";
import { acceptCapture } from "../lib/accept";
import { zipBase } from "../lib/names";
import {
  needsRegister,
  orphanedZip,
  planRecord,
  startSession,
} from "../lib/session";
import type {
  CaptureInput,
  Command,
  OffscreenMessage,
  Session,
  WorkerMessage,
  ZipReply,
} from "../lib/types";

/** The badge API takes no CSS variables; matches --color-rec (light). */
const BADGE_COLOR = "#dc2626";
/** Built as classic IIFE files by the `build` script, so nothing is web-accessible. */
const PAGE_JS = "capture/page.js";
const RELAY_JS = "capture/relay.js";
const SCRIPT_IDS = ["creel-relay", "creel-page"];
const OFFSCREEN_URL = "src/offscreen/offscreen.html";

let dbPromise: Promise<IDBDatabase> | undefined;
const db = () => (dbPromise ??= openDb());

async function getSession(): Promise<Session | null> {
  const { session } = await chrome.storage.local.get("session");
  return (session as Session | undefined) ?? null;
}

async function setSession(session: Session | null): Promise<void> {
  if (session) {
    await chrome.storage.local.set({ session });
  } else {
    await chrome.storage.local.remove("session");
  }
}

async function setBadge(count: number | null): Promise<void> {
  await chrome.action.setBadgeText({
    text: count === null ? "" : String(count),
  });
}

async function unregister(): Promise<void> {
  const registered = await chrome.scripting.getRegisteredContentScripts({
    ids: SCRIPT_IDS,
  });
  if (registered.length > 0) {
    await chrome.scripting.unregisterContentScripts({
      ids: registered.map((s) => s.id),
    });
  }
}

/** (Re)register both capture scripts for the origin, replacing any earlier registration. */
async function register(origin: string): Promise<void> {
  await unregister();
  const matches = [`${origin}/*`];
  await chrome.scripting.registerContentScripts([
    {
      id: "creel-relay",
      js: [RELAY_JS],
      matches,
      runAt: "document_start",
      persistAcrossSessions: true,
    },
    {
      id: "creel-page",
      js: [PAGE_JS],
      matches,
      runAt: "document_start",
      world: "MAIN",
      persistAcrossSessions: true,
    },
  ]);
}

/** Start capturing in tabs that are already open on the origin, without a reload. */
async function injectInto(origin: string, withPage: boolean): Promise<void> {
  const tabs = await chrome.tabs.query({ url: `${origin}/*` });
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id === undefined) {
        return;
      }
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [RELAY_JS],
        });
        if (withPage) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: [PAGE_JS],
            world: "MAIN",
          });
        }
      } catch {
        // the tab closed or can't be scripted; new loads are covered by registration
      }
    }),
  );
}

async function record(origin: string): Promise<void> {
  const session = await getSession();
  const stats = await readStats(await db());
  const plan = planRecord(session, stats.count, origin);
  if (plan === "blocked") {
    return; // captures from another origin are pending
  }
  if (plan === "fresh") {
    await clearAll(await db());
  }
  await register(origin);
  await setSession(
    startSession(
      session,
      plan,
      origin,
      Date.now(),
      chrome.runtime.getManifest().version,
    ),
  );
  await injectInto(origin, true);
  await setBadge(plan === "resume" ? stats.count : 0);
}

async function stop(error: Session["error"] = null): Promise<void> {
  await unregister();
  await setBadge(null);
  const session = await getSession();
  if (session) {
    await setSession({
      ...session,
      recording: false,
      error: error ?? session.error,
    });
  }
}

async function clear(): Promise<void> {
  const session = await getSession();
  if (session?.recording || session?.zipping) {
    return;
  }
  await clearAll(await db());
  await setSession(null);
}

async function capture(
  input: CaptureInput | null,
  requestUrl: string,
  senderOrigin: string | undefined,
): Promise<void> {
  if (!acceptCapture(await getSession(), senderOrigin, requestUrl)) {
    return;
  }
  try {
    const stats = input
      ? await addCapture(await db(), input, new Date())
      : await addSkipped(await db());
    await setBadge(stats.count);
  } catch {
    await stop("storage");
  }
}

interface ActiveDownload {
  id: number;
  url: string;
}

async function finishDownload(ok: boolean): Promise<void> {
  const { download: stored } = await chrome.storage.session.get("download");
  const active = stored as ActiveDownload | undefined;
  if (active) {
    const revoke: OffscreenMessage = {
      type: "offscreen-revoke",
      url: active.url,
    };
    await chrome.runtime.sendMessage(revoke).catch(() => undefined);
    await chrome.storage.session.remove("download");
  }
  if (await chrome.offscreen.hasDocument()) {
    await chrome.offscreen.closeDocument();
  }
  const session = await getSession();
  if (session) {
    await setSession({
      ...session,
      zipping: false,
      error: ok ? null : "download",
    });
  }
}

async function download(): Promise<void> {
  const session = await getSession();
  if (!session || session.zipping) {
    return;
  }
  await setSession({ ...session, zipping: true, error: null });
  try {
    if (!(await chrome.offscreen.hasDocument())) {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: [chrome.offscreen.Reason.BLOBS],
        justification: "Build the ZIP of captured responses",
      });
    }
    const base = zipBase(session.origin, new Date());
    const ask: OffscreenMessage = { type: "offscreen-zip", base };
    const reply = (await chrome.runtime.sendMessage(ask)) as ZipReply;
    if ("error" in reply) {
      throw new Error(reply.error);
    }
    const id = await chrome.downloads.download({
      url: reply.url,
      filename: `creel/${base}.zip`,
      conflictAction: "uniquify",
      saveAs: false,
    });
    const active: ActiveDownload = { id, url: reply.url };
    await chrome.storage.session.set({ download: active });
  } catch {
    await finishDownload(false);
  }
}

/** Make registration, badge and flags match the stored session (browser start, extension update). */
async function reconcile(updated: boolean): Promise<void> {
  const session = await getSession();
  if (!session?.recording) {
    await unregister();
    return;
  }
  // scripts persist across restarts; re-registering would open a window in which restored tabs load uncaptured
  const registered = await chrome.scripting.getRegisteredContentScripts({
    ids: SCRIPT_IDS,
  });
  if (needsRegister(registered, session.origin)) {
    await register(session.origin);
  }
  if (updated) {
    await injectInto(session.origin, false);
  }
  await setBadge((await readStats(await db())).count);
}

function commandTask(command: Command): () => Promise<void> {
  switch (command.type) {
    case "record": {
      return () => record(command.origin);
    }
    case "stop": {
      return () => stop();
    }
    case "clear": {
      return clear;
    }
    default: {
      return download;
    }
  }
}

// Every state change runs one at a time, then tells an open popup to re-render.
let queue: Promise<void> = Promise.resolve();
function enqueue(task: () => Promise<void>): Promise<void> {
  queue = queue
    .then(task)
    .catch(() => undefined)
    .then(() => chrome.runtime.sendMessage({ type: "changed" }))
    .then(
      () => undefined,
      () => undefined,
    );
  return queue;
}

// A worker that starts while a ZIP was being built lost it: end the download as failed.
enqueue(async () => {
  const { download: stored } = await chrome.storage.session.get("download");
  if (orphanedZip(await getSession(), stored)) {
    await finishDownload(false);
  }
});

chrome.action
  .setBadgeBackgroundColor({ color: BADGE_COLOR })
  .catch(() => undefined);

chrome.runtime.onStartup.addListener(() => {
  enqueue(() => reconcile(false));
});

chrome.runtime.onInstalled.addListener((details) => {
  enqueue(() => reconcile(details.reason === "update"));
});

chrome.downloads.onChanged.addListener((delta) => {
  const state = delta.state?.current;
  if (state !== "complete" && state !== "interrupted") {
    return;
  }
  enqueue(async () => {
    const { download: stored } = await chrome.storage.session.get("download");
    if ((stored as ActiveDownload | undefined)?.id === delta.id) {
      await finishDownload(state === "complete");
    }
  });
});

chrome.runtime.onMessage.addListener(
  (msg: WorkerMessage, sender, sendResponse) => {
    let task: (() => Promise<void>) | null = null;
    if (msg.type === "capture") {
      task = () => capture(msg.capture, msg.capture.url, sender.origin);
    } else if (msg.type === "skipped") {
      task = () => capture(null, msg.url, sender.origin);
    } else if (sender.url?.startsWith(chrome.runtime.getURL(""))) {
      // commands come only from extension pages (the popup), never from a content script
      task = commandTask(msg);
    }
    if (!task) {
      return false;
    }
    enqueue(task).then(
      () => sendResponse({ ok: true }),
      () => undefined,
    );
    return true;
  },
);
