#!/bin/zsh
set -euo pipefail

# ====== CONFIG ======
PATH_PROMPT_TEXT_FILE_BASE="/Users/gp/Vaults/Z2K Studios Workspace/Code/Javascript Scripts/export-obsidian-to-docusaurus/docs on docs/ChatGPT Prompts/Prompt - "

PATH_REFERENCE_MANUAL_TOC="/Users/gp/Vaults/Z2K Studios Workspace/Code/Obsidian Plugins/z2k-plugin-templates/docs/reference-manual/reference-manual.md"
PATH_REFERENCE_MANUAL_ROOT="/Users/gp/Vaults/Z2K Studios Workspace/Code/Obsidian Plugins/z2k-plugin-templates/docs/reference-manual/"
PATH_REFERENCE_MANUAL_INBOX="${PATH_REFERENCE_MANUAL_ROOT}"

# Destination folders
DEST_PATH_DESKTOP_CHAT="/Users/gp/Desktop/ChatGPT Files"
DEST_PATH_DOWNLOADS="/Users/gp/Downloads"

# Preface text you can modify separately
PROMPT_PREFACE_TEXT="Here is what I want you to work on for this chat:  "

CHAT_UPDATE_CODE_SCRIPT="/Users/gp/Vaults/Z2K Studios Workspace/Code/Obsidian Plugins/z2k-plugin-templates-docs/scripts/chat-preps/chat-update-code-files.sh"
DEFAULT_CODE_SET_TO_COPY="-templates-plugin"
TOTAL_STEPS=5
typeset -ga SELECTED_TARGET_LINKS=()
typeset -ga SELECTED_TARGET_LINES=()
typeset -ga SELECTED_TARGET_BASENAMES=()
typeset -ga TARGET_FOUND_FILES=()
typeset -gA TARGET_ORIGINAL_MAP=()

# =================================================================================
# =================================================================================
#
# 								  UTILITY FUNCTIONS
#
# =================================================================================
# =================================================================================
die() { echo "Error: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "Missing: $1"; }

prompt_yes_no() {
	local prompt="$1" reply
	while true; do
		printf "%s " "$prompt"
		if ! read -r reply; then
			return 1
		fi
		reply="${reply:l}"
		case "$reply" in
			y|yes) return 0 ;;
			n|no|'') return 1 ;;
			*) echo "Please respond with y or n." ;;
		esac
	done
}

print_step_header() {
	local step="$1"
	local title="$2"
	local desc="${3:-}"
	clear
	printf "STEP %s/%s: %s\n" "$step" "$TOTAL_STEPS" "$title"
	printf "=======================================================================================\n\n"
	[[ -n "$desc" ]] && printf "%s\n\n" "$desc"
}

strip_brackets() {
	echo "$1" | sed -E 's/^\[\[//; s/\]\]$//'
}

choose_target_base() {
	local prompt="${1:-"Select target"}" choice base
	if (( ${#SELECTED_TARGET_BASENAMES[@]} == 0 )); then
		printf "Enter the target filename (without .md): "
		read -r base
		base="${base%%.md}"
		[[ -z "$base" ]] && return 1
		REPLY="$base"
		return 0
	fi
	if (( ${#SELECTED_TARGET_BASENAMES[@]} == 1 )); then
		REPLY="${SELECTED_TARGET_BASENAMES[1]}"
		return 0
	fi
	echo "$prompt"
	local i=1
	for base in "${SELECTED_TARGET_BASENAMES[@]}"; do
		printf "  %d) %s.md\n" "$i" "$base"
		(( i++ ))
	done
	while true; do
		printf "Enter choice [1-%d] (m=manual, q=cancel): " "${#SELECTED_TARGET_BASENAMES[@]}"
		read -r choice
		case "$choice" in
			[qQ]) return 1 ;;
			[mM])
				printf "Enter target filename (without .md): "
				read -r base
				base="${base%%.md}"
				[[ -z "$base" ]] && return 1
				REPLY="$base"
				return 0
				;;
			*)
				if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#SELECTED_TARGET_BASENAMES[@]} )); then
					REPLY="${SELECTED_TARGET_BASENAMES[$choice]}"
					return 0
				fi
				echo "Invalid choice."
				;;
		esac
	done
}

prepare_destination_folder() {
	mkdir -p "$DEST_PATH_DESKTOP_CHAT"
	local -a files=()
	while IFS= read -r -d '' f; do
		files+=("$f")
	done < <(find "$DEST_PATH_DESKTOP_CHAT" -mindepth 1 -maxdepth 2 \( -type f -o -type l \) -print0 2>/dev/null)
	if (( ${#files[@]} > 0 )); then
		echo "Removing old files from $DEST_PATH_DESKTOP_CHAT"
		for f in "${files[@]}"; do
			echo "--> $f"
		done
		rm -f -- "${files[@]}"
	fi
}

show_script_overview() {
	clear
	printf "chat-prep — tool for preparing ChatGPT chats for documentation\n"
	printf "==============================================================================================================\n\n"
	printf "This utility stages the files and prompts needed to discuss a documentation page\n"
	printf "inside a ChatGPT conversation. It walks through the following steps:\n\n"
	printf "  1) Select the documentation type (e.g.  Reference Manual)\n"
	printf "  2) Choose the specific entry or target page\n"
	printf "  3) Specify which ChatGPT prompt template to use\n"
	printf "  4) Copy the relevant code files into the ChatGPT workspace\n"
	printf "  5) Confirm the overall setup before launching ChatGPT and supporting tools\n\n"
	printf "Press ENTER to continue, or type 'q' to quit: "
	read -r response
	if [[ "${response:l}" == "q" ]]; then
		echo "Exiting per request."
		exit 0
	fi
}

# =================================================================================
# =================================================================================
#
#							  INTERACTIVE STEP HANDLERS
#
# =================================================================================
# =================================================================================	
step_select_document_type() {
	print_step_header 1 "Select Documentation Type" "Choose the type of documentation you want to work on."
	echo "  1) Reference Manual"
	echo "  2) (Quit)"
	printf "\nEnter choice [1-2]: "
	read -r choice
	case "$choice" in
	1)
		DOC_TYPE="Reference Manual"
		PROMPT_DOC_BASE="${PATH_PROMPT_TEXT_FILE_BASE}${DOC_TYPE}"
		PROMPT_TOC="$PATH_REFERENCE_MANUAL_TOC"
		DEST_ROOT="$PATH_REFERENCE_MANUAL_ROOT"
		DEST_INBOX="$PATH_REFERENCE_MANUAL_INBOX"
		;;
	2) echo "Exiting."; exit 0 ;;
	*) echo "Invalid choice."; exit 1 ;;
	esac
}

step_select_document_target() {
	print_step_header 2 "Select Documentation Target" "Choose the entry you want to focus on for this session."
	echo "You chose to work on the $DOC_TYPE."
	local -a toc_lines=()
	while IFS= read -r line; do
		toc_lines+=("$line")
	done < <(grep -E '\[\[[^]]+\]\]' "$PROMPT_TOC" || true)
	if (( ${#toc_lines[@]} == 0 )); then
		echo "No [[...]] links found in: $PROMPT_TOC"
		return
	fi
	echo
	local i=1
	for line in "${toc_lines[@]}"; do
		echo "  $i) $line"
		(( i++ ))
	done
	echo
	local selection_input
	while true; do
		printf "Enter the number(s) you want to work on [1-%d] (space-separated): " "${#toc_lines[@]}"
		read -r selection_input
		local -a selections=(${=selection_input})
		if (( ${#selections[@]} == 0 )); then
			echo "Invalid choice. Try again."
			continue
		fi
		local valid=1
		for sel in "${selections[@]}"; do
			if [[ "$sel" =~ ^[0-9]+$ ]] && (( sel >= 1 && sel <= ${#toc_lines[@]} )); then
				continue
			fi
			valid=0
			break
		done
		(( valid )) && break
		echo "Invalid choice. Try again."
	done

	SELECTED_TARGET_LINKS=()
	SELECTED_TARGET_LINES=()
	SELECTED_TARGET_BASENAMES=()
	for sel in "${selections[@]}"; do
		local normalized_line link base
		normalized_line="$(echo "${toc_lines[$sel]}" | sed -E 's/\[\[([^|\]#]+)[|#][^]]*\]\]/[[\1]]/g')"
		link="$(echo "$normalized_line" | grep -oE '\[\[[^]]+\]\]' | head -n1 || true)"
		if [ -n "$link" ]; then
			base="$(echo "$link" | sed -E 's/^\[\[//; s/\]\]$//; s/[|#].*$//')"
			SELECTED_TARGET_LINKS+=("$link")
		else
			base="$(echo "$normalized_line" | tr -cs 'A-Za-z0-9_- ' '_' | sed 's/^_//; s/_$//' | tr ' ' '_')"
			SELECTED_TARGET_LINKS+=("")
		fi
		[[ -z "$base" ]] && base="target-$sel"
		SELECTED_TARGET_BASENAMES+=("$base")
		SELECTED_TARGET_LINES+=("$normalized_line")
	done

	selected_line="${SELECTED_TARGET_LINES[1]}"
	selected_link="${SELECTED_TARGET_LINKS[1]}"
	local summary_idx=1
	local -a summary=()
	for base in "${SELECTED_TARGET_BASENAMES[@]}"; do
		local link="${SELECTED_TARGET_LINKS[summary_idx]}"
		local line="${SELECTED_TARGET_LINES[summary_idx]}"
		if [[ -n "$link" ]]; then
			summary+=("$link")
		else
			summary+=("$line")
		fi
		(( summary_idx++ ))
	end
	CHAT_TARGET="$(IFS=', '; echo "${summary[*]}")"

	echo "Working on target(s):"
	for base in "${SELECTED_TARGET_BASENAMES[@]}"; do
		echo "  - $base"
	done
}

step_select_chat_prompt() {
	print_step_header 3 "Specify Chat Prompt" "Please specify which of the following prompts you wish to use for this ChatGPT session:"
	local -a prompt_files=()
	while IFS= read -r -d '' pf; do
		prompt_files+=("$pf")
	done < <(find "$(dirname "$PROMPT_DOC_BASE")" -type f -name "$(basename "$PROMPT_DOC_BASE")*" -print0 2>/dev/null)
	if (( ${#prompt_files[@]} == 0 )); then
		die "No prompt files found matching base: $PROMPT_DOC_BASE"
	fi
	echo "Available prompt files:"
	local i=1
	for pf in "${prompt_files[@]}"; do
		echo "  $i) $(basename "$pf")"
		(( i++ ))
	done
	echo
	while true; do
		printf "Enter the number of the prompt file to use [1-%d]: " "${#prompt_files[@]}"
		read -r pf_sel
		if [[ "$pf_sel" =~ ^[0-9]+$ ]] && (( pf_sel >= 1 && pf_sel <= ${#prompt_files[@]} )); then
			break
		fi
		echo "Invalid choice. Try again."
	done
	PROMPT_DOC="${prompt_files[$pf_sel]}"
	echo "Using prompt file: $PROMPT_DOC"
	FULL_PROMPT="$PROMPT_PREFACE_TEXT $CHAT_TARGET"
}

step_configure_code_files() {
	print_step_header 4 "Configure Code Files" "By default, the template plugin and template engine code will be copied for this chat."
	[ -x "$CHAT_UPDATE_CODE_SCRIPT" ] || die "Not executable: $CHAT_UPDATE_CODE_SCRIPT"
	echo "Copying default code set via $DEFAULT_CODE_SET_TO_COPY ..."
	"$CHAT_UPDATE_CODE_SCRIPT" -no-purge -use-chat-root "$DEFAULT_CODE_SET_TO_COPY"
	echo ""
	if prompt_yes_no "Do you want to specify additional code files? (y/[n])"; then
		"$CHAT_UPDATE_CODE_SCRIPT" -no-purge -use-chat-root
	else
		echo "Using default code snapshot only."
	fi
}

step_confirm_chat_setup() {
	print_step_header 5 "Confirm Chat Setup" "Review the selections below before continuing."
	local target_summary="(none)"
	if (( ${#SELECTED_TARGET_BASENAMES[@]} )); then
		target_summary="$(IFS=', '; echo "${SELECTED_TARGET_BASENAMES[*]}")"
	fi
	printf "Documentation Type      : %s\n" "$DOC_TYPE"
	printf "Documentation Target(s) : %s\n" "$target_summary"
	printf "Documentation #         : %s\n" "$pf_sel"
	printf "Prompt File             : %s\n\n" "$(basename "$PROMPT_DOC")"
	printf "Press Enter to continue..."
	read -r _
}

run_interactive_setup() {
	prepare_destination_folder
	step_select_document_type
	step_select_document_target
	step_select_chat_prompt
	step_configure_code_files
	step_confirm_chat_setup
}

# =================================================================================
# =================================================================================
#
# 							  DOCUMENT & FILE OPERATIONS
#
# =================================================================================
# =================================================================================
locate_existing_document() {
	TARGET_FOUND_FILES=()
	TARGET_ORIGINAL_MAP=()
	if (( ${#SELECTED_TARGET_BASENAMES[@]} == 0 )); then
		echo "No selected link to find existing document for."
		ORIGINAL_DOC_PATH=""
		found_file=""
		return
	fi
	for base in "${SELECTED_TARGET_BASENAMES[@]}"; do
		local found
		found="$(find "$DEST_ROOT" -type f -name "${base}.md" 2>/dev/null | head -n1 || true)"
		TARGET_FOUND_FILES+=("$found")
		TARGET_ORIGINAL_MAP["$base"]="$found"
		if [ -n "$found" ]; then
			printf "Found existing document file for %s :\n--> %s <--\n" "$base" "$found"
		else
			printf "No existing document file found for %s in %s\n" "$base" "$DEST_ROOT"
		fi
	done
	ORIGINAL_DOC_PATH="${TARGET_FOUND_FILES[1]:-}"
	found_file="$ORIGINAL_DOC_PATH"
}

run_prechecks() {
	need pbcopy
	[ -x "$CHAT_UPDATE_CODE_SCRIPT" ] || die "Not executable: $CHAT_UPDATE_CODE_SCRIPT"
	[ -f "$PROMPT_DOC" ] || die "Not found: Prompt Doc: $PROMPT_DOC"
	[ -f "$PROMPT_TOC" ] || die "Not found: TOC: $PROMPT_TOC"
}

prepare_chat_payload() {
	echo
	echo "Preparing for a new documentation chat…"

	CHAT_PROMPT_DEST="$DEST_PATH_DESKTOP_CHAT/$DOC_TYPE - ChatGPT Prompt.md"
	CHAT_TOC_DEST="$DEST_PATH_DESKTOP_CHAT/$DOC_TYPE - TOC.md"
	cp -f "$PROMPT_DOC" "$CHAT_PROMPT_DEST"
	cp -f "$PROMPT_TOC" "$CHAT_TOC_DEST"
	for found in "${TARGET_FOUND_FILES[@]}"; do
		[ -n "$found" ] && [ -f "$found" ] || continue
		cp -f -- "$found" "$DEST_PATH_DESKTOP_CHAT/$(basename "$found")"
		echo "Copied existing document into ChatGPT Files: $(basename "$found")"
	done

	# Append instructions (FULL_PROMPT) to the prompt doc file
	printf '\n\n---\n\n%s\n' "$FULL_PROMPT" >> "$CHAT_PROMPT_DEST"

	# Open Finder to the ChatGPT Files folder
	open "$DEST_PATH_DESKTOP_CHAT"

	# Copy FULL_PROMPT to clipboard
	pbcopy < "$CHAT_PROMPT_DEST"
}

launch_chatgpt_sequence() {
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
	on waitForProcess(appName)
		repeat 20 times
			tell application "System Events"
				if application processes whose name is appName exists then return true
			end tell
			delay 0.2
		end repeat
		return false
	end waitForProcess

	set appName to "ChatGPT"
	tell application appName to activate
	if waitForProcess(appName) then
		tell application "System Events"
			tell application process appName
				set frontmost to true
				delay 0.2
				keystroke "n" using {command down}
				delay 0.2
				keystroke "v" using {command down}
			end tell
		end tell
	end if
APPLESCRIPT
}

print_manual_instructions() {
	cat <<'EOF'

============================================================================
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
============================================================================
EOF
}

perform_copy() {
	local dest_folder="${1:-$DEST_INBOX}"
	if ! choose_target_base "Select the target you want to copy"; then
		echo "Copy cancelled."
		return
	fi
	local base="${REPLY%%.md}"
	[[ -z "$base" ]] && { echo "No target specified."; return; }
	echo "Using target name: $base"

	local src="$DEST_PATH_DOWNLOADS/${base}.md"
	local dest="$dest_folder/${base}.md"

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
			dest="$dest_folder/${base}.md"
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
		local n=2
		while [ -f "${dest_folder}/${base}_v${n}.md" ]; do
			n=$((n+1))
		done
		dest_final="${dest_folder}/${base}_v${n}.md"
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

perform_diff() {
	local new_root="${1:-$DEST_PATH_DOWNLOADS}"
	if ! choose_target_base "Select the target for diffing"; then
		echo "Diff cancelled."
		return
	fi
	local base="${REPLY%%.md}"
	[[ -z "$base" ]] && { echo "No target specified."; return; }

	local src="$new_root/${base}.md"
	if [ ! -f "$src" ]; then
		echo "New file not found: $src"
		return
	fi
	local orig="${TARGET_ORIGINAL_MAP[$base]:-}"
	if [ -z "$orig" ] || [ ! -f "$orig" ]; then
		orig="$(find "$DEST_ROOT" -type f -name "${base}.md" 2>/dev/null | head -n1 || true)"
	fi
	if [ -z "$orig" ] || [ ! -f "$orig" ]; then
		echo "Original file not found in $DEST_ROOT"
		return
	fi
	code --diff "$src" "$orig"
}

post_chat_menu_loop() {
	if (( ${#SELECTED_TARGET_BASENAMES[@]} )); then
		echo "Downloaded Filenames:"
		for base in "${SELECTED_TARGET_BASENAMES[@]}"; do
			echo "  - ${base}.md"
		done
	else
		echo "Downloaded Filename: (oops, I'll need you to help me with the filename)"
	fi
	echo
	while true; do
		clear
		echo
		echo "What would you like to do next?"
		echo "---------------------------------------------------"
		echo "  0) Clear the buffer"
		echo "\n Copy Options :: -----------------------------"
		echo "  1) Copy the latest downloaded version of the file to the $DOC_TYPE inbox"
		echo "  2) Copy the latest downloaded version of the file to the Output folder on desktop"
		echo "\n Diff Options :: -----------------------------"
		echo "  3) Launch VS Code file comparison on new (in Downloads) and old documentation file"
		echo "  4) Launch VS Code file comparison on new (in Desktop Output) and old documentation file"
		echo "\n Finder Options :: ---------------------------"
		echo "  5) Open a Finder window to the Downloads folder"
		echo "  6) Open a Finder window to the $DOC_TYPE inbox area"
		echo "\n Other Options :: ----------------------------"
		echo "  7) Start a new document"
		echo "  8) Quit"
		echo
		echo "Note: I'll start by looking for file(s) named like this in your Downloads folder:"
		if (( ${#SELECTED_TARGET_BASENAMES[@]} )); then
			for base in "${SELECTED_TARGET_BASENAMES[@]}"; do
				echo "  ${base}.md"
			done
		else
			echo "  (oops, I'll need you to help me with the filename)"
		fi
		echo
		printf "Enter choice [1-8]: "
		read -r next_choice
		case "$next_choice" in
			0) echo "Clearing the buffer..."; clear ;;
			1) echo "Copying to $DOC_TYPE inbox folder..."; perform_copy "$DEST_INBOX" ;;
			2) echo "Copying to Output folder on desktop..."; perform_copy "$DEST_PATH_DESKTOP_CHAT/Output" ;;
			3) echo "Launching VS Code file comparison (Downloads)..."; perform_diff "$DEST_PATH_DOWNLOADS" ;;
			4) echo "Launching VS Code file comparison (Desktop Output)..."; perform_diff "$DEST_PATH_DESKTOP_CHAT/Output" ;;
			5) echo "Opening Downloads folder: $DEST_PATH_DOWNLOADS"; open "$DEST_PATH_DOWNLOADS" ;;
			6) echo "Opening inbox folder: $DEST_INBOX"; open "$DEST_INBOX" ;;
			7) echo "Starting a new document..."; exec "$0" "$@" ;;
			8) echo "Exiting."; break ;;
			*) echo "Invalid choice. Try again." ;;
		esac
	done
}


# =================================================================================
# =================================================================================
#
# 								MAIN EXECUTION FLOW
#
# =================================================================================
# =================================================================================
main() {
	show_script_overview 				# Display overview and wait for user
	run_interactive_setup 			    # Run the interactive setup steps
	locate_existing_document			# Locate existing document if any
	run_prechecks						# Run prechecks before proceeding
	prepare_chat_payload				# Prepare the payload for ChatGPT
	launch_chatgpt_sequence				# Launch the ChatGPT interaction sequence
	print_manual_instructions			# Print manual instructions for the user
	post_chat_menu_loop					# Enter post-chat menu loop
	echo "All set. Happy documenting!"
}

main "$@"

