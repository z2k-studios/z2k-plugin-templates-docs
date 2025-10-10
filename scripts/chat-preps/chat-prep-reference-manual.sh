#!/bin/zsh
set -euo pipefail

# ====== CONFIG ======
PATH_TEMPLATE_PLUGIN_SRC="/Users/gp/Vaults/Z2K Studios Workspace/Code/Obsidian Plugins/z2k-plugin-templates/main.tsx"
PATH_TEMPLATE_ENGINE_SRC="/Users/gp/Vaults/Z2K Studios Workspace/Code/Obsidian Plugins/z2k-template-engine/src/main.ts"
PATH_REFERENCE_MANUAL_TOC="/Users/gp/Vaults/Z2K Studios Workspace/Code/Obsidian Plugins/z2k-plugin-templates/docs/reference-manual/reference-manual.md"
PATH_DESKTOP_CHAT="/Users/gp/Desktop/ChatGPT Files"
PATH_CREATE_DOC_PROMPT_TEXT="/Users/gp/Vaults/Z2K Studios Workspace/Code/Javascript Scripts/export-obsidian-to-docusaurus/docs on docs/ChatGPT Reference Manual Prompt.md"

# ====== FUNCTIONS ======
die() { echo "Error: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "Missing: $1"; }

wait_for_keypress() {
  echo
  read -s -k 1 "?"$1" Press any key to continue..."
  echo
}

# ====== PRECHECKS ======
need pbcopy
[ -f "$PATH_TEMPLATE_PLUGIN_SRC" ] || die "Not found: $PATH_TEMPLATE_PLUGIN_SRC"
[ -f "$PATH_TEMPLATE_ENGINE_SRC" ] || die "Not found: $PATH_TEMPLATE_ENGINE_SRC"
[ -f "$PATH_REFERENCE_MANUAL_TOC" ] || die "Not found: $PATH_REFERENCE_MANUAL_TOC"
[ -f "$PATH_CREATE_DOC_PROMPT_TEXT" ] || die "Not found: $PATH_CREATE_DOC_PROMPT_TEXT"

# ====== PREP DEST FOLDER ======
mkdir -p "$PATH_DESKTOP_CHAT"

echo "Preparing for a new documentation chat…"

# Copy source files (rename to .txt so ChatGPT accepts easily)
cp -f "$PATH_TEMPLATE_PLUGIN_SRC"  "$PATH_DESKTOP_CHAT/template_plugin_src.tsx.txt"
cp -f "$PATH_TEMPLATE_ENGINE_SRC"  "$PATH_DESKTOP_CHAT/template_engine_src.ts.txt"
cp -f "$PATH_REFERENCE_MANUAL_TOC" "$PATH_DESKTOP_CHAT/Reference Manual - TOC.md"

# Put the reference prompt text on the clipboard
pbcopy < "$PATH_CREATE_DOC_PROMPT_TEXT"
echo "Loaded reference prompt text to clipboard."

# Open Finder to the ChatGPT Files folder
open "$PATH_DESKTOP_CHAT"

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
3) Return to the Finder window that opened: $PATH_DESKTOP_CHAT
4) Drag and drop these files into the ChatGPT chat:
     - template_plugin_src.tsx.txt
     - template_engine_src.ts.txt
     - Reference Manual - TOC.md
   Tip: You can select all with ⌘A in that folder and drop them together.

(If UI automation didnt work, you may need to grant Accessibility
permissions to your terminal app and the ChatGPT app.)
============================================================
EOF

wait_for_keypress "Proceed when ready."
echo "All set."
