#!/bin/zsh

# Syncs markdown docs from plugin repo to Docusaurus site, and makes them read-only.

# Absolute or relative path to the plugin docs
SRC="../z2k-plugin-templates/docs"
# Destination path inside the Docusaurus site
DEST="./docs"

echo "🔄 Syncing docs from $SRC to $DEST..."

# Remove old copies in local dest folder
rm -rf "$DEST"
mkdir -p "$DEST"

# Copy preserving folder structure
# I now step through file by file and copy each one individually
# cp -R "$SRC/" "$DEST/"

# Function to sluggify filenames
sluggify() {
  echo "$1" | iconv -t ascii//TRANSLIT | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g' | sed -E 's/^-+|-+$//g'
}

# Copy and process
find "$SRC" -type f -name "*.md" | while read -r srcfile; do
  relpath="${srcfile#$SRC/}"
  orig_dir="$(dirname "$relpath")"
  orig_name="$(basename "$relpath" .md)"
  slug_name="$(sluggify "$orig_name")"
  dest_dir="$DEST/$orig_dir"
  dest_file="$dest_dir/$slug_name.md"

  mkdir -p "$dest_dir"

  # Extract frontmatter and insert title if needed
  if grep -q "^---" "$srcfile"; then
    awk -v title="$orig_name" '
      BEGIN { found = 0 }
      /^---/ { count++; print; if (count == 1) { found = 1 } next }
      found && count == 1 && /^title:/ { seen_title=1 }
      found && count == 1 && !seen_title && !/^$/ {
        print "title: \"" title "\""
        seen_title = 1
      }
      { print }
    ' "$srcfile" > "$dest_file"
  else
    echo -e "---\ntitle: \"$orig_name\"\n---\n" > "$dest_file"
    cat "$srcfile" >> "$dest_file"
  fi

  # Make all files read-only (u-w)
  chmod a-w "$dest_file"
done

echo "✅ Docs synced, sluggified, titled and locked down as read only."






echo "✅ Sync complete. All docs sluggified and read-only."
