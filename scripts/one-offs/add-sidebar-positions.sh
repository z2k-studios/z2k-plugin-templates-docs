#!/bin/zsh

SRC="../../z2k-plugin-templates/docs"

echo "➕ Adding sidebar_position fields to source files in $SRC..."
echo 
echo "⚠️  WARNING:"
echo "This is a one-time script used to add 'sidebar_position' YAML fields to markdown docs."
echo "It is currently hardcoded to process the folder:"
echo "  $SRC"
echo "Running this multiple times may lead to unexpected YAML duplication or corruption."
echo
read "response?❓ Are you sure you want to continue? (yes/no): "
if [[ ! "$response" =~ ^[Yy][Ee][Ss]$ ]]; then
  echo "🚫 Aborting script."
  exit 1
fi

find "$SRC" -type d | while read -r dir; do
  echo "📂 Processing folder: $dir"

  # Sort files alphabetically and handle index.md first
  md_files=("${(f)$(find "$dir" -maxdepth 1 -type f -name "*.md" | sort)}")
  position=1

  for file in $md_files; do
    filename=$(basename "$file")

    if [[ "$filename" == "index.md" ]]; then
      pos=0
    else
      pos=$position
      ((position += 10))
    fi

    tmpfile=$(mktemp)

    if grep -q "^---" "$file"; then
      awk -v pos="$pos" '
        BEGIN { found = 0; inserted = 0 }
        /^---/ { count++; print; if (count == 1) found = 1; next }
        found && count == 1 && /^sidebar_position:/ { inserted = 1 }
        found && count == 1 && !inserted && /^title:/ {
          print
          print "sidebar_position: " pos
          inserted = 1
          next
        }
        { print }
      ' "$file" > "$tmpfile"
      mv "$tmpfile" "$file"
    else
      echo -e "---\nsidebar_position: $pos\n---\n" | cat - "$file" > "$tmpfile"
      mv "$tmpfile" "$file"
    fi
  done
done

echo "✅ sidebar_position values inserted recursively."
