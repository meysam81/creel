import { openDb, readStats } from "../lib/db";
import { recordableOrigin } from "../lib/site";
import type { Command, Session } from "../lib/types";
import { COPY, deriveView, statsLine, type PopupView } from "./state";

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const ui = {
  pill: byId("pill"),
  origin: byId("origin"),
  stats: byId("stats"),
  recent: byId<HTMLOListElement>("recent"),
  primary: byId<HTMLButtonElement>("primary"),
  download: byId<HTMLButtonElement>("download"),
  clear: byId<HTMLButtonElement>("clear"),
  message: byId("message"),
};

const dbReady = openDb();
let tabUrl: string | undefined;
let session: Session | null = null;
let view: PopupView | null = null;
let notice: string | null = null;
let timer: ReturnType<typeof setInterval> | undefined;

const pad = (n: number) => String(n).padStart(2, "0");

function elapsed(startedAt: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  return `${Math.floor(seconds / 60)}:${pad(seconds % 60)}`;
}

function clock(iso: string): string {
  const at = new Date(iso);
  return `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`;
}

function renderPill(): void {
  const state = view?.pill ?? "none";
  ui.pill.dataset.state = state;
  ui.pill.hidden = state === "none";
  if (state === "rec" && session) {
    ui.pill.textContent = `REC ${elapsed(session.startedAt)}`;
  } else if (state === "paused") {
    ui.pill.textContent = "Paused";
  }
}

function recentRow(name: string, capturedAt: string): HTMLLIElement {
  const row = document.createElement("li");
  const label = document.createElement("span");
  label.className = "name";
  label.textContent = name;
  const time = document.createElement("span");
  time.className = "time";
  time.textContent = clock(capturedAt);
  row.append(label, time);
  return row;
}

async function render(): Promise<void> {
  const [{ session: stored }, stats] = await Promise.all([
    chrome.storage.local.get("session"),
    dbReady.then(readStats),
  ]);
  session = (stored as Session | undefined) ?? null;
  view = deriveView({ session, stats, tabUrl });

  renderPill();
  ui.origin.textContent = view.origin ?? "";
  ui.origin.hidden = view.origin === null;
  ui.stats.textContent = statsLine(stats);
  ui.stats.hidden = session === null;
  ui.recent.replaceChildren(
    ...stats.recent.map((r) => recentRow(r.name, r.capturedAt)),
  );
  ui.primary.textContent = view.primary === "stop" ? "Stop" : "Record";
  ui.primary.dataset.action = view.primary;
  ui.primary.disabled = view.primaryDisabled;
  ui.download.textContent = view.downloadLabel;
  ui.download.disabled = view.downloadDisabled;
  ui.clear.disabled = view.clearDisabled;
  ui.message.textContent = notice ?? view.message ?? "";

  if (view.pill === "rec" && timer === undefined) {
    timer = setInterval(renderPill, 1000);
  } else if (view.pill !== "rec" && timer !== undefined) {
    clearInterval(timer);
    timer = undefined;
  }
}

function send(command: Command): Promise<unknown> {
  return chrome.runtime.sendMessage(command).catch(() => undefined);
}

ui.primary.addEventListener("click", async () => {
  notice = null;
  if (view?.primary === "stop") {
    await send({ type: "stop" });
    return;
  }
  const origin = recordableOrigin(tabUrl);
  if (!origin) {
    return;
  }
  // must run inside the click: Chrome only shows the access prompt for a user gesture
  const granted = await chrome.permissions
    .request({ origins: [`${origin}/*`] })
    .catch(() => false);
  if (!granted) {
    notice = COPY.denied(origin);
    await render();
    return;
  }
  await send({ type: "record", origin });
});

ui.download.addEventListener("click", () => send({ type: "download" }));
ui.clear.addEventListener("click", () => send({ type: "clear" }));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "session" in changes) {
    render().catch(() => undefined);
  }
});

chrome.runtime.onMessage.addListener((msg: { type?: string }) => {
  if (msg.type === "changed") {
    render().catch(() => undefined);
  }
  return false;
});

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
tabUrl = tab?.url;
await render();
