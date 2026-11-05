# Store listing: Creel

Name and summary for Chrome and Edge live in `manifest.ts` (built into `dist/manifest.json`): changing them means a new package and a review.

Single purpose (Stop 1): **Record the JSON API responses a website's pages make while you browse it, and download them as one ZIP.**

Evidence: `store/evidence/keywords.md`. Facts: `store/facts.md`. Primary term: api recorder.

## Shared

### Category

```plaintext
Developer Tools
```

### Privacy policy URL

```plaintext
https://github.com/meysam81/creel#privacy
```

### Support

```plaintext
https://github.com/meysam81/creel/issues
```

### Name and summary (manifest, Chrome and Edge)

```plaintext
Name: Creel: API Response Recorder
Short name: Creel
Summary: Record a site's JSON API responses as you browse, then download them as one ZIP. Kept in your browser until you save.
```

## Chrome Web Store

### Description

```plaintext
Creel is an API response recorder. Open the page you want to study, press Record, and browse as usual. It keeps the JSON that the page fetches from its own servers, then hands you all of it as one ZIP.

What you get:
- One .json file per recorded response, named after the last part of its URL
- A _requests.json file listing the URL, method, request body, status and page behind each file
- A live count on the toolbar badge, and the latest captures in the popup
- Recording across as many tabs as you like
- Stop and carry on later: Record again resumes the same session
- Clear to delete everything that was stored

How it works:
1. Open the website and click the toolbar icon. The first time, a notice shows what Creel keeps and asks you to confirm.
2. Press Record. Chrome asks you to let it access that one website.
3. Browse as usual, then press Download ZIP.

It keeps fetch and XMLHttpRequest responses that are JSON objects or arrays and come from the same domain as the page: subdomains count, other domains do not. Binary files, other domains and embedded frames are not recorded.

Privacy: while you record, the responses, URLs and text request bodies of the website you chose are read. They can hold whatever the site returns, including personal data and credentials. All of it stays on your device until you download or clear it, and nothing is sent to any server. There is no account and no analytics, and the stored data is not encrypted. Full policy: https://github.com/meysam81/creel#privacy
```

### Single purpose

```plaintext
Record the JSON API responses a website's pages make while you browse it, and download them as one ZIP.
```

### Permission justifications

| Permission         | Justification                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeTab`        | Reads the address of the current tab when the popup opens, so Creel knows which site the Record button applies to.                          |
| `storage`          | Keeps the recording state, the site being recorded and the user's acceptance of the first-run notice on this device.                        |
| `unlimitedStorage` | Holds the recorded responses, up to 32 MB each, in the browser's database until the user downloads or clears them.                          |
| `scripting`        | Registers the recording scripts for the one site the user pressed Record on, and injects them into tabs of that site that are already open. |
| `downloads`        | Saves the ZIP the user asked for into the Downloads folder when they press Download ZIP.                                                    |
| `offscreen`        | Builds the ZIP in an offscreen document, because the extension's service worker cannot create the download URL.                             |
| Host permission    | Optional. Requested for one site at a time, when the user presses Record. Creel reads responses only on that site.                          |

### Remote code

```plaintext
No. All code ships in the package; Creel makes no network request of its own.
```

### Data usage

```plaintext
Tick five boxes (decided by the owner, 2026-11-05; reasons in store/facts.md):
- Website content: the response bodies of the recorded site
- User activity: recording fetch and XHR calls fits "network monitoring"
- Web history: request and page URLs with their capture times
- Authentication information: request bodies are kept unredacted, so a recorded login holds its credentials
- Personally identifiable information: names and email addresses in logged-in responses
Leave unticked: Personal communications, Health information, Financial and payment information, Location.
Certifications: tick all three. They stand: user data is not sold or transferred to third parties, not used for anything unrelated to the single purpose, and not used for creditworthiness or lending.
All of it stays on the device.
```

### Test instructions

```plaintext
No account needed. 1. Open https://jsonplaceholder.typicode.com/ and click the Creel icon, then press "I understand". 2. Press Record and allow access to the site. 3. In the page's DevTools console run: fetch('/todos/1').then(r => r.json()) . The badge shows 1. 4. Open the Creel popup and press Download ZIP: the ZIP in Downloads/creel/ holds todos-1... as 1.json and _requests.json. A fetch to another site (for example https://api.github.com/) is not recorded.
```

## Microsoft Edge Add-ons

### Description

```plaintext
Creel is an API response recorder. Open the page you want to study, press Record, and browse as usual. It keeps the JSON that the page fetches from its own servers, then hands you all of it as one ZIP.

What you get:
- One .json file per recorded response, named after the last part of its URL
- A _requests.json file listing the URL, method, request body, status and page behind each file
- A live count on the toolbar badge, and the latest captures in the popup
- Recording across as many tabs as you like
- Stop and carry on later: Record again resumes the same session
- Clear to delete everything that was stored

How it works:
1. Open the website and click the toolbar icon. The first time, a notice shows what Creel keeps and asks you to confirm.
2. Press Record. Your browser asks you to let it access that one website.
3. Browse as usual, then press Download ZIP.

It keeps fetch and XMLHttpRequest responses that are JSON objects or arrays and come from the same domain as the page: subdomains count, other domains do not. Binary files, other domains and embedded frames are not recorded.

Privacy: while you record, the responses, URLs and text request bodies of the website you chose are read. They can hold whatever the site returns, including personal data and credentials. All of it stays on your device until you download or clear it, and nothing is sent to any server. There is no account and no analytics, and the stored data is not encrypted. Full policy: https://github.com/meysam81/creel#privacy
```

### Notes for certification

```plaintext
No account needed. 1. Open https://jsonplaceholder.typicode.com/, click the Creel icon and press "I understand" (the first-run consent screen). 2. Press Record and allow access to the site. 3. In the page's DevTools console run: fetch('/todos/1').then(r => r.json()) . The badge shows 1. 4. Press Download ZIP in the popup. Requests to other sites are not recorded.
```

## Firefox AMO

Not submittable yet: Creel has no Firefox build. It needs `browser_specific_settings.gecko.id` and `data_collection_permissions` (required: `browsingActivity`, `websiteContent` are the likely values), `background.scripts` instead of a service worker, and a replacement for the `offscreen` API, which Firefox does not provide. AMO also wants the source and build steps for bundled code. The text below is ready for when that build exists.

### Name

```plaintext
Creel: API Response Recorder
```

### Summary

```plaintext
Record a site's JSON API responses as you browse, then download them as one ZIP. Kept in your browser until you save.
```

### Description

```plaintext
Creel is an API response recorder. Press Record on a website and browse as usual: it keeps the JSON that the page fetches from its own servers, and gives you all of it as one ZIP.

- One .json file per response, plus _requests.json with the URL, method, request body, status and page behind each
- Same-domain responses only: subdomains count, other domains do not
- Stop and resume, a live count, and Clear

Data: while you record, the responses, URLs and text request bodies of the website you chose are read. They can hold whatever the site returns, including personal data and credentials. All of it stays on the device until you download or clear it, and is not transmitted anywhere. They are not encrypted. Policy: https://github.com/meysam81/creel#privacy
```

### Reviewer notes

```plaintext
Build: bun install --frozen-lockfile && bun run build (needs a Firefox build target first: none exists yet). Test: open https://jsonplaceholder.typicode.com/, accept the first-run notice, press Record, run fetch('/todos/1').then(r => r.json()) in the console, then Download ZIP.
```
