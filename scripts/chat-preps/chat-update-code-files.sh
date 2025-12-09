#!/bin/zsh
set -euo pipefail

:<<"SPEC"
chat-update-code-files.sh spec:
1. Maintain an easily editable list of (source path, destination filename, description) entries.
2. Delete all .txt files from DEST_PATH before any copying.
3. Offer an interactive loop that clears the screen, shows "0) All Files" plus numbered entries as "<source filename> - <description>", accepts a selection, copies the chosen file, and repeats. Option "q" quits immediately.
4. Selecting 0 (interactive) copies every file then exits once finished.
5. Arg "-all" skips the prompt and copies every file directly so other scripts can call this one.
SPEC

# ====== CONFIG ======
SRC_DEV_REPOS_ROOT="/Users/gp/Desktop/Dev Repos" # For core development code, we want to use the dev repos
SRC_MAIN_WORKSPACE_ROOT="/Users/gp/Vaults/Z2K Studios Workspace"

DEST_PATH_DESKTOP_CHAT="/Users/gp/Desktop/ChatGPT Files/Code"
DEST_PATH_DESKTOP_CHAT_CODE="$DEST_PATH_DESKTOP_CHAT/Code"
DEST_PATH="$DEST_PATH_DESKTOP_CHAT_CODE"

PURGE_TXT_FILES=1
COPY_ACTION=""

# Edit the triplets below to register files for copying:
typeset -a CODE_FILES=(
  "$SRC_DEV_REPOS_ROOT/z2k-plugin-templates/main.tsx     | templates-plugin | +plugin-templates--main.tsx.txt | Main Templates --Plugin-- source"
  "$SRC_DEV_REPOS_ROOT/z2k-template-engine/src/main.ts   | templates-plugin | +template-engine--main.ts.txt   | Main Templates --Engine-- source"

  "$SRC_MAIN_WORKSPACE_ROOT/Code/Javascript Scripts/export-obsidian-to-docusaurus/step2-buildIndex.ts       | export-obsidian | export-obsidian--step2-buildIndex.ts.txt       | Step 2: Build Index"
  "$SRC_MAIN_WORKSPACE_ROOT/Code/Javascript Scripts/export-obsidian-to-docusaurus/step3-writeSidebar.ts     | export-obsidian | export-obsidian--step3-writeSidebar.ts.txt     | Step 3: Write Sidebar"
  "$SRC_MAIN_WORKSPACE_ROOT/Code/Javascript Scripts/export-obsidian-to-docusaurus/step5-remarkFiles.ts      | export-obsidian | export-obsidian--step5-remarkFiles.ts.txt      | Step 5: Remark and Copy Files"
  "$SRC_MAIN_WORKSPACE_ROOT/Code/Javascript Scripts/export-obsidian-to-docusaurus/step6-writeConfigEmbed.ts | export-obsidian | export-obsidian--step6-writeConfigEmbed.ts.txt | Step 6: Write Docusaurus Config Embed"
  "$SRC_MAIN_WORKSPACE_ROOT/Code/Javascript Scripts/export-obsidian-to-docusaurus/types.ts                  | export-obsidian | export-obsidian--types.ts.txt                  | Misc Code: types.ts"
  "$SRC_MAIN_WORKSPACE_ROOT/Code/Javascript Scripts/export-obsidian-to-docusaurus/utils.ts                  | export-obsidian | export-obsidian--utils.ts.txt                  | Misc Code: utils.ts"
  "$SRC_MAIN_WORKSPACE_ROOT/Code/Javascript Scripts/export-obsidian-to-docusaurus/utilsIndex.ts             | export-obsidian | export-obsidian--utilsIndex.ts.txt             | Misc Code: utilsIndex.ts"
  "$SRC_MAIN_WORKSPACE_ROOT/Code/Javascript Scripts/export-obsidian-to-docusaurus/z2kRemarkPlugins.ts       | export-obsidian | export-obsidian--z2kRemarkPlugins.ts.txt       | Z2K Remark Plugins"
  
  "$SRC_MAIN_WORKSPACE_ROOT/Code/Obsidian Plugins/z2k-plugin-templates-docs/src/css/custom.css              | templates-docs  | z2k-plugin-templates-docs--custom.css.txt           | custom.css"
  "$SRC_MAIN_WORKSPACE_ROOT/Code/Obsidian Plugins/z2k-plugin-templates-docs/docusaurus.config.ts            | templates-docs  | z2k-plugin-templates-docs--docusaurus.config.ts.txt | docusaurus.config"
)

typeset -A GROUP_LABELS=(
  [templates-plugin]="Plugin Templates"
  [export-obsidian]="Export Obsidian"
  [templates-docs]="Templates Docs"
)

typeset -A GROUP_SHORTCUTS=(
  [A]="templates-plugin"
  [B]="export-obsidian"
  [C]="templates-docs"
)

typeset -a GROUP_ORDER=(A B C)

typeset -a GIT_SYNC_CHECKS=(
  "$SRC_DEV_REPOS_ROOT/z2k-plugin-templates | dev | cd \"$SRC_DEV_REPOS_ROOT/z2k-plugin-templates\" && git checkout dev && git pull --ff-only"
  "$SRC_DEV_REPOS_ROOT/z2k-template-engine | dev | cd \"$SRC_DEV_REPOS_ROOT/z2k-template-engine\" && git checkout dev && git pull --ff-only"
)


# ====== HELPERS ======
ensure_files_configured() {
  if (( ${#CODE_FILES[@]} == 0 )); then
    print "No CODE_FILES configured. Populate the CODE_FILES array." >&2
    exit 1
  fi
}

ensure_destination() {
  mkdir -p "$DEST_PATH"
}

purge_txt_files() {
  find "$DEST_PATH" -maxdepth 1 -type f -name '*.txt' -delete
}

trim_whitespace() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  print -- "$value"
}

parse_entry() {
  local entry="$1" src group dst desc
  IFS='|' read -r src group dst desc <<<"$entry"
  src="$(trim_whitespace "$src")"
  group="$(trim_whitespace "$group")"
  dst="$(trim_whitespace "$dst")"
  desc="$(trim_whitespace "$desc")"
  print "$src|$group|$dst|$desc"
}

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
      *) print "Please respond with y or n." ;;
    esac
  done
}

execute_refresh_command() {
  local cmd="$1"
  set +e
  eval "$cmd"
  local rc=$?
  set -e
  return $rc
}

copy_entry() {
  local entry="$1"
  local parsed src group dst desc target_path
  parsed=$(parse_entry "$entry")
  IFS='|' read -r src group dst desc <<<"$parsed"
  if [[ ! -f "$src" ]]; then
    print "Missing source: $src" >&2
    return 1
  fi
  target_path="$DEST_PATH/$dst"
  cp "$src" "$target_path"
  print "Copied: $src -> $target_path ($desc)"
}

copy_all_files() {
  local entry
  for entry in "${CODE_FILES[@]}"; do
    copy_entry "$entry"
  done
}

copy_files_by_group() {
  local group="$1" matched=0 entry parsed src parsed_group dst desc
  for entry in "${CODE_FILES[@]}"; do
    parsed="$(parse_entry "$entry")"
    IFS='|' read -r src parsed_group dst desc <<<"$parsed"
    if [[ "$parsed_group" == "$group" ]]; then
      copy_entry "$entry"
      matched=1
    fi
  done
  (( matched )) || print "No files registered for group '$group'."
}

show_menu() {
	setopt localoptions noxtrace noverbose typesetsilent

  print "Ready to prepare code files for ChatGPT usage."
  print "==================================================="
  print ""
  print "Groups:"
  printf "----------------------\n"
  for letter in "${GROUP_ORDER[@]}"; do
    local group="${GROUP_SHORTCUTS[$letter]}"
    printf "   %s) %s\n" "$letter" "${GROUP_LABELS[$group]}"
  done
  print ""
  print "Individual Files:"
  printf "----------------------\n"
  local idx=1
  while (( idx <= ${#CODE_FILES[@]} )); do
    local entry="${CODE_FILES[$idx]}" src group dst desc base
    IFS='|' read -r src group dst desc <<<"$(parse_entry "$entry")"
    base="${src##*/}"
    printf "   %d) %s :: %s - %s\n" "$idx" "$group" "$base" "$desc"
    (( idx++ ))
  done
  print ""
  print "Total Control:"
  printf "----------------------\n"
  print "   0) All Files"
  print "   q) Quit"
  print ""
}

interactive_loop() {
  while true; do
    clear
    show_menu
    printf "\nSelect an option: "
    if ! read -r selection; then
      print "\nInput closed. Exiting."
      return
    fi
    case "$selection" in
      q|Q)
        print "Quitting without copying."
        return
        ;;
      0)
        copy_all_files
        print "All files copied. Exiting."
        return
        ;;
      [AaBbCcDd])
        local group_key="${selection:u}"
        copy_files_by_group "${GROUP_SHORTCUTS[$group_key]}"
        print "Press Enter to continue."
        read -r _
        ;;
      ''|*[!0-9]*)
        print "Invalid selection. Press Enter to continue."
        read -r _
        ;;
      *)
        local idx=$selection
        if (( idx < 1 || idx > ${#CODE_FILES[@]} )); then
          print "Selection out of range. Press Enter to continue."
          read -r _
        else
          copy_entry "${CODE_FILES[$idx]}"
          print "Press Enter to continue."
          read -r _
        fi
        ;;
    esac
  done
}

check_git_sync_status() {
  (( ${#GIT_SYNC_CHECKS[@]} == 0 )) && return
  local entry repo branch advice status_line
  for entry in "${GIT_SYNC_CHECKS[@]}"; do
    IFS='|' read -r repo branch advice <<<"$entry"
    repo="$(trim_whitespace "$repo")"
    branch="$(trim_whitespace "$branch")"
    advice="$(trim_whitespace "$advice")"
    [[ -d "$repo/.git" ]] || { print "WARNING: $repo is not a git repo. To update run: $advice"; continue; }
    if ! git -C "$repo" fetch --quiet origin "$branch" 2>/dev/null; then
      print "WARNING: Unable to fetch origin/$branch for $repo. To update run: $advice"
      continue
    fi
    status_line="$(git -C "$repo" status -sb 2>/dev/null | head -n1)"
    if [[ "$status_line" == *"behind"* ]]; then
      print "WARNING: $repo (branch $branch) is behind origin/$branch."
      attempt_repo_refresh "$repo" "$branch" "$advice"
    fi
  done
}

attempt_repo_refresh() {
  local repo="$1" branch="$2" advice="$3"
  if [[ -t 0 ]]; then
    if prompt_yes_no "Refresh $repo (branch $branch) now? [y/N]:"; then
      print "Refreshing $repo..."
      if execute_refresh_command "$advice"; then
        print "Refresh complete for $repo."
      else
        print "ERROR: Refresh command failed for $repo. Manual command: $advice" >&2
      fi
    else
      print "Skipped refresh for $repo. To update later run: $advice"
    fi
  else
    print "Non-interactive mode detected; to update run: $advice"
  fi
}

parse_cli_args() {
  COPY_ACTION=""
  while (( $# > 0 )); do
    case "$1" in
      -no-purge) PURGE_TXT_FILES=0 ;;
      -use-chat-root) DEST_PATH="$DEST_PATH_DESKTOP_CHAT" ;;
      -all|-templates-plugin|-export-obsidian|-templates-docs)
        if [[ -n "$COPY_ACTION" ]]; then
          print "Multiple copy actions provided ($COPY_ACTION, $1). Choose one." >&2
          exit 1
        fi
        COPY_ACTION="$1"
        ;;
      *)
        print "Unknown option: $1" >&2
        exit 1
        ;;
    esac
    shift
  done
}

handle_cli_option() {
  local option="${1:-}"
  case "$option" in
    -all) copy_all_files ;;
    -templates-plugin) copy_files_by_group "templates-plugin" ;;
    -export-obsidian)  copy_files_by_group "export-obsidian" ;;
    -templates-docs)   copy_files_by_group "templates-docs" ;;
    *)
      print "Unknown option: $option" >&2
      exit 1
      ;;
  esac
}

TRACE_WAS_ON=0
VERBOSE_WAS_ON=0

disable_shell_debug_tracing() {
	if [[ $- == *x* ]]; then
		TRACE_WAS_ON=1
		set +x
	fi
	if [[ $- == *v* ]]; then
		VERBOSE_WAS_ON=1
		set +v
	fi
}

restore_shell_debug_tracing() {
	(( TRACE_WAS_ON )) && set -x
	(( VERBOSE_WAS_ON )) && set -v
}

main() {
  parse_cli_args "$@"
  ensure_files_configured
  ensure_destination
  check_git_sync_status
  (( PURGE_TXT_FILES )) && purge_txt_files
  if [[ -n "$COPY_ACTION" ]]; then
    handle_cli_option "$COPY_ACTION"
    exit 0
  fi
  interactive_loop
}

disable_shell_debug_tracing
trap restore_shell_debug_tracing EXIT
main "$@"



