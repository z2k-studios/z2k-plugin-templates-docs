#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------------------------
# 1-export-docs.sh
# -----------------------------------------------------------------------------------------------
# Wrapper to run the export-obsidian-to-docusaurus CLI
# Prefers local node_modules/.bin binary, falls back to PATH, then npx
#

# Set PACKAGE_NAME and PACKAGE_VERSION from environment or defaults
# (The :- syntax means "use default if not set")
PACKAGE_NAME="${EXPORT_OBSIDIAN_PACKAGE:-@z2k-studios/export-obsidian-to-docusaurus}"
PACKAGE_VERSION="${EXPORT_OBSIDIAN_PACKAGE_VERSION:-latest}"

# Where the export-obsidian-to-docusaurus binary would be if installed locally
LOCAL_BIN="./node_modules/.bin/export-obsidian-to-docusaurus"

# Default paths (override via --src, --dest, --debug-path)
SRC_DEFAULT="../z2k-plugin-templates/docs"
DEST_DEFAULT="./"    # <- changed from "./docs" to "./" to avoid nested ./docs/docs
DEBUG_PATH_DEFAULT="./debug"

show_help() {
  cat <<EOF
Usage: $0 [--bootstrap] [--update] [--help] -- <args for export-obsidian-to-docusaurus>

Options:
  --bootstrap    Install ${PACKAGE_NAME}@${PACKAGE_VERSION} into this repo (npm install).
  --update       Run npm update for ${PACKAGE_NAME} in this repo.
  --help         Show this help.

Defaults for export-obsidian-to-docusaurus args (can be overridden on the command line):
  --src          Default: ${SRC_DEFAULT}
  --dest         Default: ${DEST_DEFAULT}
  --debug-path   Default: ${DEBUG_PATH_DEFAULT}

Environment:
  EXPORT_OBSIDIAN_PACKAGE         Override package name (default: ${PACKAGE_NAME})
  EXPORT_OBSIDIAN_PACKAGE_VERSION Override package version (default: ${PACKAGE_VERSION})

EOF
}

case "${1:-}" in
  --help|-h) show_help; exit 0 ;;
  --bootstrap)
    if ! command -v npm >/dev/null 2>&1; then echo "npm not found; install Node/npm first." >&2; exit 1; fi
    echo "Bootstrapping ${PACKAGE_NAME}@${PACKAGE_VERSION} into this repo..."
    npm install --save-dev "${PACKAGE_NAME}@${PACKAGE_VERSION}" || { echo "npm install failed; check .npmrc/registry/auth." >&2; exit 1; }
    shift
    ;;
  --update)
    if ! command -v npm >/dev/null 2>&1; then echo "npm not found; install Node/npm first." >&2; exit 1; fi
    echo "Updating ${PACKAGE_NAME} in this repo..."
    npm update "${PACKAGE_NAME}" || { echo "npm update failed; check registry/auth." >&2; exit 1; }
    shift
    ;;
esac

# Ensure default args are included if not provided
final_args=("$@")
has_src=0
has_dest=0
has_debug=0
for a in "${final_args[@]:-}"; do
  case "$a" in
    --src|--src=*) has_src=1 ;;
    --dest|--dest=*) has_dest=1 ;;
    --debug-path|--debug-path=*) has_debug=1 ;;
  esac
done

if [ "$has_src" -eq 0 ]; then final_args+=("--src" "$SRC_DEFAULT"); fi
if [ "$has_dest" -eq 0 ]; then final_args+=("--dest" "$DEST_DEFAULT"); fi
if [ "$has_debug" -eq 0 ]; then final_args+=("--debug-path" "$DEBUG_PATH_DEFAULT"); fi

# prefer local binary (try both legacy and new names)
if [ -x "$LOCAL_BIN" ]; then
  exec "$LOCAL_BIN" "${final_args[@]}"
fi

# Try global binary in PATH
if command -v export-obsidian-to-docusaurus >/dev/null 2>&1; then
  exec export-obsidian-to-docusaurus "${final_args[@]}"
fi

# npx fallback
if command -v npx >/dev/null 2>&1; then
  NPX_PACKAGE="${PACKAGE_NAME}"
  if [ "${PACKAGE_VERSION}" != "latest" ]; then NPX_PACKAGE="${PACKAGE_NAME}@${PACKAGE_VERSION}"; fi
  echo "Running ${NPX_PACKAGE} via npx..."
  npx --yes "${NPX_PACKAGE}" "${final_args[@]}" && exit $?
  echo "npx run failed (package may be private/unavailable)." >&2
fi

echo "Could not run the export-obsidian-to-docusaurus tool."
echo "Install locally: npm install --save-dev ${PACKAGE_NAME}@${PACKAGE_VERSION}"
echo "Or run with npx (ensure ~/.npmrc auth for private packages): npx ${PACKAGE_NAME} -- <args>"
echo ""
echo "If the package is hosted in GitHub Packages, ensure you have an ~/.npmrc with your token:" 
echo "  //npm.pkg.github.com/:_authToken=YOUR_TOKEN"
echo "  @z2k-studios:registry=https://npm.pkg.github.com"
echo ""
echo "Or run via npx (requires npm auth for private packages):"
echo "  npx ${PACKAGE_NAME} -- <args>"
exit 2
