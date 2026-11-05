# Facts

Built from `src/` on feat/store-listing (after the same-site, consent and V2 publish changes; v0.1.0) and `node audit.mjs dist` (0 blockers, 0 warnings). Read 2026-11-05.

Single purpose (draft, awaiting Stop 1): **Record the JSON API responses a website's pages make while you browse it, and download them as one ZIP.**

## Features

| Feature                                                                                                               | Where in the code                                                                                     | Fits the single purpose?               |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------- |
| First-run notice with "I understand", before the first Record (versioned, stored by the worker)                       | `src/lib/consent.ts`, `src/popup/*`, `sw.ts` `consent`                                                | YES (discloses what the purpose keeps) |
| Record, Stop, and Record again on the same site (resume)                                                              | `src/background/sw.ts` `record`/`stop`, `src/lib/session.ts` `planRecord`                             | YES (the purpose itself)               |
| Per-site access prompt at Record (`chrome.permissions.request` for one origin)                                        | `src/popup/popup.ts`                                                                                  | YES (permission for the purpose)       |
| Wrap `fetch` and `XMLHttpRequest` in the page's MAIN world; keep same-site JSON object/array responses                | `src/capture/page.ts`, `wrap.ts`, `src/lib/same-site.ts` (worker), `src/lib/site.ts` (page prefilter) | YES                                    |
| Keep request URL, method, request body (text or URLSearchParams only), status, page URL, timestamp with each response | `wrap.ts`, `src/lib/db.ts`, `src/lib/zip.ts` (`_requests.json`)                                       | YES (the ZIP's index)                  |
| Start capturing in tabs already open on the site, no reload                                                           | `sw.ts` `injectInto`                                                                                  | YES                                    |
| Badge count; popup with REC clock, response count, size, latest 5 names                                               | `sw.ts` `setBadge`, `src/popup/*`                                                                     | YES                                    |
| Count responses over 32 MB as skipped                                                                                 | `wrap.ts` `MAX_BODY_CHARS`, `forward.ts`                                                              | YES                                    |
| Download ZIP (built in an offscreen document, saved to `Downloads/creel/`)                                            | `sw.ts` `download`, `src/offscreen/*`, `src/lib/zip.ts`                                               | YES                                    |
| Clear (delete the session and all captures)                                                                           | `sw.ts` `clear`, `src/lib/db.ts` `clearAll`                                                           | YES                                    |

No feature fails the sentence. Nothing to cut or split.

## Permissions

| Permission                  | Required or optional | Where used                                                                                   | Install warning                                                            |
| --------------------------- | -------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| activeTab                   | required             | popup reads the active tab's URL (`chrome.tabs.query`)                                       | none (audit: not searchable; the tab URL read in `popup.ts` depends on it) |
| storage                     | required             | `chrome.storage.local` (session, consent), `chrome.storage.session` (download id) in `sw.ts` | none                                                                       |
| unlimitedStorage            | required             | IndexedDB holds response bodies up to 32 MB each (`db.ts`)                                   | none                                                                       |
| scripting                   | required             | `registerContentScripts`, `executeScript` in `sw.ts`                                         | none                                                                       |
| downloads                   | required             | `chrome.downloads.download` in `sw.ts`                                                       | "Manage your downloads."                                                   |
| offscreen                   | required             | ZIP built in an offscreen document, reason BLOBS (`sw.ts`, `src/offscreen/`)                 | none                                                                       |
| `http://*/*`, `https://*/*` | optional host        | requested for one origin at a time in `popup.ts` when the user presses Record                | none at install; Chrome's own per-site prompt at Record                    |

Host access at install: none. Unknown: whether the dashboard shows the "broad host permissions, in-depth review" notice for optional `*://*/*`. Read it in the dashboard.

## Network

None. The extension makes no request of its own: no `fetch`, XHR, WebSocket or beacon in `src/` outside the page wrappers, which call the page's own original `fetch`. Verified by reading every file. No remote code (audit). The only bytes that leave the browser are the ZIP the user saves to disk.

| Destination | What is sent, and how | What triggers it | Who chose it |
| ----------- | --------------------- | ---------------- | ------------ |
| None        | None                  | None             | None         |

Note: captures travel from the page script to the relay by `window.postMessage(msg, location.origin)`, so any script on the recorded page can observe them. Those scripts already see the same responses.

## Data

Everything the extension reads, sends or stores, on the device included. Boxes stay `Undecided` until the owner decides after reading each tooltip.

| What is handled                                                                                                                                                                        | Where it goes                                                           | Shows which sites the user is on? | Store box | Why                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Response bodies (JSON objects or arrays) of the recorded site's same-site `fetch`/XHR calls, which on a logged-in site can hold personal, financial, authentication or message content | IndexedDB on the device until Clear; then the ZIP in `Downloads/creel/` | Yes (the site's own content)      | Undecided | Must be disclosed: Google's text covers data stored locally. Which box is a judgement (inference: website content, plus others by what the site returns) |
| Request URLs, including query strings, and the page URL of each capture                                                                                                                | IndexedDB, then `_requests.json` in the ZIP                             | Yes                               | Undecided | Must be disclosed. Google's text names "domains or URLs the browser interacts with" as web browsing activity; the box name is an inference               |
| Request bodies (text, URLSearchParams), which may include form data or credentials of the site's own calls                                                                             | IndexedDB, then `_requests.json`                                        | Weaker                            | Undecided | Must be disclosed. Box depends on what the site sends                                                                                                    |
| Method, HTTP status, capture time                                                                                                                                                      | IndexedDB, then `_requests.json`                                        | Weaker                            | Undecided | Metadata of the above; disclosed with them                                                                                                               |
| The recorded origin and session state (recording flag, start time, counts)                                                                                                             | `chrome.storage.local`, device only                                     | Yes (one site the user chose)     | Undecided | Must be disclosed; a site the user picked is weaker than a log of visits                                                                                 |
| Active tab URL, read when the popup opens                                                                                                                                              | Memory; shown in the popup; origin stored once the user presses Record  | Yes                               | Undecided | Same as the row above                                                                                                                                    |
| Download file name `creel/<host>-<date>.zip`                                                                                                                                           | Local disk                                                              | Yes                               | Undecided | Host name in a file name on the user's own disk                                                                                                          |

Stored unencrypted: IndexedDB and `chrome.storage.local` are not encrypted by the extension, and the ZIP is a plain file. Captures stay until the user presses Clear. No user data is placed in a URL by the extension (it makes no requests).

## Claims in README and manifest against the code

| Claim                                                                     | Code                                                                                                                                                                                                                  | Verdict                                                                                               |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| "Everything it captures stays on your machine" / "sends nothing anywhere" | No network code of its own                                                                                                                                                                                            | Supported. Say what is read and where it goes; avoid "no data collected"                              |
| "same-site JSON fetch/XHR"                                                | The page prefilter compares the last two labels; the worker then applies the public suffix list (tldts 7.4.19, private suffixes included) and drops the rest. Tested in `same-site.test.ts` and `e2e/capture.spec.ts` | Supported (was partly supported before commit "match same site by the public suffix list")            |
| A first-run notice precedes recording                                     | `consent.ts`, popup, worker ignores `record` without it; `e2e/consent.spec.ts`                                                                                                                                        | Supported                                                                                             |
| "Tabs already open start recording right away"                            | `injectInto`, `executeScript` with no `allFrames`                                                                                                                                                                     | Supported for the top frame only. Registered scripts also top frame only, so iframes are not recorded |
| "Chrome asks you to let Creel access it"                                  | `permissions.request` in `popup.ts`                                                                                                                                                                                   | Supported                                                                                             |
| "Responses larger than 32 MB are counted as skipped"                      | 33,554,432 characters (not bytes), and a Content-Length check                                                                                                                                                         | Supported, units are characters                                                                       |
| "Chrome 123+"                                                             | `minimum_chrome_version` "123"                                                                                                                                                                                        | Supported                                                                                             |
| Manifest "Record a site's API responses ... as one ZIP"                   | Only JSON objects/arrays, not binary or non-JSON                                                                                                                                                                      | Broad: say JSON                                                                                       |
| "request body" in the ZIP                                                 | Only string and URLSearchParams bodies; FormData, Blob and streams are not recorded                                                                                                                                   | Supported with that limit                                                                             |

## Dashboard wording

Not read. Names below are from memory and unverified.

| Box                                             | Tooltip, word for word | Read on  |
| ----------------------------------------------- | ---------------------- | -------- |
| Web history (candidate)                         | UNREAD                 | not read |
| Website content (candidate)                     | UNREAD                 | not read |
| Authentication information (candidate)          | UNREAD                 | not read |
| Personally identifiable information (candidate) | UNREAD                 | not read |
| Personal communications (candidate)             | UNREAD                 | not read |
