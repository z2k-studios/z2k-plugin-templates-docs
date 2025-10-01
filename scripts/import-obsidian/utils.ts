import slugify from './slugify.js';
import path from 'path';
import fs from 'fs-extra';

// console.log("✅ LOADED utils.ts from", import.meta.url);

// ----------------------------------------------------------------------------------------------------
// --- Globals ---
// ----------------------------------------------------------------------------------------------------
export const SRC_REPO_NAME = 'z2k-plugin-templates';
export const DEST_REPO_NAME = 'z2k-plugin-templates-docs';
export const TEST_JIG_FOLDER = `./scripts/import-obsidian/test-jigs/test-source-files`;

/**
 * Use process.cwd() for project-root-relative paths, not __dirname (which is script-relative).
 * This ensures SRC and DEST are always relative to where the script is run from (the repo root).
 */
export let SRC_DOCS = path.resolve(process.cwd(), `../${SRC_REPO_NAME}/docs`);
export const PATH_DOCUSAURUS = path.resolve(process.cwd(), './');
export const PATH_DOCS = path.resolve(PATH_DOCUSAURUS, './docs');
export const PATH_DOCS_DEBUG = path.resolve(PATH_DOCS, "./debug");

// This prefix is used to ignore files that start with a dot (e.g., .gitkeep, .DS_Store, etc.)
export const IGNORE_PREFIX = '.';

// Logs
export const LOG_WARNINGS = path.resolve(PATH_DOCS_DEBUG, './~import-warnings.log');
export const LOG_ERRORS = path.resolve(PATH_DOCS_DEBUG, './~import-errors.log');


// ----------------------------------------------------------------------------------------------------
// --- Verbose and Debug Options ---
// ----------------------------------------------------------------------------------------------------
export function cleanFolderNamesForConsoleOutput(folderName: string): string {
  // Remove any absolute path references
  const WorkspaceRoot = path.resolve(process.cwd(), '../');
  let cleanedName = folderName.replace(WorkspaceRoot, '');
  cleanedName = cleanedName.replace("/" + DEST_REPO_NAME, "(DEST)");
  cleanedName = cleanedName.replace("/" + SRC_REPO_NAME, "(SRC)");
  return cleanedName;
}

// ----------------------------------------------------------------------------------------------------
// --- Execution Modes and Logs ---
// ----------------------------------------------------------------------------------------------------

export function statusLog(...args: any[]) {
  console.log('[status]', ...args);
}

export let VERBOSE = false;
export function verboseLog(...args: any[]) {
  if (VERBOSE) {
    console.log('[verbose]', ...args);
  }
}
export function setVerbose(val: boolean) {
  VERBOSE = val;
}

export let DEBUG = false;
export function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log('[debug]', ...args);
  }
}
export function setDebug(val: boolean) {
  DEBUG = val;
}

export function initializeLogs() {

  let logFilePreface = 
`# This file is created by the import-obsidian script.
# To use these as clickable links:
#    1) go to the 'docs' folder in VSCode's terminal window
#    2) cat this file [ clear && cat unresolvedLinks.log ]
#    3) Command-Click each link below to open the source file at the specified line/column.
# ---------------------------------------------------------------------------------------------------------------------------
#
`

  // Clear out any existing log files and initialized them with a reminder preface
  if (fs.existsSync(LOG_WARNINGS)) {
    fs.unlinkSync(LOG_WARNINGS);
  }
  fs.appendFileSync(LOG_WARNINGS, logFilePreface, 'utf8');

  if (fs.existsSync(LOG_ERRORS)) {
    fs.unlinkSync(LOG_ERRORS);
  }
  fs.appendFileSync(LOG_ERRORS, logFilePreface, 'utf8');

  verboseLog(`Initialized log files:`);
  verboseLog(` - Warnings: ${cleanFolderNamesForConsoleOutput(LOG_WARNINGS)}`);
  verboseLog(` - Errors:   ${cleanFolderNamesForConsoleOutput(LOG_ERRORS)}`);
}

export function closeLogs() {
  verboseLog(`Completed with logs:`);
  if (fs.existsSync(LOG_WARNINGS)) {
    verboseLog(` - Warnings: ${cleanFolderNamesForConsoleOutput(LOG_WARNINGS)}`);
  }
  if (fs.existsSync(LOG_ERRORS)) {
    verboseLog(` - Errors:   ${cleanFolderNamesForConsoleOutput(LOG_ERRORS)}`);
  }  
}

  
export function warningLog(...args: any[]) {
  console.warn('[warning]', ...args);
  fs.appendFileSync(LOG_WARNINGS, `[warning] ${args.join(' ')}\n`);
}

export function errorLog(...args: any[]) {
  console.error('[error]', ...args);
  fs.appendFileSync(LOG_ERRORS, `[error] ${args.join(' ')}\n`);
}


export let TESTING = false;
export function setTesting(val: boolean) {
  TESTING = val;

  // Reset the source folder to use the test jig folder
  if (TESTING) {
    console.log("=== TESTING MODE ENABLED ===");
    console.log(` - Only files in the '${TEST_JIG_FOLDER}' folder will be processed.`);
    SRC_DOCS = path.resolve(process.cwd(), `${TEST_JIG_FOLDER}`);
  }
}


// ----------------------------------------------------------------------------------------------------
// --- Utilities ---
// ----------------------------------------------------------------------------------------------------

export function sluggify(str: string): string {
  return slugify(str, { lower: true, strict: true });
}

export function isMarkdownOrText(filename: string): boolean {
  return /\.(md|txt)$/i.test(filename);
}

export function isMedia(filename: string): boolean {
  return /\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i.test(filename);
}

export function padNumber(n: number): string {
  return n.toString().padStart(3, '0');
}


// ----------------------------------------------------------------------------------------------------
// --- Folder naming Utilities ---
// ----------------------------------------------------------------------------------------------------

export function toPosix(p: string): string {
  if (!p) return '';
  const normalized = path.normalize(p);
  return normalized.replace(/[\/\\]+$/, '').split(path.sep).join('/');
}

/**
 * Remove a filename extension. "foo.md" -> "foo"
 */
export function stripExt(name: string): string {
  if (!name) return '';
  const ext = path.extname(name || '');
  return ext ? name.slice(0, -ext.length) : name;
}

/**
 * Normalize a destination directory string for use as a stable lookup key.
 * - Removes leading/trailing slashes/backslashes
 * - Converts separators to POSIX style
 * - Collapses '.'/'..' via path.normalize
 *
 * Examples:
 *   normalizeDestDir('/reference-manual/template-files/') -> 'reference-manual/template-files'
 *   normalizeDestDir('') -> ''
 */
export function normalizeDestDir(p?: string | null): string {
  if (!p) return '';
  return toPosix(p.replace(/^[\/\\]+|[\/\\]+$/g, ''));
}

/**
 * Compute canonical docId from destDir + destSlug.
 * - destSlug may include extension (e.g. "why-use-templates.md"); extension is stripped.
 * - destDir is normalized (posix, no leading/trailing slash). If destDir is '', returns just the base.
 *
 * Examples:
 *   computeDocIdFromDest('reference-manual/template-files', 'why-use-templates.md')
 *     -> 'reference-manual/template-files/why-use-templates'
 *
 *   computeDocIdFromDest('', 'readme.md') -> 'readme'
 */
export function computeDocIdFromDest(destDir: string | undefined | null, destSlug: string | undefined | null): string {
  const dir = normalizeDestDir(destDir ?? '');
  const base = stripExt(destSlug ?? '');
  return dir ? `${dir}/${base}` : base;
}