import type { CaptureInput, PageMessage } from "./types";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function isCaptureInput(value: unknown): value is CaptureInput {
  return (
    isObject(value) &&
    typeof value.url === "string" &&
    typeof value.method === "string" &&
    (value.body === null || typeof value.body === "string") &&
    typeof value.status === "number" &&
    typeof value.page === "string" &&
    typeof value.text === "string"
  );
}

/** A message posted by the page script, or null for anything else on the window. */
export function parsePageMessage(data: unknown): PageMessage | null {
  if (!isObject(data) || data.source !== "creel") {
    return null;
  }
  if (data.kind === "skipped" && typeof data.url === "string") {
    return data as PageMessage;
  }
  if (data.kind === "capture" && isCaptureInput(data.capture)) {
    return data as PageMessage;
  }
  return null;
}
