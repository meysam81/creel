build:
    bun run build

# Zip dist/ for Load unpacked or a manual Web Store upload
dist: build
    rm -f dist.zip && cd dist && zip -qr ../dist.zip . && cd .. && echo "$PWD/dist.zip"

# Pack a signed .crx with crx3 (go install github.com/mediabuyerbot/go-crx3/crx3@latest).
# Requires chrome-webstore-privatekey.pem. Generate one with: crx3 keygen chrome-webstore-privatekey.pem
pack: build
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ ! -f chrome-webstore-privatekey.pem ]]; then
        echo "ERROR: chrome-webstore-privatekey.pem not found."
        echo "Generate one with: crx3 keygen chrome-webstore-privatekey.pem"
        exit 1
    fi
    crx3 pack dist -p chrome-webstore-privatekey.pem -o creel.crx
    ls -lh creel.crx
    echo "$PWD/creel.crx"

# Print the Web Store public key from the local PEM
cws-pubkey:
    openssl rsa -in chrome-webstore-privatekey.pem -pubout -outform PEM 2>/dev/null
    @echo
