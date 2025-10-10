#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------------------------
# 1-export-docs.sh  — consumer-side wrapper for export-obsidian-to-docusaurus
# -----------------------------------------------------------------------------------------------
# Model:
#   - Always try to install the freshest dev-channel build:
#       npm install --save-dev @z2k-studios/export-obsidian-to-docusaurus@dev
#     This adds only a few seconds when unchanged (noop), but guarantees you see new publishes.
#   - Prefer local node_modules/.bin binary; fallback to PATH; then npx with @dev.
#
# Tags/channels:
#   - Default channel is "dev". Override with EXPORT_OBSIDIAN_PACKAGE_TAG=latest (or a specific version).
#
# Auth/registry (for GitHub Packages):
#   - ~/.npmrc (user-level) should include:
#       @z2k-studios:registry=https://npm.pkg.github.com
#       //npm.pkg.github.com/:_authToken=<PAT with read:packages>
#
# Options:
#   --no-update    Skip the pre-run npm install step (fast path when you know nothing changed)
#   --bootstrap    One-time install only, then exit (useful for CI caches)
#   --help         Show help
#
# Defaults for CLI args (override with flags after `--`):
#   --src          ../z2k-plugin-templates/docs
#   --dest         ./         (avoid ./docs/docs nesting)
#   --debug-path   ./debug
# -----------------------------------------------------------------------------------------------

# -------- Configurable inputs (env-driven) --------
PACKAGE_NAME="${EXPORT_OBSIDIAN_PACKAGE:-@z2k-studios/export-obsidian-to-docusaurus}"
PACKAGE_TAG="${EXPORT_OBSIDIAN_PACKAGE_TAG:-dev}"          # dev by default
PACKAGE_SPEC="${PACKAGE_NAME}@${PACKAGE_TAG}"              # what we install/run via npx
LOCAL_BIN="./node_modules/.bin/export-obsidian-to-docusaurus"

# CLI default paths (can be overridden by passing explicit args to the tool)
SRC_DEFAULT="../z2k-plugin-templates/docs"
DEST_DEFAULT="./"
DEBUG_PATH_DEFAULT="./debug"

show_help() {
  cat <<EOF
Usage: $0 [--no-update | --bootstrap | --help] -- [args for export-obsidian-to-docusaurus]

Behavior:
  - By default, ensures latest ${PACKAGE_SPEC} is installed (npm install) on each run,
    then executes the local binary with sensible defaults for --src/--dest/--debug-path.

Options:
  --no-update    Do not run npm install before executing (use when you know deps are current)
  --bootstrap    Install ${PACKAGE_SPEC} and exit (no execution)
  --help         Show this help

Environment:
  EXPORT_OBSIDIAN_PACKAGE       Override package name (default: ${PACKAGE_NAME})
  EXPORT_OBSIDIAN_PACKAGE_TAG   Override tag or version (default: ${PACKAGE_TAG})

Default CLI args (can be overridden after --):
  --src          ${SRC_DEFAULT}
  --dest         ${DEST_DEFAULT}
  --debug-path   ${DEBUG_PATH_DEFAULT}

Examples:
  $0 -- --src ../notes --dest ./site
  EXPORT_OBSIDIAN_PACKAGE_TAG=latest $0 -- --dest ./docs
  EXPORT_OBSIDIAN_PACKAGE_TAG=1.2.3   $0 -- --debug-path ./tmp/debug
EOF
}

# -------- Parse wrapper flags (before the `--`) --------
DO_UPDATE=1
MODE_BOOTSTRAP=0

case "${1:-}" in
  --help|-h) show_help; exit 0 ;;
  --no-update) DO_UPDATE=0; shift ;;
  --bootstrap) MODE_BOOTSTRAP=1; shift ;;
esac

# -------- Ensure Node/npm exists --------
if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found; install Node/npm first." >&2
  exit 1
fi

# -------- Optional pre-run install/update step --------
if [[ $DO_UPDATE -eq 1 ]]; then
  echo "Ensuring ${PACKAGE_SPEC} is installed (this is fast if already up to date)…"
  # Using npm install (not 'update') forces resolution to the channel/version you asked for
  npm install --save-dev "${PACKAGE_SPEC}" \
    || { echo "npm install failed; check .npmrc/registry/auth." >&2; exit 1; }
fi

# If we’re only bootstrapping, we’re done
if [[ $MODE_BOOTSTRAP -eq 1 ]]; then
  echo "Bootstrap complete for ${PACKAGE_SPEC}."
  exit 0
fi

# -------- Collect CLI args for the tool (after `--`) --------
# Everything after the first literal -- is forwarded to the export tool.
# If user omitted any of the three key flags, we append sensible defaults.
final_args=()
# Pass through all remaining args as-is (they may include a leading `--`)
for a in "${@:-}"; do final_args+=("$a"); done

has_src=0; has_dest=0; has_debug=0
for a in "${final_args[@]:-}"; do
  case "$a" in
    --src|--src=*) has_src=1 ;;
    --dest|--dest=*) has_dest=1 ;;
    --debug-path|--debug-path=*) has_debug=1 ;;
  esac
done
[[ $has_src   -eq 1 ]] || { final_args+=("--src" "$SRC_DEFAULT"); }
[[ $has_dest  -eq 1 ]] || { final_args+=("--dest" "$DEST_DEFAULT"); }
[[ $has_debug -eq 1 ]] || { final_args+=("--debug-path" "$DEBUG_PATH_DEFAULT"); }

# -------- Execute: prefer local binary; fallback to PATH; then npx @dev --------
if [[ -x "$LOCAL_BIN" ]]; then
  exec "$LOCAL_BIN" "${final_args[@]}"
fi

if command -v export-obsidian-to-docusaurus >/dev/null 2>&1; then
  exec export-obsidian-to-docusaurus "${final_args[@]}"
fi

# npx fallback (explicit tag/version to match our install behavior)
if command -v npx >/dev/null 2>&1; then
  echo "Local binary not found; running ${PACKAGE_SPEC} via npx…"
  exec npx --yes "${PACKAGE_SPEC}" "${final_args[@]}"
fi

echo "Could not run the export-obsidian-to-docusaurus tool."
echo "Tried local binary, PATH command, and npx."
echo "Install locally: npm install --save-dev ${PACKAGE_SPEC}"
echo ""
echo "If the package is private on GitHub Packages, ensure ~/.npmrc contains:"
echo "  @z2k-studios:registry=https://npm.pkg.github.com"
echo "  //npm.pkg.github.com/:_authToken=<your PAT with read:packages>"
exit 2