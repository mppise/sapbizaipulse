#!/bin/bash
# SpecGantry update checker — runs at SessionStart
# Compares local installed version against latest on GitHub.
# If a newer version is found, runs the real installer silently then surfaces a systemMessage.

INSTALL_URL="https://raw.githubusercontent.com/mppise/spec-gantry--claude/main/install.sh"
VERSION_URL="https://raw.githubusercontent.com/mppise/spec-gantry--claude/main/.specgantry_version"
LOCAL_VERSION_FILE="$(pwd)/.specgantry_version"

# --- Fetch remote version number only (lightweight) ---
REMOTE_VERSION=$(curl -sfL --connect-timeout 5 -m 10 "$VERSION_URL" 2>/dev/null | tr -d '[:space:]')
if [ -z "$REMOTE_VERSION" ]; then
    # No network / repo unreachable — skip silently
    exit 0
fi

# --- Read local version ---
if [ -f "$LOCAL_VERSION_FILE" ]; then
    LOCAL_VERSION=$(cat "$LOCAL_VERSION_FILE" | tr -d '[:space:]')
else
    LOCAL_VERSION="unknown"
fi

# --- Helper to emit a systemMessage JSON blob safely ---
emit() {
    python3 -c "import json,sys; print(json.dumps({'systemMessage': sys.argv[1]}))" "$1"
}

# --- Compare ---
if [ "$REMOTE_VERSION" = "$LOCAL_VERSION" ]; then
    emit "SpecGantry v${LOCAL_VERSION} is up to date."
    exit 0
fi

# --- New version detected: run the real installer silently ---
INSTALL_SCRIPT=$(curl -sfL --connect-timeout 5 -m 60 "$INSTALL_URL" 2>&1)
CURL_EXIT=$?
if [ $CURL_EXIT -ne 0 ] || [ -z "$INSTALL_SCRIPT" ]; then
    emit "SpecGantry update detected (v${LOCAL_VERSION} → v${REMOTE_VERSION}) but installer download failed. Please update manually: curl -sfL ${INSTALL_URL} | bash"
    exit 0
fi
INSTALL_OUTPUT=$(echo "$INSTALL_SCRIPT" | bash 2>&1)
INSTALL_EXIT=$?

if [ $INSTALL_EXIT -ne 0 ]; then
    emit "SpecGantry update detected (v${LOCAL_VERSION} → v${REMOTE_VERSION}) but installer failed (exit ${INSTALL_EXIT}). Please update manually: curl -sfL ${INSTALL_URL} | bash"
    exit 0
fi

# --- Installation succeeded ---
emit "SpecGantry updated v${LOCAL_VERSION} → v${REMOTE_VERSION}. Please restart Claude Code for the new version to take effect."
exit 0
