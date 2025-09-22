import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { FileIndexEntry, FolderIndexEntry, Index } from './types.ts';
import * as utils from './utils.ts'
import { isMarkdownOrText } from './utils.ts';

const SIDEBAR_PATH = path.join(utils.DEST, '../sidebars.ts');

// ====================================================================================================
// Step 2: Build File Index
// ====================================================================================================
/**
 * Recursively scans a source directory to build an index of files and folders,
 * extracting metadata from Markdown or text files (YAML frontmatter) and
 * generating mappings for efficient lookup and wikilink resolution.
 *
 * The function walks the directory tree starting at `src`, collecting:
 * - An array of indexed files with extracted metadata (title, slug, sidebar position, etc.)
 * - An array of indexed folders with derived or extracted metadata
 * - Maps for resolving files by title, slug, and filename (case-insensitive)
 *
 * Folder index files are detected using common conventions (e.g., `index.md`, `README.md`, or files matching the folder name).
 * Metadata such as `title`, `slug`, and `sidebar_position` are extracted from YAML frontmatter if present.
 * Sidebar positions are auto-assigned if not specified, ensuring ordering.
 *
 * Duplicate source filenames (case-insensitive) are detected and a warning is logged for potential wikilink ambiguity.
 *
 * @param src - The root source directory to index.
 * @returns An `Index` object containing arrays of indexed files and folders, and lookup maps for file resolution.
 *
 * @remarks
 * - Only files with `.md` or `.txt` extensions are parsed for YAML frontmatter.
 * - Non-markdown/text files are indexed with their filename as title and slug.
 * - Ignores files and folders starting with the configured `IGNORE_PREFIX`.
 * - Designed for use in documentation or content migration tools where folder and file structure, as well as metadata, are important.
 *
 * @example
 * ```typescript
 * const index = buildIndex('/path/to/docs');
 * console.log(index.files); // Array of indexed files with metadata
 * ```
 */
export function buildIndex(src: string): Index {
    // Arrays to hold indexed files and folders
    const files: FileIndexEntry[] = [];
    const folders: FolderIndexEntry[] = [];
    // Maps for fast lookup by title, slug, and filename (case-insensitive)
    const fileTitleMap = new Map<string, FileIndexEntry>();
    const fileSlugMap = new Map<string, FileIndexEntry>();
    const fileNameMap = new Map<string, FileIndexEntry[]>();

    /**
     * Extract metadata from a folder's index file if it exists.
     * @param dir - Current directory path
     * @param filesInDir - List of files in the current directory
     */
    function ExtractFolderDataFromIndexFile(dir: string, filesInDir: string[]) {

      // --- This Folder's Index File Detection ---
      // Try to find a file that serves as the folder's index (e.g., index.md, README.md, etc.)
      let folderIndexFile: string | undefined;
      const folderName = path.basename(dir);
      const folderNameSlug = utils.sluggify(folderName);

      // List of possible index file candidates
      const indexCandidates = [
          'index.md', 'index.txt',
          'readme.md', 'readme.txt', 'README.md', 'README.txt',
          `${folderName}.md`, `${folderName}.txt`,
          `${folderNameSlug}.md`, `${folderNameSlug}.txt`
      ];
      // Pick the first candidate that exists in the folder
      for (const candidate of indexCandidates) {
          if (filesInDir.includes(candidate)) {
              folderIndexFile = candidate;
              utils.debugLog(`Found folder index file: ${candidate} in ${utils.cleanFolderNamesForConsoleOutput(dir)}`);
              break;
          }
      }

      // --- Extract folder metadata from index file if present ---
      let myFolderIndexTitle = folderName;
      let myFolderIndexSlug = folderNameSlug;
      let myFolderIndexFilePosition = -1;             // This is the position of the folder's index file in the sidebar within the folder - Typically 0 or 1 to make the index be on top 
      let myFolderPosition = -1;                  // This is the position of the folder itself (as a category) in the sidebar
      if (folderIndexFile) {
          const indexFilePath = path.join(dir, folderIndexFile);
          // Read YAML frontmatter from the index file
          const { data } = matter.read(indexFilePath);
          if (typeof data.title === 'string') myFolderIndexTitle = data.title;
          if (typeof data.slug === 'string') myFolderIndexSlug = data.slug;
          if (typeof data.sidebar_position === 'number') myFolderIndexFilePosition = data.sidebar_position;
          if (typeof data.folder_position === 'number') myFolderPosition = data.folder_position;
      }

      // If no sidebar position is set, then just set it to be 0 to force the index file to be on the top
      if (myFolderIndexFilePosition < 0) {
          myFolderIndexFilePosition = 0;
      }

      // Return the extracted metadata
      return {
          folderIndexFile,
          folderTitle: myFolderIndexTitle,
          folderSlug: myFolderIndexSlug,
          folderIndexFilePosition: myFolderIndexFilePosition >= 0 ? myFolderIndexFilePosition : undefined,
          folderPosition: myFolderPosition >= 0 ? myFolderPosition : undefined
      };
    }

    /**
     * Recursively walk the directory tree.
     * @param dir - Current directory path
     * @param parentDestDir - Destination directory path of the parent
     * @param folderDepth - Current folder depth (for sidebar position)
     * @param suggestedPosition - Suggested sidebar position for this folder
     */
    function walk(dir: string, parentDestDir: string, folderDepth: number, suggestedPosition: number = 100) {

      // Gather folder data
      // -------------------------------------------------------------------------
      // List all entries in the directory, ignoring those with IGNORE_PREFIX
      const entries = fs.readdirSync(dir).filter(f => !f.startsWith(utils.IGNORE_PREFIX));
      // Separate subdirectories and files, and sort for deterministic order
      const subdirs = entries.filter(f => fs.statSync(path.join(dir, f)).isDirectory()).sort();
      const filesInDir = entries.filter(f => fs.statSync(path.join(dir, f)).isFile()).sort();


      // Determine this folder's sidebar position
      // -------------------------------------------------------------------------
      // 0. If root level, set sidebar position to 0
      // 1. Otherwise, extract Position from the folder name if it starts with a number, if this fails, then...
      // 2. Extract position from this folder's index file if it exists, if this fails then...
      // 3. Auto-assign based on siblings encountered thus far
      let thisFolderSidebarPosition = -1;

      // Case 0: If we are at the root level, set sidebar position to 0
      if (folderDepth === 0) { thisFolderSidebarPosition = 0; }

      // Case 1: If the folder consists of a number followed by a space or dash, 
      // then extract the number and use that number as the sidebar_position
      if (thisFolderSidebarPosition < 0) { 
        const folderPosMatch = dir.match(/^(\d+)[\s-]/);
        if (folderPosMatch) {
            thisFolderSidebarPosition = parseInt(folderPosMatch[1], 10);
        }
      }

      // Case 2: Extract position from this folder's index file if it exists
      // Note: we always gather index file data even if sidebarPosition is already set
      const { folderIndexFile, folderTitle, folderSlug, folderIndexFilePosition: extractedIndexFilePosition, folderPosition: extractedFolderPosition } =
          ExtractFolderDataFromIndexFile(dir, filesInDir);
      if ((thisFolderSidebarPosition < 0) && (extractedFolderPosition !== undefined)) {
          thisFolderSidebarPosition = extractedFolderPosition;
      }
      const folderName = path.basename(dir);
      const folderNameSlug = utils.sluggify(folderName);

      // Case 3:If sidebar position is still not set (from index file, or as root), then auto-assign based on siblings encountered thus far
      if (thisFolderSidebarPosition < 0) {
          thisFolderSidebarPosition = suggestedPosition;
      }

      // Compose the final destination folder name for this folder (e.g., "010-my-folder")
      let finalDestFolder = `${utils.padNumber(thisFolderSidebarPosition)}-${utils.sluggify(path.basename(dir))}`;
      let destDir = path.join(parentDestDir, finalDestFolder);

      // Do not create a numbered folder for the root ---
      if (folderDepth === 0) {
          finalDestFolder = '';
          destDir = '';
      }

      // Add this folder to the folders index
      folders.push({
          sourcePath: dir,
          sourceName: folderName,
          destDir,
          destSlug: folderSlug,
          destTitle: folderTitle,
          sidebarPosition: thisFolderSidebarPosition,
          finalDestFolder,
      });

      // --- File Indexing ---
      // Index all files in this directory
      for (const file of filesInDir) {
          if (file.startsWith(utils.IGNORE_PREFIX)) continue; // Skip ignored files
          const ext = path.extname(file);
          const name = path.basename(file, ext);
          const sourcePath = path.join(dir, file);

          // Skip non-docs right here
          if (!utils.isMarkdownOrText(file)) {
            utils.debugLog(`Skipping non-doc file: ${file}`);
            continue;
          }

          // Default metadata
          let docTitle = name;
          let docSlug = utils.sluggify(name);
          let docSidebarPos: number = -1;
          let hasYamlTitle = false, hasYamlSlug = false, hasYamlSidebar = false;

          // If the file is a folder index file, use its metadata
          // NOTE: skipping this, just have it reload it for cleaner code.

          // If it's a markdown or text file, try to extract YAML frontmatter
          if (utils.isMarkdownOrText(file)) {
              const { data } = matter.read(sourcePath);
              if (typeof data.title === 'string') { docTitle = data.title; hasYamlTitle = true; }
              if (typeof data.slug === 'string') { docSlug = data.slug; hasYamlSlug = true; }
              if (typeof data.sidebar_position === 'number') { docSidebarPos = data.sidebar_position; hasYamlSidebar = true; }
              else docSidebarPos = -1;
          }

          // Debug logging
          utils.debugLog(`Indexed file: ${utils.cleanFolderNamesForConsoleOutput(sourcePath)} => Title: "${docTitle}", Slug: "${docSlug}", Sidebar Position: ${docSidebarPos >= 0 ? docSidebarPos : '(auto)'}`);  

          // Add this file to the files index
          files.push({
              sourcePath,
              sourceDir: dir,
              sourceName: name,
              sourceExt: ext,
              destDir,
              destSlug: docSlug + ext,
              destTitle: docTitle,
              sidebarPosition: docSidebarPos,
              hasYamlTitle,
              hasYamlSlug,
              hasYamlSidebar,
          });

          // --- Wikilink Resolution Maps ---
          // Map by filename (case-insensitive)
          const key = name.toLowerCase();
          // Map by title (case-insensitive)
          fileTitleMap.set(docTitle.toLowerCase(), files[files.length - 1]);
          // Map by slug (case-insensitive)
          fileSlugMap.set(docSlug.toLowerCase(), files[files.length - 1]);
          // Map by filename (case-insensitive), allowing duplicates
          if (!fileNameMap.has(key)) fileNameMap.set(key, []);
          fileNameMap.get(key)!.push(files[files.length - 1]);
      }
      // --- Verbose logging for files ---
      utils.verboseLog(`Indexed ${filesInDir.length} files in folder: ${utils.cleanFolderNamesForConsoleOutput(dir)}`);

      // --- Recurse into subfolders ---
      // Reset numbering for each subfolder group
      let highestSubFolderPositionThusFar = 0;
      for (const sub of subdirs) {
          // Walk into each subfolder. Suggest a position that is 10 steps higher than the current highest to place it at the end
          let newSubFolderPos = walk(path.join(dir, sub), destDir, folderDepth + 1, highestSubFolderPositionThusFar + 10);
          if (newSubFolderPos > highestSubFolderPositionThusFar) {
            highestSubFolderPositionThusFar = newSubFolderPos;
          }
      }

      // Return the sidebar position used for this folder
      // This allows auto-assigning sidebar positions for sibling folders after this folder
      return thisFolderSidebarPosition;
    }

    // Start walking from the root source directory
    walk(src, '', 0);

    // --- Sanity check for duplicate source filenames ---
    // Warn if multiple files have the same name (case-insensitive), which could cause wikilink ambiguity
    for (const [key, arr] of fileNameMap.entries()) {
        if (arr.length > 1) {
            console.warn(`⚠️  Duplicate source filename detected for wikilink resolution: "${key}"`);
            if (utils.VERBOSE) {
              arr.forEach(entry => utils.verboseLog(`  Duplicate: ${entry.sourcePath}`));
            }
        }
    }

    // output the index as a JSON object for debugging, saving it to master-index.json
    const indexPath = path.join(utils.DEST, 'master-index.json');
    fs.writeFileSync(indexPath, JSON.stringify({ _comment: "This file was autogenerated by step2-buildindex.ts for debugging. Do not edit.", files, folders, fileTitleMap, fileSlugMap, fileNameMap }, null, 2), 'utf8');
    
    // output status
    utils.verboseLog(`Index built with ${files.length} files and ${folders.length} folders.`);

    // output the index to the console for debugging
    if (utils.DEBUG) {
      console.log(JSON.stringify({ files, folders }, null, 2));
    }

    // Write the sidebar file based on the built index
    writeSidebar({ files, folders, fileTitleMap, fileSlugMap, fileNameMap });

    // Return the complete index
    return { files, folders, fileTitleMap, fileSlugMap, fileNameMap };
}



/**
 * Writes a Docusaurus sidebars.ts file based on the built index.
 * Builds a tree of categories mirroring the folder structure.
 * Each folder becomes a category with label = destTitle,
 * id = based on destDir (number-prefixed), and an optional link to its index doc.
 *
 * @param index - The full Index object built from the docs folder.
 */
function writeSidebar(index: Index) {
  // Build quick lookup: folderPath → folder entry
  const folderMap = new Map<string, FolderIndexEntry>();
  for (const folder of index.folders) {
    folderMap.set(folder.sourcePath, folder);
  }

  // Build quick lookup: folderPath → files
  const filesByFolder = new Map<string, FileIndexEntry[]>();
  for (const file of index.files) {
    const arr = filesByFolder.get(file.sourceDir) || [];
    arr.push(file);
    filesByFolder.set(file.sourceDir, arr);
  }

  // Recursively build a category for a folder
  function buildCategory(folder: FolderIndexEntry): any {
    const folderFiles = filesByFolder.get(folder.sourcePath) || [];

    // Look for an index doc
    const indexFile = folderFiles.find(
      f =>
        f.sourceName.toLowerCase() === 'index' ||
        f.sourceName.toLowerCase() === 'readme' ||
        f.sourceName.toLowerCase() === folder.sourceName.toLowerCase()
    );

    const category: any = {
      type: 'category',
      label: folder.destTitle,
      items: [] as any[],
    };

    // Link category to index doc if found
    if (indexFile && utils.isMarkdownOrText(indexFile.destSlug)) {
      category.link = {
        type: 'doc',
        // id: path.posix.join(folder.destDir, indexFile.destSlug.replace(/\.md$/, '')),
        // id: path.posix.join(folder.destSlug, indexFile.destSlug.replace(/\.md$/, '')),
        id: buildDocId(indexFile, folderMap),
      };
    }

    // Add non-index files as docs
    for (const file of folderFiles) {
      if (indexFile && file === indexFile) continue;
      if (!utils.isMarkdownOrText(file.destSlug)) continue;  // Skip jpg, gif, log, etc.

      category.items.push({
        type: 'doc',
        // id: path.posix.join(folder.destDir, file.destSlug.replace(/\.md$/, '')),
        // id: path.posix.join(folder.destSlug, file.destSlug.replace(/\.md$/, '')),
        id: buildDocId(file, folderMap),
        label: file.destTitle,
        ...(file.sidebarPosition >= 0 ? { position: file.sidebarPosition } : {})
      });
    }

    // Add subfolders as nested categories
    const subfolders = index.folders.filter(
      f => path.dirname(f.sourcePath) === folder.sourcePath
    );
    for (const sub of subfolders) {
      category.items.push(buildCategory(sub));
    }

    return category;
  }

  // Root-level categories (those with depth 0 in your index)
  const rootFolders = index.folders.filter(f => f.destDir === '');
  const sidebarItems: any[] = [];

  for (const root of rootFolders) {
    // Its direct subfolders become top-level categories
    const subfolders = index.folders.filter(
      f => path.dirname(f.sourcePath) === root.sourcePath
    );
    for (const sub of subfolders) {
      sidebarItems.push(buildCategory(sub));
    }

    // Root-level files (not in any subfolder)
    const rootFiles = filesByFolder.get(root.sourcePath) || [];
    for (const file of rootFiles) {
      sidebarItems.push({
        type: 'doc',
        id: path.posix.join(root.destDir, file.destSlug.replace(/\.md$/, '')),
        label: file.destTitle,
        ...(file.sidebarPosition >= 0 ? { position: file.sidebarPosition } : {})
      });
    }
  }

  const sidebarsExport = `//
// Auto-generated by import-obsidian inside step2-buildIndex.ts
// Do not edit directly - modifications will be overwritten

import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  'z2k-templates-docs': ${JSON.stringify(sidebarItems, null, 2)}
};

export default sidebars;
`;

  fs.writeFileSync(SIDEBAR_PATH, sidebarsExport, 'utf8');
  console.log(`✅ Sidebar written to ${SIDEBAR_PATH}`);
}



function buildSidebarTree(index: Index) {
  // Create a map: folderPath -> sidebar category
  const folderMap = new Map<string, any>();

  for (const folder of index.folders) {
    const category: any = {
      type: 'category',
      label: folder.destTitle,
      items: [],
      ...(folder.sidebarPosition >= 0 ? { position: folder.sidebarPosition } : {})
    };

    // Link to same-name index file if it exists
    const indexFile = index.files.find(
      f => f.sourceDir === folder.sourcePath &&
           (f.sourceName.toLowerCase() === 'index' ||
            f.sourceName.toLowerCase() === 'readme' ||
            f.sourceName.toLowerCase() === folder.sourceName.toLowerCase())
    );
    if (indexFile && utils.isMarkdownOrText(indexFile.destSlug)) {
        category.link = {
            type: 'doc',
            id: buildDocId(indexFile, folderMap),
            ...(indexFile.sidebarPosition >= 0 ? { position: indexFile.sidebarPosition } : {})
        };
    }

    folderMap.set(folder.sourcePath, category);

    // Attach to parent or root
    const parentPath = path.dirname(folder.sourcePath);
    if (folderMap.has(parentPath)) {
      folderMap.get(parentPath).items.push(category);
    }
  }

  // Add files as leaf docs
  for (const file of index.files) {
    const folderCategory = folderMap.get(file.sourceDir);
    if (!folderCategory) continue;

    // Skip the index file (already linked)
    if (folderCategory.link && folderCategory.link.id.endsWith(file.destSlug.replace(/\.md$/, ''))) continue;

    folderCategory.items.push({
      type: 'doc',
      id: path.posix.join(
        index.folders.find(f => f.sourcePath === file.sourceDir)?.destSlug || '',
        file.destSlug.replace(/\.md$/, '')
      ),
      label: file.destTitle,
    });
  }

  // The root folder will be at sourcePath = src (whatever you walked from)
  return folderMap.get(index.folders[0].sourcePath).items;
}

function buildDocId(file: FileIndexEntry, folderMap: Map<string, FolderIndexEntry>): string {
  // Walk up the folder tree to collect slugs
  const parts: string[] = [file.destSlug.replace(/\.md$/, '')];
  let currentDir = file.sourceDir;

  while (folderMap.has(currentDir)) {
    const folder = folderMap.get(currentDir)!;

    // Skip adding the top-level "docs" slug
    if (folder.destSlug && folder.destSlug !== 'docs') {
      parts.unshift(folder.destSlug); // add slug to front
    }

    const parent = path.dirname(currentDir);
    if (parent === currentDir) break; // stop at filesystem root
    currentDir = parent;
  }

  return parts.join('/');
}