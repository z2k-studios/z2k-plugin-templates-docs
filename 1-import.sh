#!/bin/zsh

# Runs the import-obsidian.ts script using ts-node.
# - This is a workhorse script that imports all of the markdown files from an Obsidian vault, 
#   converts them into Docusaurus friendly markdown files - building a full index of all files
#   in the process, and then builds a folder structure in the ./docs folder to hold all of the
#   imported markdown files - setting the files as read-only to prevent accidental edits. 
#
# Old behavior: ./scripts/import-obsidian/run-import-obsidian.sh "$@"
# New behavior: prefer local package binary, fall back to npx, support --bootstrap and --update,
# and keep local ./scripts/import-obsidian/run-import-obsidian.sh as a final fallback.

PACKAGE_NAME="${IMPORT_OBSIDIAN_PACKAGE:-@z2k-studios/import-obsidian-to-docusaurus}"
PACKAGE_VERSION="${IMPORT_OBSIDIAN_PACKAGE_VERSION:-latest}"
LOCAL_BIN="./node_modules/.bin/import-obsidian"
LOCAL_SCRIPT="./scripts/import-obsidian/run-import-obsidian.sh"

show_help() {
	echo "Usage: $0 [--bootstrap] [--update] [--help] -- <args for import-obsidian>"
	echo ""
	echo "Options:"
	echo "  --bootstrap    Install ${PACKAGE_NAME}@${PACKAGE_VERSION} into this repo (npm install)."
	echo "  --update       Run npm update for ${PACKAGE_NAME} in this repo."
	echo "  --help         Show this help."
	echo ""
	echo "Environment:"
	echo "  IMPORT_OBSIDIAN_PACKAGE        Override package name (default: ${PACKAGE_NAME})"
	echo "  IMPORT_OBSIDIAN_PACKAGE_VERSION  Override package version (default: ${PACKAGE_VERSION})"
	echo ""
	echo "Notes:"
	echo "  For a private GitHub Packages package, ensure an .npmrc with the appropriate auth token:"
	echo "    //npm.pkg.github.com/:_authToken=YOUR_TOKEN"
	echo "    @z2k:registry=https://npm.pkg.github.com"
	echo ""
}

# parse top-level flags (only care about first arg flags)
case "$1" in
	--help|-h)
		show_help; exit 0
		;;
	--bootstrap)
		# ensure npm is available
		if ! command -v npm >/dev/null 2>&1; then
			echo "npm not found; install Node/npm first."
			exit 1
		fi
		echo "Bootstrapping ${PACKAGE_NAME}@${PACKAGE_VERSION} into this repo..."
		npm install --save-dev "${PACKAGE_NAME}@${PACKAGE_VERSION}" || {
			echo "npm install failed. If this is a private package, ensure .npmrc is configured for the registry and token."
			echo "Example ~/.npmrc or project .npmrc:"
			echo "  //npm.pkg.github.com/:_authToken=\$GITHUB_TOKEN"
			echo "  @z2k:registry=https://npm.pkg.github.com"
			exit 1
		}
		# hand off remaining args (shift the --bootstrap)
		shift
		;;
	--update)
		if ! command -v npm >/dev/null 2>&1; then
			echo "npm not found; install Node/npm first."
			exit 1
		fi
		echo "Updating ${PACKAGE_NAME} in this repo..."
		npm update "${PACKAGE_NAME}" || {
			echo "npm update failed. If private, ensure registry auth is present."
			exit 1
		}
		shift
		;;
esac

# If a local binary exists in node_modules, run it
if [ -x "$LOCAL_BIN" ]; then
	exec "$LOCAL_BIN" "$@"
fi

# If import-obsidian is in PATH (global install), run it
if command -v import-obsidian >/dev/null 2>&1; then
	exec import-obsidian "$@"
fi

# Try npx fallback (this will use auth from .npmrc if package is private)
if command -v npx >/dev/null 2>&1; then
	# Prefer specifying version when provided
	if [ "${PACKAGE_VERSION}" != "latest" ]; then
		NPX_PACKAGE="${PACKAGE_NAME}@${PACKAGE_VERSION}"
	else
		NPX_PACKAGE="${PACKAGE_NAME}"
	fi

	# Use --yes to skip prompts in CI; if npx fails, capture exit code
	echo "Running ${NPX_PACKAGE} via npx..."
	npx --yes "${NPX_PACKAGE}" "$@" && exit $?
	echo "npx run failed (package may be private/unavailable)."
fi

# Fallback to old local script, for backward compatibility
if [ -x "$LOCAL_SCRIPT" ]; then
	echo "Falling back to local script at $LOCAL_SCRIPT"
	exec "$LOCAL_SCRIPT" "$@"
fi

# Nothing found — print actionable instructions
echo "Could not run the import-obsidian tool."
echo "Recommended: install the private package into this repo:"
echo "  npm install --save-dev ${PACKAGE_NAME}@${PACKAGE_VERSION}"
echo ""
echo "If the package is hosted in GitHub Packages, create a repo-level .npmrc with your token:"
echo "  //npm.pkg.github.com/:_authToken=YOUR_TOKEN"
echo "  @z2k:registry=https://npm.pkg.github.com"
echo ""
echo "Or run via npx (requires npm auth for private packages):"
echo "  npx ${PACKAGE_NAME} -- <args>"
echo ""
exit 2
