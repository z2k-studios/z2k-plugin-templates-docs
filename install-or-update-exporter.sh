#!/usr/bin/env bash
set -euo pipefail

# install-or-update-exporter.sh
# Idempotent installer/updater for @z2k-studios/export-obsidian-to-docusaurus

BACKUP_SUFFIX=".$(date +%s)"

echo "[info] Running installer/updater for @z2k-studios/export-obsidian-to-docusaurus"

# Ensure package.json exists
if [ ! -f package.json ]; then
  echo "[info] package.json not found — creating one"
  npm init -y >/dev/null 2>&1
fi

# Ensure project .npmrc contains the registry pin for the scope
NPMRC_FILE=".npmrc"
if [ -f "$NPMRC_FILE" ]; then
  # DO NOTHING - assume that if it is there then it is correct
  # echo "[info] Backing up existing $NPMRC_FILE -> ${NPMRC_FILE}${BACKUP_SUFFIX}"
  # cp "$NPMRC_FILE" "${NPMRC_FILE}${BACKUP_SUFFIX}"
  # # Ensure a single scoped registry line exists (but do not add always-auth)
  # if grep -q "^@z2k-studios:registry=" "$NPMRC_FILE"; then
  #   echo "[info] @z2k-studios registry already present in $NPMRC_FILE"
  # else
  #   echo "@z2k-studios:registry=https://npm.pkg.github.com" >> "$NPMRC_FILE"
  #   echo "[info] Added scope registry to $NPMRC_FILE"
  # fi
else
  echo "[info] Creating $NPMRC_FILE with scoped registry"
  printf "%s\n" "@z2k-studios:registry=https://npm.pkg.github.com" > "$NPMRC_FILE"
fi

# Optional convenience npm script
npm pkg set scripts.export-docs="export-obsidian-to-docusaurus" >/dev/null 2>&1 || true

# Install or update to latest version
echo "[info] Installing/Updating package to latest..."
npm install --no-audit --no-fund -D @z2k-studios/export-obsidian-to-docusaurus@latest

# Quick smoke test: run --help and show first lines of output
echo "[info] Running quick smoke test (CLI --help)"
npx --no-install export-obsidian-to-docusaurus --help >/tmp/eotd_help.txt 2>&1 || true
if grep -qE 'Usage:|Missing required arguments|--src <source-docs-path>' /tmp/eotd_help.txt; then
  echo "[success] CLI looks installed and produced help/usage output.";
  # head -n 20 /tmp/eotd_help.txt || true
else
  echo "[error] CLI did not produce expected help output. See /tmp/eotd_help.txt for details." >&2
  tail -n 200 /tmp/eotd_help.txt || true
  exit 1
fi

echo "[done] Install/update complete. You can run: npx --no-install export-obsidian-to-docusaurus --help"
