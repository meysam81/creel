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

Everything the extension reads, sends or stores, on the device included. The boxes below were decided by the owner on 2026-11-05 after reading the descriptions under "Dashboard wording".

| What is handled                                                                             | Where it goes                                                           | Shows which sites the user is on? | Store box                                            | Why                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Response bodies (JSON objects or arrays) of the recorded site's same-site `fetch`/XHR calls | IndexedDB on the device until Clear; then the ZIP in `Downloads/creel/` | Yes (the site's own content)      | Website content; Personally identifiable information | Must be disclosed. Owner decision 2026-11-05: the bodies are page content, and on a logged-in site they hold names and email addresses                                                      |
| Request URLs, including query strings, and the page URL of each capture, with capture time  | IndexedDB, then `_requests.json` in the ZIP                             | Yes                               | Web history                                          | Must be disclosed. Owner decision: the form describes Web history as pages visited with associated data such as title and time of visit, which the URL list with its times fits (inference) |
| Request bodies (text, URLSearchParams), unredacted                                          | IndexedDB, then `_requests.json`                                        | Weaker                            | Authentication information                           | Must be disclosed. Owner decision: a recorded login holds the password or token that was sent                                                                                               |
| Method, HTTP status, capture time                                                           | IndexedDB, then `_requests.json`                                        | Weaker                            | User activity                                        | Must be disclosed. Owner decision: recording fetch and XHR fits the box's own example, "network monitoring"                                                                                 |
| The recorded origin and session state (recording flag, start time, counts)                  | `chrome.storage.local`, device only                                     | Yes (one site the user chose)     | Web history                                          | Must be disclosed; covered by the Web history box with the URLs                                                                                                                             |
| Active tab URL, read when the popup opens                                                   | Memory; shown in the popup; origin stored once the user presses Record  | Yes                               | Web history                                          | Same as the row above                                                                                                                                                                       |
| Download file name `creel/<host>-<date>.zip`                                                | Local disk                                                              | Yes                               | Web history                                          | Host name in a file name on the user's own disk; no extra box                                                                                                                               |

Boxes left unticked by the owner's decision: Personal communications, Health information, Financial and payment information, Location. Creel cannot know what a recorded site returns, so a response can hold these too; the README and the consent notice say it holds "whatever the site returns". The three certifications all stand.

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

Read from the dashboard form on 2026-11-05 (sent by the owner). The form is not a tooltip: each box has its description beside it.

Heading: "What user data do you plan to collect from users now or in the future?" The form says the answer "will be displayed publicly on the item detail page", and that by publishing you certify the disclosures "reflect the most up-to-date content of your privacy policy."

| Box                                 | Description beside the box, word for word                                                                 | Read on    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------- |
| Personally identifiable information | For example: name, address, email address, age, or identification number                                  | 2026-11-05 |
| Health information                  | For example: heart rate data, medical history, symptoms, diagnoses, or procedures                         | 2026-11-05 |
| Financial and payment information   | For example: transactions, credit card numbers, credit ratings, financial statements, or payment history  | 2026-11-05 |
| Authentication information          | For example: passwords, credentials, security question, or personal identification number (PIN)           | 2026-11-05 |
| Personal communications             | For example: emails, texts, or chat messages                                                              | 2026-11-05 |
| Location                            | For example: region, IP address, GPS coordinates, or information about things near the user's device      | 2026-11-05 |
| Web history                         | The list of web pages a user has visited, as well as associated data such as page title and time of visit | 2026-11-05 |
| User activity                       | For example: network monitoring, clicks, mouse position, scroll, or keystroke logging                     | 2026-11-05 |
| Website content                     | For example: text, images, sounds, videos, or hyperlinks                                                  | 2026-11-05 |

Certifications, all three required: "I do not sell or transfer user data to third parties, outside of the approved use cases"; "I do not use or transfer user data for purposes that are unrelated to my item's single purpose"; "I do not use or transfer user data to determine creditworthiness or for lending purposes".

Decision (owner, 2026-11-05): tick Website content, User activity, Web history, Authentication information, Personally identifiable information. Reasons per row in the Data table. Earlier candidates: User activity names "network monitoring", which is what a fetch and XHR recorder does; Web history (request and page URLs, with time); Website content (response bodies); Authentication information, Personally identifiable information, Personal communications and Financial and payment information only if the recorded site's responses carry them, which Creel cannot know.
