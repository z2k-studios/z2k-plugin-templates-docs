import slugify from './slugify.js';
import path from 'path';

// console.log("✅ LOADED utils.ts from", import.meta.url);

// ----------------------------------------------------------------------------------------------------
// --- Globals ---
// ----------------------------------------------------------------------------------------------------
export const SRC_REPO_NAME = 'z2k-plugin-templates';
export const DEST_REPO_NAME = 'z2k-plugin-templates-docs';
export const TEST_JIG_FOLDER = `./scripts/import-obsidian/test-jigs`;

/**
 * Use process.cwd() for project-root-relative paths, not __dirname (which is script-relative).
 * This ensures SRC and DEST are always relative to where the script is run from (the repo root).
 */
export let SRC = path.resolve(process.cwd(), `../${SRC_REPO_NAME}/docs`);
export const DEST = path.resolve(process.cwd(), './docs');

// This prefix is used to ignore files that start with a dot (e.g., .gitkeep, .DS_Store, etc.)
export const IGNORE_PREFIX = '.';


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
// --- Execution Modes ---
// ----------------------------------------------------------------------------------------------------

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

export let TESTING = false;
export function setTesting(val: boolean) {
  TESTING = val;

  // Reset the source folder to use the test jig folder
  if (TESTING) {
    console.log("=== TESTING MODE ENABLED ===");
    console.log(` - Only files in the '${TEST_JIG_FOLDER}' folder will be processed.`);
    SRC = path.resolve(process.cwd(), `${TEST_JIG_FOLDER}`);
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
