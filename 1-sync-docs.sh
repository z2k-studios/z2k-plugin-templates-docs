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

  # Try to extract title from YAML frontmatter if it exists
  title_from_yaml=""
  if head -n 1 "$srcfile" | grep -q "^---$"; then
    # Extract the first title: value between the first two --- lines
    title_from_yaml=$(awk '
      BEGIN {in_yaml=0}
      /^---$/ {if (in_yaml) exit; in_yaml=1; next}
      in_yaml && /^title:[[:space:]]*(.*)$/ {
        sub(/^title:[[:space:]]*/, "", $0)
        gsub(/^["'\'']|["'\'']$/, "", $0)
        print $0
        exit
      }
    ' "$srcfile")
  fi

  # Use YAML title if found, else fallback to original filename
  slug_base="$orig_name"
  if [[ -n "$title_from_yaml" ]]; then
    slug_base="$title_from_yaml"
  fi

  slug_name="$(sluggify "$slug_base")"
  dest_dir="$DEST/$orig_dir"
  dest_file="$dest_dir/$slug_name.md"

  mkdir -p "$dest_dir"

  # Extract frontmatter and insert title if needed
  if head -n 1 "$srcfile" | grep -q "^---$"; then
    # Check if title: exists in the YAML frontmatter
    if awk '/^---$/ {c++; next} c==1 && /^title: / {found=1; exit} c==2 {exit} END{exit !found}' "$srcfile"; then
      # title: exists, just copy as-is
      cp "$srcfile" "$dest_file"
    else
      # title: missing, insert it after the first --- line
      awk -v title="$orig_name" '
        BEGIN {inserted=0}
        /^---$/ && !inserted {print; getline; print "title: \"" title "\""; inserted=1}
        {print}
      ' "$srcfile" > "$dest_file"
    fi
  else
    echo -e "---\ntitle: \"$orig_name\"\n---\n" > "$dest_file"
    cat "$srcfile" >> "$dest_file"
  fi

  # Make all files read-only (u-w)
  chmod a-w "$dest_file"
done

echo "✅ Docs synced, sluggified, titled and locked down as read only."