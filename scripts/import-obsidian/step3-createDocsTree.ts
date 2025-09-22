import fs from 'fs-extra';
import path from 'path';
import { FileIndexEntry, FolderIndexEntry, Index } from './types.ts';
import * as utils from './utils.ts'

// ====================================================================================================
// Step 3: Create Docusaurus Docs Tree
// ====================================================================================================
/**
 * Creates the directory structure for Docusaurus docs based on indexed folders.
 * Each folder in the index will have its own directory created in the destination path.
 *
 * @param folders - Array of indexed folders to create directories for.
 */
export function createDocsTree(folders: FolderIndexEntry[]) {
  for (const folder of folders) {
    utils.verboseLog(`Ensuring directory: ${utils.cleanFolderNamesForConsoleOutput(path.join(utils.DEST, folder.destDir))}`);

    // Note: this will create the directory if it does not exist
    fs.ensureDirSync(path.join(utils.DEST, folder.destDir));
  }
}