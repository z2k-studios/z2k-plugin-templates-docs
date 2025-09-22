import fs from 'fs-extra';
import * as utils from './utils.ts'
import path from 'path';


// ====================================================================================================
// Step 1: Clean Target Folder 
// ====================================================================================================
/**
 * Ensures the target directory exists and removes all Markdown (.md) and text (.txt) files,
 * except for special files such as `.gitkeep` and `_category_.json`.
 *
 * This function is useful for cleaning up a destination folder before copying or generating new files,
 * while preserving essential placeholder or configuration files.
 *
 * @param dest - The path to the target directory to clean.
 *
 * @remarks
 * - The directory is created if it does not exist.
 * - Files named `.gitkeep` and `_category_.json` are always preserved, regardless of extension.
 * - Removal is performed synchronously.
 *
 */
export function cleanTargetFolder(dest: string) {

  fs.ensureDirSync(dest);
  let filesRemoved = 0;
  const entries = fs.readdirSync(dest);
  for (const entry of entries) {
    const entryPath = path.join(dest, entry);
    const stat = fs.statSync(entryPath);
    if (stat.isDirectory()) {
      // Recursively clean subfolders
      cleanTargetFolder(entryPath);
      // Remove the folder if it is empty after cleaning
      const remaining = fs.readdirSync(entryPath).filter(f => f !== '.gitkeep' && f !== '_category_.json');
      if (remaining.length === 0) {
        fs.removeSync(entryPath);
      }
    } else if (
      entry !== '.gitkeep' &&
      entry !== '_category_.json'
    ) {
      utils.debugLog(`Removing file: ${utils.cleanFolderNamesForConsoleOutput(entryPath)}`);
      filesRemoved++;
      fs.removeSync(entryPath);
    }
  }
  utils.verboseLog(`Cleaning target folder: ${utils.cleanFolderNamesForConsoleOutput(dest)} - ${filesRemoved} files removed`); // Log how many files were removed

}
