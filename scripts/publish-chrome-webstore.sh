#!/usr/bin/env bash
# Uploads a package to the existing Creel Chrome Web Store item through API V2 and,
# only when asked, submits it for review. The API cannot create an item or edit a
# listing, so the first upload and every listing change are manual. CI never runs
# this on its own: .github/workflows/publish.yml is started by hand.
#
# Usage: bash scripts/publish-chrome-webstore.sh <creel.zip | creel.crx>
# Env:   CHROME_PUBLISHER_ID CHROME_EXTENSION_ID, plus either
#        CWS_ACCESS_TOKEN (for example from a service account), or
#        GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_REFRESH_TOKEN.
#        PUBLISH=true submits for review; otherwise this only uploads.
#        PUBLISH_TYPE=STAGED_PUBLISH holds an approved version for you to release.
# Needs: curl, jq.
set -euo pipefail

pkg=${1:?usage: publish-chrome-webstore.sh <package>}
if [ ! -f "$pkg" ]; then
  echo "::error::package not found: $pkg" >&2
  exit 1
fi

for tool in curl jq; do
  if ! command -v "$tool" >/dev/null; then
    echo "::error::$tool is not installed" >&2
    exit 1
  fi
done

required=(CHROME_PUBLISHER_ID CHROME_EXTENSION_ID)
if [ -z "${CWS_ACCESS_TOKEN:-}" ]; then
  required+=(GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_REFRESH_TOKEN)
fi
for v in "${required[@]}"; do
  if [ -z "${!v:-}" ]; then
    echo "::error::$v is not set" >&2
    exit 1
  fi
done

api=https://chromewebstore.googleapis.com
item="publishers/${CHROME_PUBLISHER_ID}/items/${CHROME_EXTENSION_ID}"
body=$(mktemp)
trap 'rm -f "$body"' EXIT

# call <what> <curl args...>: the response body on stdout; on an HTTP error the
# body (Google's error message) goes to the log before failing.
call() {
  local what=$1
  shift
  if ! curl -sS --fail-with-body -o "$body" "$@"; then
    echo "::error::$what failed: $(cat "$body")" >&2
    exit 1
  fi
  cat "$body"
}

token=${CWS_ACCESS_TOKEN:-}
if [ -z "$token" ]; then
  token=$(call "OAuth token refresh" \
    -d client_id="$GOOGLE_CLIENT_ID" \
    -d client_secret="$GOOGLE_CLIENT_SECRET" \
    -d refresh_token="$GOOGLE_REFRESH_TOKEN" \
    -d grant_type=refresh_token \
    https://oauth2.googleapis.com/token | jq -er .access_token)
fi
if [ -n "${GITHUB_ACTIONS:-}" ]; then
  echo "::add-mask::$token"
fi
auth=(-H "Authorization: Bearer $token")

upload=$(call "Upload" "${auth[@]}" -X POST \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@$pkg" "$api/upload/v2/$item:upload")
state=$(jq -r .uploadState <<<"$upload")
# Large packages finish asynchronously: poll for up to five minutes.
for _ in $(seq 30); do
  [ "$state" = IN_PROGRESS ] || break
  sleep 10
  state=$(call "Upload status" "${auth[@]}" "$api/v2/$item:fetchStatus" |
    jq -r .lastAsyncUploadState)
done
if [ "$state" != SUCCEEDED ]; then
  echo "::error::Chrome Web Store upload ended in state $state: $upload" >&2
  exit 1
fi
echo "Uploaded version $(jq -r '.crxVersion // "?"' <<<"$upload") to $CHROME_EXTENSION_ID"

if [ "${PUBLISH:-false}" != true ]; then
  echo "Not submitted: set PUBLISH=true to submit for review."
  exit 0
fi
request='{}'
if [ -n "${PUBLISH_TYPE:-}" ]; then
  request=$(jq -cn --arg type "$PUBLISH_TYPE" '{publishType: $type}')
fi
publish=$(call "Publish" "${auth[@]}" -X POST \
  -H "Content-Type: application/json" -d "$request" "$api/v2/$item:publish")
echo "Submitted for review, state: $(jq -r .state <<<"$publish")"
