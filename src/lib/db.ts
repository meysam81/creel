import { baseName, claimName } from "./names";
import {
  emptyStats,
  type Capture,
  type CaptureInput,
  type Stats,
} from "./types";

const CAPTURES = "captures";
const META = "meta";
const STATS_KEY = "stats";

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.addEventListener("complete", () => resolve());
    tx.addEventListener("error", () => reject(tx.error));
    tx.addEventListener("abort", () =>
      reject(tx.error ?? new Error("transaction aborted")),
    );
  });
}

/** The extension's database: `captures` (auto-increment keys, capture order) and `meta` (stats). */
export function openDb(): Promise<IDBDatabase> {
  const request = indexedDB.open("creel", 1);
  request.addEventListener("upgradeneeded", () => {
    request.result.createObjectStore(CAPTURES, { autoIncrement: true });
    request.result.createObjectStore(META);
  });
  return result(request);
}

/** One readwrite transaction over both stores, so a name is never handed out twice. */
async function update(
  db: IDBDatabase,
  write: (stats: Stats, captures: IDBObjectStore) => void,
): Promise<Stats> {
  const tx = db.transaction([CAPTURES, META], "readwrite");
  const done = finished(tx);
  const meta = tx.objectStore(META);
  const stats =
    ((await result(meta.get(STATS_KEY))) as Stats | undefined) ?? emptyStats();
  write(stats, tx.objectStore(CAPTURES));
  meta.put(stats, STATS_KEY);
  await done;
  return stats;
}

export function addCapture(
  db: IDBDatabase,
  input: CaptureInput,
  now: Date,
): Promise<Stats> {
  return update(db, (stats, captures) => {
    const name = claimName(baseName(input.url), stats.names);
    const capturedAt = now.toISOString();
    const row: Capture = { ...input, name, capturedAt };
    captures.add(row);
    stats.count += 1;
    // ponytail: UTF-16 length, not bytes; close enough for a size hint
    stats.bytes += input.text.length;
    stats.recent = [{ name, capturedAt }, ...stats.recent].slice(0, 5);
  });
}

export function addSkipped(db: IDBDatabase): Promise<Stats> {
  return update(db, (stats) => {
    stats.skipped += 1;
  });
}

export async function readStats(db: IDBDatabase): Promise<Stats> {
  const tx = db.transaction(META);
  const stats = (await result(tx.objectStore(META).get(STATS_KEY))) as
    Stats | undefined;
  return stats ?? emptyStats();
}

/** Captures in capture order, read in short transactions so a slow reader never outlives one. */
export async function* iterateCaptures(
  db: IDBDatabase,
  batch = 25,
): AsyncGenerator<Capture> {
  let after: IDBValidKey | undefined;
  for (;;) {
    const store = db.transaction(CAPTURES).objectStore(CAPTURES);
    const range =
      after === undefined ? undefined : IDBKeyRange.lowerBound(after, true);
    // oxlint-disable-next-line no-await-in-loop -- batches are read one after another on purpose
    const [values, keys] = await Promise.all([
      result(store.getAll(range, batch)),
      result(store.getAllKeys(range, batch)),
    ]);
    if (values.length === 0) {
      return;
    }
    yield* values as Capture[];
    after = keys.at(-1);
  }
}

export function clearAll(db: IDBDatabase): Promise<void> {
  const tx = db.transaction([CAPTURES, META], "readwrite");
  tx.objectStore(CAPTURES).clear();
  tx.objectStore(META).clear();
  return finished(tx);
}
