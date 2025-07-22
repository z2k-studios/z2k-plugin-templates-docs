#!/bin/bash

# Syncs markdown docs from plugin repo to Docusaurus site, and makes them read-only.

# Absolute or relative path to the plugin docs
SRC="../z2k-plugin-templates/docs"
# Destination path inside the Docusaurus site
DEST="./docs"

echo "🔄 Syncing docs from $SRC to $DEST..."

# Remove old copies
rm -rf "$DEST"
mkdir -p "$DEST"

# Copy preserving folder structure
cp -R "$SRC/" "$DEST/"

# Make all files read-only (u-w)
echo "🔒 Setting docs to read-only..."
find "$DEST" -type f -exec chmod a-w {} \;

echo "✅ Docs synced and locked down."
