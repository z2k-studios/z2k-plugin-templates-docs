#!/bin/zsh
set -euo pipefail

# ====== CONFIG ======
PATH_TEMPLATE_PLUGIN_SRC="/Users/gp/Vaults/Z2K Studios Workspace/Code/Obsidian Plugins/z2k-plugin-templates/main.tsx"
PATH_TEMPLATE_ENGINE_SRC="/Users/gp/Vaults/Z2K Studios Workspace/Code/Obsidian Plugins/z2k-template-engine/src/main.ts"
PATH_PROMPT_TEXT_FILE_BASE="/Users/gp/Vaults/Z2K Studios Workspace/Code/Javascript Scripts/export-obsidian-to-docusaurus/docs on docs/ChatGPT Prompts/Prompt - "

PATH_REFERENCE_MANUAL_TOC="/Users/gp/Vaults/Z2K Studios Workspace/Code/Obsidian Plugins/z2k-plugin-templates/docs/reference-manual/reference-manual.md"
PATH_REFERENCE_MANUAL_INBOX="/Users/gp/Vaults/Z2K Studios Workspace/Code/Obsidian Plugins/z2k-plugin-templates/docs/reference-manual/"

# Destination folders
DEST_PATH_DESKTOP_CHAT="/Users/gp/Desktop/ChatGPT Files"
DEST_PATH_DOWNLOADS="/Users/gp/Downloads"

# Preface text you can modify separately
PROMPT_PREFACE_TEXT="Here is what I want you to work on for this chat:  "


# ====== FUNCTIONS ======
die() { echo "Error: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "Missing: $1"; }

wait_for_keypress() {
  echo
  read -s -k 1 "?"$1" Press any key to continue..."
  echo
}

# ====== PREP DEST FOLDER ======
mkdir -p "$DEST_PATH_DESKTOP_CHAT"

# Clear out old files (keep directories such as "Output")
files=()
while IFS= read -r -d '' f; do
	files+=("$f")
done < <(find "$DEST_PATH_DESKTOP_CHAT" -mindepth 1 -maxdepth 2 \( -type f -o -type l \) -print0 2>/dev/null)

if [ "${#files[@]}" -gt 0 ]; then
	echo "Removing old files from $DEST_PATH_DESKTOP_CHAT"
	for f in "${files[@]}"; do
		echo "--> $f"
	done
	rm -f -- "${files[@]}"
fi

# ====== ASK USER WHICH DOCUMENT TO WORK ON ======
echo
echo "This script will prepare files and prompt text for a new documentation chat."
echo "Note: It is best run in a dedicated terminal window, but is still fine in VS Code."
echo
echo "Choose the type of documentation you want to work on:"
echo "  1) Reference Manual"
echo "  2) (Quit)"
echo -n "Enter choice [1-2]: "
read -r choice
case "$choice" in
1)
	DOC_TYPE="Reference Manual"
	PROMPT_DOC="${PATH_PROMPT_TEXT_FILE_BASE}${DOC_TYPE}.md"
	PROMPT_TOC="$PATH_REFERENCE_MANUAL_TOC"
	DEST_INBOX="$PATH_REFERENCE_MANUAL_INBOX"
	;;
2) echo "Exiting."; exit 0 ;;
*) echo "Invalid choice."; exit 1 ;;
esac

# ====== Ask which file to work on ======
echo
echo "You chose to work on the $DOC_TYPE."

# Find lines that contain a [[link]] in the TOC file
toc_lines=()
while IFS= read -r line; do
	toc_lines+=("$line")
done < <(grep -E '\[\[[^]]+\]\]' "$PROMPT_TOC" || true)

if [ "${#toc_lines[@]}" -eq 0 ]; then
	echo "No [[...]] links found in: $PROMPT_TOC"
else
	echo
	i=1
	for line in "${toc_lines[@]}"; do
		echo "  $i) $line"
		i=$((i+1))
	done

	# Ask user which one to work on
	echo
	while true; do
		if [ "${#toc_lines[@]}" -eq 1 ]; then
			sel=1
			echo "Only one match found; selecting 1."
			break
		fi
		printf "Enter the number you want to work on [1-%d]: " "${#toc_lines[@]}"
		read -r sel
		# validate numeric and in range
		if [[ "$sel" =~ ^[0-9]+$ ]] && [ "$sel" -ge 1 ] && [ "$sel" -le "${#toc_lines[@]}" ]; then
			break
		fi
		echo "Invalid choice. Try again."
	done

	# Extract the selected line (zsh arrays are 1-based)
	selected_line="${toc_lines[$sel]}"

	# Try to extract the first [[...]] link; if none, fall back to the whole line
	selected_link="$(echo "$selected_line" | grep -oE '\[\[[^]]+\]\]' | head -n1 || true)"

	# Put result into variables instead of copying to clipboard
	if [ -n "$selected_link" ]; then
		CHAT_TARGET="$selected_link"
		echo "Selected link stored in CHAT_TARGET:"
		echo "--> $CHAT_TARGET <--"
	else
		CHAT_TARGET="$selected_line"
		echo "No bracketed link found on selected line; stored entire line in CHAT_TARGET:"
		echo "--> $CHAT_TARGET <--"
	fi

	# Combined prompt (preface + target) available in FULL_PROMPT
	FULL_PROMPT="$PROMPT_PREFACE_TEXT $CHAT_TARGET"
fi

# ====== PRECHECKS ======
need pbcopy
[ -f "$PATH_TEMPLATE_PLUGIN_SRC" ] || die "Not found: $PATH_TEMPLATE_PLUGIN_SRC"
[ -f "$PATH_TEMPLATE_ENGINE_SRC" ] || die "Not found: $PATH_TEMPLATE_ENGINE_SRC"
[ -f "$PROMPT_DOC" ] || die "Not found: Prompt Doc: $PROMPT_DOC"
[ -f "$PROMPT_TOC" ] || die "Not found: TOC: $PROMPT_TOC"


# ====== PREPARE CHAT ======
echo
echo "Preparing for a new documentation chat…"

# Copy source files (rename to .txt so ChatGPT accepts easily)
cp -f "$PATH_TEMPLATE_PLUGIN_SRC"  "$DEST_PATH_DESKTOP_CHAT/Template Plugin Source Code.txt"
cp -f "$PATH_TEMPLATE_ENGINE_SRC"  "$DEST_PATH_DESKTOP_CHAT/Template Engine Source Code.txt"
cp -f "$PROMPT_DOC" "$DEST_PATH_DESKTOP_CHAT/$DOC_TYPE - ChatGPT Prompt.md"
cp -f "$PROMPT_TOC" "$DEST_PATH_DESKTOP_CHAT/$DOC_TYPE - TOC.md"

# Append instructions (FULL_PROMPT) to the prompt doc file
echo -e "\n\n---\n\n$FULL_PROMPT" >> "$DEST_PATH_DESKTOP_CHAT/$DOC_TYPE - ChatGPT Prompt.md"

# Open Finder to the ChatGPT Files folder
open "$DEST_PATH_DESKTOP_CHAT"

# Copy FULL_PROMPT to clipboard
echo -n "$FULL_PROMPT" | pbcopy

# Launch ChatGPT app (fallback to web if app not present)
if open -a "ChatGPT" 2>/dev/null; then
  echo "Launched ChatGPT app."
  sleep 1
else
  echo "ChatGPT app not found; opening web app as fallback."
  open "https://chat.openai.com"
fi

# Try to create a new chat and paste the prompt using AppleScript UI scripting.
# Requires Accessibility permission for your terminal app under:
# System Settings → Privacy & Security → Accessibility.
osascript <<'APPLESCRIPT' 2>/dev/null || true
on isRunning(appName)
	tell application "System Events" to (name of processes) contains appName
end isRunning

set appName to "ChatGPT"
if isRunning(appName) is false then
	tell application appName to activate
	delay 0.7
end if

tell application "System Events"
	if application processes whose name is appName exists then
		tell application process appName
			set frontmost to true
			delay 0.3
			-- New chat (⌘N) if supported; otherwise it just focuses the input
			keystroke "n" using {command down}
			delay 0.25
			-- Paste clipboard
			keystroke "v" using {command down}
		end tell
	end if
end tell
APPLESCRIPT

# Clear instructions for the remaining manual steps
cat <<EOF

============================================================
Manual steps (script will pause for you):

1) In ChatGPT, confirm the prompt appeared in the message box.
   If not, press ⌘V to paste manually.
2) Press Return to send the prompt (or click the send button).
3) Return to the Finder window that opened: $DEST_PATH_DESKTOP_CHAT
4) Drag and drop all the the files into the ChatGPT chat:
   Tip: You can select all with ⌘A in that folder and drop them together.

(If UI automation didnt work, you may need to grant Accessibility
permissions to your terminal app and the ChatGPT app.)

Then when ready, DOWNLOAD the resultant file to the Output
folder:
$DEST_PATH_DOWNLOADS

And then let me know if you would like to copy it into the
$DOC_TYPE Inbox folder (typically the root).

Destination folder: $DEST_INBOX
============================================================
EOF


# copy-from-downloads into INBOX with confirmation and collision-avoidance ---
strip_brackets() {
  # remove surrounding [[ and ]] if present
  echo "$1" | sed -E 's/^\[\[//; s/\]\]$//'
}

perform_copy() {
  # Determine base filename
  if [ -n "${selected_link-}" ]; then
    base="$(strip_brackets "$selected_link")"
    echo "Using extracted link name: $base"
  else
    # No link extracted; ask user for the filename
    printf "No link was extracted. Enter the target filename (without .md): "
    read -r base
    base="${base%%.md}" # strip accidental .md suffix
  fi

  src="$DEST_PATH_DOWNLOADS/${base}.md"
  dest="$DEST_INBOX/${base}.md"

  # Tell the user what we are doing
  echo
  echo "Preparing to copy:"
  echo "SRC :: $src"
  echo "DEST :: $dest"
  echo

  # If source missing, allow user to provide alternative or cancel
  if [ ! -f "$src" ]; then
    echo "Ah shoot, source file not found: $src"
    printf "Enter alternative filename (without .md) or N to cancel: "
    read -r alt
    if [[ "$alt" =~ ^[Nn]$ ]]; then
      echo "Copy cancelled by user."
      return
    else
      base="${alt%%.md}"
      src="$DEST_PATH_DOWNLOADS/${base}.md"
      dest="$DEST_INBOX/${base}.md"
    fi
  fi

  # If still missing, abort this copy attempt
  if [ ! -f "$src" ]; then
    echo "No valid source file found. Skipping copy."
    return
  fi

  # Resolve destination collision by appending _vN
  dest_final="$dest"
  if [ -f "$dest_final" ]; then
    n=2
    while [ -f "${DEST_INBOX}/${base}_v${n}.md" ]; do
      n=$((n+1))
    done
    dest_final="${DEST_INBOX}/${base}_v${n}.md"
  fi

  # Confirm and copy
  echo
  echo "Just to be sure, I am copying:"
  echo "SRC :: $src"
  echo "DEST :: $dest_final"
  printf "Proceed? (Y/N) : "
  read -r proceed
  if [[ "$proceed" =~ ^[Yy]$ ]]; then
    if cp -f -- "$src" "$dest_final"; then
      echo "Copied to: $dest_final"
    else
      echo "Copy failed."
    fi
  else
    echo "Copy aborted by user."
  fi
}


if [ -n "${selected_link-}" ]; then
	base="$(strip_brackets "$selected_link")"
	echo "Downloaded Filename: '$base.md'"
else
	echo "Downloaded Filename: (oops, I'll need your to help me with the filename)"
fi
echo


# Menu loop: let user copy another, start a new document, or quit
while true; do
	echo
	echo "What would you like to do next?"
	echo "  1) Copy the latest downloaded version of the file to the $DOC_TYPE inbox"
	echo "  2) Open a Finder window to the Downloads folder"
	echo "  3) Open a Finder window to the $DOC_TYPE inbox area"
	echo "  4) Start a new document"
	echo "  5) Quit"
	echo
	echo "Note: I'll start by looking for a file named like this in your Downloads folder:"
	if [ -n "${selected_link-}" ]; then
		echo "  ${base}.md"
	else
		echo "  (oops, I'll need you to help me with the filename)"
	fi
	echo
	printf "Enter choice [1-5]: "
	read -r next_choice
	case "$next_choice" in
		1)
			perform_copy
			;;
		2)
			echo "Opening Downloads folder: $DEST_PATH_DOWNLOADS"
			open "$DEST_PATH_DOWNLOADS"
			;;
		3)
			echo "Opening inbox folder: $DEST_INBOX"
			open "$DEST_INBOX"
			;;
		4)
			echo "Starting a new document..."
			exec "$0" "$@"
			;;
		5)
			echo "Exiting."
			break
			;;
		*)
			echo "Invalid choice. Try again."
			;;
	esac
done

# --- END NEW ---

echo "All set. Happy documenting!"

