import slugify from 'slugify';
import path from 'path';

// console.log("✅ LOADED utils.ts from", import.meta.url);

// ----------------------------------------------------------------------------------------------------
// --- Globals ---
// ----------------------------------------------------------------------------------------------------
export const SRC_REPO_NAME = 'z2k-plugin-templates';
export const DEST_REPO_NAME = 'z2k-plugin-templates-docs';

/**
 * Use process.cwd() for project-root-relative paths, not __dirname (which is script-relative).
 * This ensures SRC and DEST are always relative to where the script is run from (the repo root).
 */
export const SRC = path.resolve(process.cwd(), `../${SRC_REPO_NAME}/docs`);
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
