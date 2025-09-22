#!/bin/zsh

# Runs the import-obsidian.ts script using ts-node.
# Usage: ./run-import-obsidian.sh [-v] [other args]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)" # Relative path from repo's root directory to this script (i.e. "./scripts/import-obsidian")
REPO_ROOT_DIR="$SCRIPT_DIR/../.."  # This is the root of the repository (i.e. "<repo_root>")
MAIN_TS_SCRIPT="$SCRIPT_DIR/import-obsidian.ts" # This is the main script to run (i.e. "./scripts/import-obsidian/import-obsidian.ts")

# clear the screen and output demarcation
echo ""
echo ""
echo ""
echo ""
echo ""
echo ""
clear
echo "========================================"
echo "       Import Obsidian Notes"
echo "========================================"
echo ""

# Check args for debug mode flag ("-d" or "--debug") 
DEBUG_MODE=false
for arg in "$@"; do
  if [[ "$arg" == "-d" || "$arg" == "--debug" ]]; then
    DEBUG_MODE=true
    break
  fi
done

# Check args for debug mode flag ("-i" or "--install") 
INSTALL_MODE=false
for arg in "$@"; do
  if [[ "$arg" == "-i" || "$arg" == "--install" ]]; then
    INSTALL_MODE=true
    break
  fi
done


# If install mode is enabled, check that all required packages are installed
if $INSTALL_MODE; then

  # Ensure ts-node is installed
  if ! npx --no-install ts-node --version >/dev/null 2>&1; then
    echo "❌ ts-node is not installed. Run: npm install -g ts-node typescript"
    exit 1
  else
    echo "✅ ts-node is installed"
  fi

  REQUIRED_PACKAGES=(
    ts-node
    tsx
    fs-extra
    gray-matter
    slugify
    unified
    remark-parse
    remark-stringify
    unist unist-util-visit
    unified remark remark-parse remark-stringify
  )

  echo "🔍 Checking for required npm packages..."

  MISSING=()

  for pkg in $REQUIRED_PACKAGES; do
    if ! npm ls "$pkg" >/dev/null 2>&1; then
      echo "⚠️  Missing: $pkg"
      MISSING+=$pkg
    else
      echo "✅ Found: $pkg"
    fi
  done

  if [[ ${#MISSING[@]} -gt 0 ]]; then
    echo "\n❌ Some packages are missing. To install, run:"
    echo "npm install ${(j: :)MISSING}"
    exit 1
  else
    echo "\n✅ All required packages are installed."
  fi

  # Now make sure typescript types are installed for pure JS modules
  npm install --no-audit --no-fund --save-dev @types/fs-extra 

fi

# NOW, finally ready to run the script
echo "▶️ Running import-obsidian.ts with args: $@"
cd "$REPO_ROOT_DIR"
if $DEBUG_MODE; then
  echo "Current directory: $(pwd)"
  echo "Debug mode enabled. Running with tsx in debug mode..."
  npx tsx --inspect "$MAIN_TS_SCRIPT" "$@"
  # echo "Debug mode enabled. Running with ts-node in debug mode..."
  # npx ts-node --esm "$MAIN_TS_SCRIPT" "$@"
  # node --inspect ./node_modules/.bin/ts-node "$MAIN_TS_SCRIPT" "$@"
else
  # npx ts-node --loader ts-node/esm "$MAIN_TS_SCRIPT" "$@" 
  # node --loader ts-node/esm "$MAIN_TS_SCRIPT" "$@"
  npx tsx "$MAIN_TS_SCRIPT" "$@"
fi