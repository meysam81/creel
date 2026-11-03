# Creel

Record a site's API responses while you browse, then download them as one ZIP.
Creel is a Chrome extension (Manifest V3). Everything it captures stays on your
machine.

## Use it

1. Open the site you want to record and click the Creel icon.
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

`fetch` and `XMLHttpRequest` responses in the recorded site's pages, when the
request goes to the same site and the body is a JSON object or array. Responses
larger than 32 MB are counted as skipped. Creel sends nothing anywhere: the
captures stay in your browser until you download or clear them.

## Build from source

```sh
bun install
just dist
```

Then open `chrome://extensions`, turn on Developer mode, and **Load unpacked**
the `dist/` folder.

## License

[Apache-2.0](LICENSE)
