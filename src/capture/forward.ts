import { parsePageMessage } from "../lib/messages";
import type { WorkerMessage } from "../lib/types";

export interface RelayDeps {
  send(msg: WorkerMessage): Promise<unknown>;
  /** False once the extension was reloaded or removed (its runtime id is gone). */
  alive(): boolean;
  stop(): void;
}

/**
 * Forward page messages to the worker. Only a dead extension context stops the relay;
 * a transient send failure drops that one message, and one too large to send counts as skipped.
 */
export function makeRelay(deps: RelayDeps): (data: unknown) => void {
  return (data) => {
    const msg = parsePageMessage(data);
    if (!msg) {
      return;
    }
    const out: WorkerMessage =
      msg.kind === "capture"
        ? { type: "capture", capture: msg.capture }
        : { type: "skipped" };
    const lost = (tooLarge: boolean) => {
      if (!deps.alive()) {
        deps.stop();
      } else if (tooLarge && out.type === "capture") {
        deps.send({ type: "skipped" }).catch(() => undefined);
      }
    };
    try {
      deps.send(out).catch(() => lost(false));
    } catch {
      // a synchronous throw is Chrome refusing the message itself (too large) or a dead context
      lost(true);
    }
  };
}
