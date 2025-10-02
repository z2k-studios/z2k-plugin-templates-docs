#!/usr/bin/env zsh
# compare-jigs.zsh - open a side-by-side VS Code diff for chosen test jig (reuses current window)
set -euo pipefail

# Adjust this to your repo root
BASE="/Users/gp/Vaults/Z2K Studios Workspace/Code/Obsidian Plugins/z2k-plugin-templates-docs"
cd -- "$BASE" || { echo "Failed to cd to $BASE"; exit 1; }

# Ensure 'code' CLI is available
if ! command -v code >/dev/null 2>&1; then
  echo "VS Code 'code' command not found in PATH."
  echo "In VS Code: Command Palette -> 'Shell Command: Install \"code\" command in PATH'"
  exit 1
fi

while true; do
  clear
  echo "Showing diffs between canonical and current version of test jig files:"
  echo
  echo "   1 - Markdown Basics"
  echo "   2 - Links"
  echo "   3 - Embedded Links (File 1)"
  echo "   4 - Embedded Links (File 2)"
  echo "   5 - Callouts"
  echo "   6 - Code Blocks"
  echo "   q - Quit"
  echo

  read -r "choice?Which file would you like to compare (REMINDER: Select the window to use first)? (1-5, q): "

  case "$choice" in
    1)
      code -r --diff \
        "./docs/markdown-basics.md" \
        "./scripts/import-obsidian/test-jigs/test-canonical-output-files/canonical-markdown-basics.md" 
      ;;
    2)
      code -r --diff \
        "./docs/markdown-links.md" \
        "./scripts/import-obsidian/test-jigs/test-canonical-output-files/canonical-markdown-links.md" 
      ;;
    3)
      code -r --diff \
        "./docs/markdown-embedded-links-file-1.md" \
        "./scripts/import-obsidian/test-jigs/test-canonical-output-files/canonical-markdown-embedded-links-file-1.md"
      ;;
    4)
      code -r --diff \
        "./docs/markdown-embedded-links-file-2.md" \
        "./scripts/import-obsidian/test-jigs/test-canonical-output-files/canonical-markdown-embedded-links-file-2.md"
      ;;
    5)
      code -r --diff \
        "./docs/callouts.md" \
        "./scripts/import-obsidian/test-jigs/test-canonical-output-files/canonical-callouts.md"
      ;;
    6)
      code -r --diff \
        "./docs/code-blocks.md" \
        "./scripts/import-obsidian/test-jigs/test-canonical-output-files/canonical-code-blocks.md"
      ;;
    q|Q)
      echo "Exiting."
      break
      ;;
    *)
      echo "Invalid choice: ${choice}"
      ;;
  esac
done