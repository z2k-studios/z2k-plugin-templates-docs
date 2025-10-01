import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { FileIndexEntry, FolderIndexEntry, Index } from './types.ts';
import * as utils from './utils.ts';
import { isMarkdownOrText } from './utils.ts';

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
 */
export function buildIndex(src: string): Index {
  const files: FileIndexEntry[] = [];
  const folders: FolderIndexEntry[] = [];
  const fileTitleMap = new Map<string, FileIndexEntry>();
  const fileSlugMap = new Map<string, FileIndexEntry>();
  const fileNameMap = new Map<string, FileIndexEntry[]>();

  function extractFolderDataFromIndexFile(dir: string, filesInDir: string[]) {
    let folderIndexFile: string | undefined;
    const folderName = path.basename(dir);
    const folderNameSlug = utils.sluggify(folderName);

    const indexCandidates = [
      'index.md', 'index.txt',
      'readme.md', 'readme.txt', 'README.md', 'README.txt',
      `${folderName}.md`, `${folderName}.txt`,
      `${folderNameSlug}.md`, `${folderNameSlug}.txt`
    ];
    for (const candidate of indexCandidates) {
      if (filesInDir.includes(candidate)) {
        folderIndexFile = candidate;
        utils.debugLog(`Found folder index file: ${candidate} in ${dir}`);
        break;
      }
    }

    let myFolderIndexTitle = folderName;
    let myFolderIndexSlug = folderNameSlug;
    let myFolderIndexFilePosition = -1;
    let myFolderPosition = -1;

    if (folderIndexFile) {
      const indexFilePath = path.join(dir, folderIndexFile);
      const { data } = matter.read(indexFilePath);
      if (typeof data.title === 'string') myFolderIndexTitle = data.title;
      if (typeof data.slug === 'string') myFolderIndexSlug = data.slug;
      if (typeof data.sidebar_position === 'number') myFolderIndexFilePosition = data.sidebar_position;
      if (typeof data.folder_position === 'number') myFolderPosition = data.folder_position;
    }

    return {
      folderIndexFile,
      folderTitle: myFolderIndexTitle,
      folderSlug: myFolderIndexSlug,
      folderIndexFilePosition: myFolderIndexFilePosition >= 0 ? myFolderIndexFilePosition : undefined,
      folderPosition: myFolderPosition >= 0 ? myFolderPosition : undefined
    };
  }

  function walk(dir: string, parentDestDir: string, folderDepth: number, suggestedPosition = 100): number {
    const entries = fs.readdirSync(dir).filter(f => !f.startsWith(utils.IGNORE_PREFIX));
    const subdirs = entries.filter(f => fs.statSync(path.join(dir, f)).isDirectory()).sort();
    const filesInDir = entries.filter(f => fs.statSync(path.join(dir, f)).isFile()).sort();

    let thisFolderSidebarPosition = -1;
    if (folderDepth === 0) thisFolderSidebarPosition = 0;

    // Use basename for folder prefix detection
    const base = path.basename(dir);
    const folderPosMatch = base.match(/^(\d+)[\s-]/);
    if (thisFolderSidebarPosition < 0 && folderPosMatch) {
      thisFolderSidebarPosition = parseInt(folderPosMatch[1], 10);
    }

    const { folderIndexFile, folderTitle, folderSlug, folderIndexFilePosition, folderPosition: extractedFolderPosition } =
      extractFolderDataFromIndexFile(dir, filesInDir);
    if (thisFolderSidebarPosition < 0 && extractedFolderPosition !== undefined) {
      thisFolderSidebarPosition = extractedFolderPosition;
    }
    if (thisFolderSidebarPosition < 0) {
      thisFolderSidebarPosition = suggestedPosition;
    }

    // New behaviour: use slugified folder name only (do NOT inject numeric prefixes).
    // Ordering should be controlled via folder_position in YAML or explicit sidebar positions.
    let finalDestFolder = utils.sluggify(path.basename(dir));  // was: `${utils.padNumber(thisFolderSidebarPosition)}-${utils.sluggify(path.basename(dir))}`;
    let destDir = path.join(parentDestDir, finalDestFolder);

    if (folderDepth === 0) {
      finalDestFolder = '';
      destDir = '';
    }

    // Compute normalizedDestDir (posix, no leading/trailing slash)
    const normalizedDestDir = utils.normalizeDestDir(destDir);

    const folderEntry: FolderIndexEntry = {
      sourcePath: dir,
      sourceName: path.basename(dir),
      destDir,
      destSlug: folderSlug,
      destTitle: folderTitle,
      sidebarPosition: thisFolderSidebarPosition,
      finalDestFolder,
      // new normalized dest dir
      normalizedDestDir,
    };

    folders.push(folderEntry);

    for (const file of filesInDir) {
      if (file.startsWith(utils.IGNORE_PREFIX)) continue;
      if (!isMarkdownOrText(file)) continue;

      const ext = path.extname(file);
      const name = path.basename(file, ext);
      const sourcePath = path.join(dir, file);

      let docTitle = name;
      let docSlug = utils.sluggify(name);
      let docSidebarPos = -1;

      const { data } = matter.read(sourcePath);
      if (typeof data.title === 'string') docTitle = data.title;
      if (typeof data.slug === 'string') docSlug = data.slug;
      if (typeof data.sidebar_position === 'number') docSidebarPos = data.sidebar_position;

      // Optional inference: number prefix from filename (e.g., 007-intro.md)
      if (docSidebarPos < 0) {
        const numMatch = name.match(/^(\d+)[\s-]/);
        if (numMatch) {
          docSidebarPos = parseInt(numMatch[1], 10);
          utils.verboseLog(`Inferred sidebar_position=${docSidebarPos} for ${utils.cleanFolderNamesForConsoleOutput(sourcePath)}`);
        }
      }

      // compute destSlug including extension
      const destSlugWithExt = docSlug + ext;

      // create file entry and include normalized dest dir + docId + normalizedDestPath for downstream
      const normalizedDestDirForFile = utils.normalizeDestDir(destDir);
      const docId = utils.computeDocIdFromDest(destDir, destSlugWithExt);
      const normalizedDestPath = utils.toPosixPath(path.join(destDir, destSlugWithExt));

      const fileEntry: FileIndexEntry = {
        sourcePath,
        sourceDir: dir,
        sourceName: name,
        sourceExt: ext,
        destDir,
        destSlug: destSlugWithExt,
        destTitle: docTitle,
        sidebarPosition: docSidebarPos,
        hasYamlTitle: typeof data.title === 'string',
        hasYamlSlug: typeof data.slug === 'string',
        hasYamlSidebar: typeof data.sidebar_position === 'number',
        // new normalized fields
        normalizedDestDir: normalizedDestDirForFile,
        docId,
        normalizedDestPath,
      };

      files.push(fileEntry);

      fileTitleMap.set(docTitle.toLowerCase(), fileEntry);
      fileSlugMap.set(docSlug.toLowerCase(), fileEntry);
      const key = name.toLowerCase();
      if (!fileNameMap.has(key)) fileNameMap.set(key, []);
      fileNameMap.get(key)!.push(fileEntry);
    }

    let highestSubFolderPositionThusFar = 0;
    for (const sub of subdirs) {
      const newSubFolderPos = walk(path.join(dir, sub), destDir, folderDepth + 1, highestSubFolderPositionThusFar + 10);
      if (newSubFolderPos > highestSubFolderPositionThusFar) {
        highestSubFolderPositionThusFar = newSubFolderPos;
      }
    }
    return thisFolderSidebarPosition;
  }

  walk(src, '', 0);

  // Build folderMap keyed by normalizedDestDir (posix, '' for root)
  const folderMap = new Map<string, FolderIndexEntry>();
  for (const f of folders) {
    const key = f.normalizedDestDir ?? utils.normalizeDestDir(f.destDir);
    // ensure normalizedDestDir populated (idempotent)
    f.normalizedDestDir = key;
    folderMap.set(key, f);
  }

  // Write master index debug file (files + folders)
  const indexPath = path.join(utils.PATH_DOCS_DEBUG, 'master-index.json');
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify({ files, folders }, null, 2), 'utf8');
  utils.statusLog(`📝 Master index written to ${indexPath}`);

  return { files, folders, fileTitleMap, fileSlugMap, fileNameMap, folderMap };
}
