# Creel

Record a site's JSON API responses while you browse, then download them as one
ZIP. Creel is a Chrome extension (Manifest V3). What it records stays in your
browser until you download or clear it: see [Privacy](#privacy).

## Use it

1. Open the site you want to record and click the Creel icon. The first time,
   Creel shows what it keeps and asks you to press **I understand**.
2. Press **Record**. The first time on a site, Chrome asks you to let Creel
   access it. Tabs of that site that are already open start recording right
   away.
3. Browse as usual, in as many tabs of that site as you like. The badge counts
   the captured responses.
4. Press **Stop** to pause. **Record** on the same site carries on with the same
   session.
5. Press **Download ZIP** whenever you like. **Clear** deletes the session.

The ZIP holds one folder: a `.json` file per response, named after the last
part of its URL (repeats become `name-2.json`, `name-3.json`, ...), and
`_requests.json`, which lists the URL, method, request body, status and page
behind each file.

## What gets captured

`fetch` and `XMLHttpRequest` responses in the recorded site's pages (the top
frame of each tab, not embedded frames), when the request goes to the same site
and the body is a JSON object or array. Same site means the same registrable
domain under the [public suffix list](https://publicsuffix.org/), so
`api.example.co.uk` matches `shop.example.co.uk` but not `other.co.uk`, and
`a.github.io` does not match `b.github.io`. Request bodies are kept when they are
text. Responses larger than 32 MB are counted as skipped.

## Privacy

Last updated 2026-11-05. Creel is published by Developer Friendly OÜ.

**What Creel handles.** Only while you press Record on a site, Creel reads the
JSON responses that the pages of that site receive from the same site. For each
one it keeps the response body, the request URL (query string included), the
request method, the request body when it is text, the status, the address of the
page that made the request, and the time. It also keeps the site you chose and
the state of the recording. A response or a request body can hold whatever the
site returns or sends, including personal data (names, email addresses) and
credentials (a recorded login holds the password or token that was sent). Creel
does not look inside them, redact them or pick anything out.

**What it is used for.** Only to build the ZIP you ask for, and to show a count
and the latest file names in the popup. Nothing else uses it.

**Where it goes.** Nowhere. Creel makes no network request of its own, has no
account, no analytics and no server. All of it stays on your device, in your browser's
extension storage (IndexedDB and `chrome.storage`), until you press **Clear**.
The ZIP is saved to your Downloads folder, in `creel/`, when you press
**Download ZIP**. Creel does not encrypt the stored data or the ZIP: anyone with
access to your browser profile or to the file can read it. What you do with the
ZIP is up to you.

**Permissions.** Creel asks Chrome for access to one site at a time, when you
press Record. Without that access it reads nothing.

**Consent.** Before your first recording the popup tells you what Creel keeps
and asks you to press **I understand**. Chrome also asks you to let Creel
access the site.

**How to delete it.** Press **Clear** in the popup to delete the recorded
responses. Delete the ZIP files from `Downloads/creel/` yourself. Removing the
extension deletes everything Creel stores in the browser.

**Limited Use.** Creel's use of information it receives from the sites you
record adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq),
including the Limited Use requirements. It is used only to provide Creel's
single purpose, recording a site's JSON API responses and downloading them as a
ZIP. It is not transferred to anyone, not used or transferred for advertising,
not sold, and no person at Creel reads it, because it never leaves your device.

**Contact.** Questions, or a request about your data: open an issue at
<https://github.com/meysam81/creel/issues> or write to
contact@developer-friendly.blog.

## Releases

`.github/workflows/ci.yml` checks every PR and push (lint, types, unit tests,
build, Playwright e2e, PR title) and ends in one **required checks** status.
release-please opens the release PR and attaches `creel.zip` to each release once `CHROME_EXTENSION_ID` is set. It
never publishes. To send a release to the Chrome Web Store, run the **publish**
workflow by hand with the release tag; tick `submit` only to submit it for
review (the environment `chrome-web-store` can require a reviewer). It needs the
variables `CHROME_PUBLISHER_ID` and `CHROME_EXTENSION_ID` and the secrets
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REFRESH_TOKEN`. The
Web Store listing itself is edited by hand in the dashboard.

## Build from source

```sh
bun install
just dist
```

Then open `chrome://extensions`, turn on Developer mode, and **Load unpacked**
the `dist/` folder.

## License

[Apache-2.0](LICENSE)
