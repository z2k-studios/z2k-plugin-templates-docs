/**
 * Step 3: Generate multi-sidebar ./sidebars.ts (single docs plugin instance)
 * ----------------------------------------------------------------------------
 * - Guardrail: DO NOT suggest or emit multiple docs plugin instances.
 * - Exports multiple named sidebars from a single ./sidebars.ts file:
 *     - "Intro": root docs (docs/) + optional cross-links
 *     - One sidebar per top-level folder directly under docs/
 *
 * Sidebar rules
 * -------------
 * Intro sidebar:
 *   - Always includes markdown docs in the root of docs/.
 *   - Sorted by sidebar_position (ascending), then by label (natural alpha).
 *   - Appends optional "ref" items loaded from intro-crosslinks.json (array of {id,label}).
 *
 * Top-level folders:
 *   - Each becomes its own sidebar keyed by folder.destTitle (or folder label).
 *   - The folder’s “index doc” (index.md | readme.md | <folder>.md) is emitted first/top.
 *     Its label comes from YAML title (destTitle) or falls back to "Overview".
 *   - If a folder contains *only* that index doc (no other docs and no subfolders),
 *     the sidebar is exactly one item: the index doc.
 *   - Otherwise, after the index doc:
 *       1) immediate subfolders as categories (recursively built),
 *       2) then remaining non-index docs at this level.
 *
 * Docusaurus category linking:
 *   - For a folder/category that has its own index doc, a `link` to that doc is attached.
 *
 * Files written
 * -------------
 *   - ./sidebars.ts                  (the canonical multi-sidebar export)
 *   - ./docs/debug/docs-tree.txt     (debug tree view; path can be changed below)
 *
 * Adjust paths as appropriate for your repo layout.
 */

import fs from 'fs';
import path from 'path';
import { Index, FolderIndexEntry, FileIndexEntry } from './types.ts';
import * as utils from './utils.ts'

// ------------------------------------------------------------------------------------------
// CONFIG: tweak these to your repo layout
// ------------------------------------------------------------------------------------------

// Where to write the canonical, multi-sidebar file:
const SIDEBAR_PATH = path.resolve(process.cwd(), 'sidebars.ts');

// Debug tree txt output (optional but useful when diagnosing ordering/IDs):
const DEBUG_TREE_PATH = path.resolve(utils.PATH_DOCS_DEBUG, './docs-tree.txt');
const DEBUG_ASCII_TREE_PATH = path.resolve(utils.PATH_DOCS_DEBUG, './docs-tree-ascii.txt');

// Where to look for optional cross-links file(s) for the Intro sidebar:
const INTRO_CROSSLINK_CANDIDATES = [
  path.resolve(utils.PATH_DOCUSAURUS, './intro-crosslinks.json'),
  path.resolve(utils.PATH_DOCUSAURUS, './intro-crosslinks.ts'),
  path.resolve(utils.PATH_DOCUSAURUS, './intro-crosslinks.js'), // CommonJS module exporting array or {links:[...]}
];

// File base names treated as "index" of a folder:
const INDEX_BASENAMES = new Set(['index', 'readme']);

// ------------------------------------------------------------------------------------------
// PUBLIC API
// ------------------------------------------------------------------------------------------

/**
 * Entrypoint: generate multi-sidebar ./sidebars.ts from the step2 index
 */
/**
 * Generate the multi-sidebar `sidebars.ts` file using destination-first keys.
 *
 * - Relies on fields produced by step2 (preferred): file.docId, file.normalizedDestDir
 * - Falls back to destDir/destSlug when those aren't present.
 */
export function generateSidebars(index: Index): void {


  utils.debugLog(`Generating sidebars.ts from index with ${index.files.length} files and ${index.folders.length} folders.`);
  utils.debugLog("Path configs:\nDOCUSAURUS:", utils.PATH_DOCUSAURUS, "\nDOCS:", utils.PATH_DOCS, "\nDEBUG:", utils.PATH_DOCS_DEBUG);

  // Build a folder map keyed by normalized destination directory (posix, no slashes)
  const folderMap = new Map<string, FolderIndexEntry>();
  for (const f of index.folders) {
    const raw = (f.normalizedDestDir ?? f.destDir ?? '').replace(/^[/\\]+|[/\\]+$/g, '');
    const key = utils.toPosix(raw); // '' for docs root
    folderMap.set(key, f);
  }

  // Group files by destination folder (uses destDir only)
  const filesByFolder = groupFilesByFolder(index.files);
  // debugPrintFilesByFolder(filesByFolder, folderMap);

  // Determine the docs root folder (destDir === '' preferred)
  let docsRoot = index.folders.find((f) => (f.destDir || '') === '') ?? undefined;
  if (!docsRoot) {
    docsRoot = index.folders.find((f) => (f.normalizedDestDir || f.finalDestFolder || '') === '') ?? undefined;
  }
  if (!docsRoot) {
    throw new Error('No docs root folder found (expected a FolderIndexEntry with destDir === "" or normalizedDestDir === "").');
  }

  // canonical docs root dest key (posix, no leading/trailing slash)
  const docsRootRaw = (docsRoot.normalizedDestDir ?? docsRoot.destDir ?? '').replace(/^[/\\]+|[/\\]+$/g, '');
  const docsRootDest = utils.toPosix(docsRootRaw);

  // container for sidebars
  const sidebars: Record<string, any[]> = {};

  // Intro sidebar: root-level docs + cross-links
  sidebars['Intro'] = buildIntroSidebar(docsRoot, folderMap, filesByFolder);

  // find immediate child folders under docsRoot (destination-only)
  const topLevelFolders = index.folders
    .filter((f) => {
      const fRaw = (f.normalizedDestDir ?? f.destDir ?? '').replace(/^[/\\]+|[/\\]+$/g, '');
      const fDestPosix = utils.toPosix(fRaw);

      // relative path from docsRootDest to fDestPosix
      const rel = path.posix.relative(docsRootDest, fDestPosix);

      // Immediate child if relative is exactly one segment (and not up-level, and not empty)
      return !!rel && !rel.startsWith('..') && rel.split('/').length === 1;
    })
    .sort((a, b) => cmpByPosThenLabel(a, b, (x) => x.sidebarPosition, (x) => x.destTitle));

  for (const top of topLevelFolders) {
    const key = deriveSidebarKey(top);
    sidebars[key] = buildTopLevelSidebar(top, index, folderMap, filesByFolder);
  }

  // Write sidebars.ts
  ensureDirForFile(SIDEBAR_PATH);
  const fileText = renderSidebarsTs(sidebars);
  fs.writeFileSync(SIDEBAR_PATH, fileText, 'utf8');
  console.log(`✅ Wrote multi-sidebar file: ${SIDEBAR_PATH}`);

  // Debug tree (text)
  ensureDirForFile(DEBUG_TREE_PATH);
  const treeText = renderDebugTree(docsRoot, index, folderMap, filesByFolder);
  fs.writeFileSync(DEBUG_TREE_PATH, treeText, 'utf8');
  console.log(`✅ Wrote debug tree: ${DEBUG_TREE_PATH}`);

  // ASCII debug tree
  const asciiOutput = buildAsciiTree(index, folderMap, filesByFolder);
  ensureDirForFile(DEBUG_ASCII_TREE_PATH);
  fs.writeFileSync(DEBUG_ASCII_TREE_PATH, asciiOutput, 'utf8');
  console.log(`✅ ASCII debug tree written to ${DEBUG_ASCII_TREE_PATH}`);
}


// ------------------------------------------------------------------------------------------
// INTRO SIDEBAR
// ------------------------------------------------------------------------------------------

/**
 * Build the Intro sidebar:
 * - Root-level docs found in docs/ (sorted by sidebar_position then label)
 * - Optional cross-links loaded from intro-crosslinks.(json|js)
 */
function buildIntroSidebar(
  docsRoot: FolderIndexEntry,
  folderMap: Map<string, FolderIndexEntry>,
  filesByFolder: Map<string, FileIndexEntry[]>
): any[] {
  const items: any[] = [];

  // Root docs (destDir === '')
  const rootKey = (docsRoot.normalizedDestDir ?? docsRoot.destDir ?? '').toString().replace(/^[/\\]+|[/\\]+$/g, '');
  const rootKeyPosix = utils.toPosix(rootKey);
  const rootFiles = (filesByFolder.get(rootKeyPosix) || [])
    .filter((f) => isMarkdownOrText(f.destSlug))
    .sort((a, b) => cmpByPosThenLabel(a, b, (x) => x.sidebarPosition, (x) => x.destTitle));

  for (const file of rootFiles) {
    items.push({
      type: 'doc',
      id: buildDocId(file),
      label: safeTitle(file.destTitle),
    });
  }

  // If no root files found, try a best-effort scan across all files for a README/Introduction file
  if (items.length === 0) {
    // prefer explicit readme/index anywhere with docId at root or destSlug named 'readme'
    const fallbackCandidates: FileIndexEntry[] = [];
    for (const arr of filesByFolder.values()) {
      for (const f of arr) {
        const fid = f.docId ?? utils.computeDocIdFromDest(f.destDir, f.destSlug);
        // docId at root (no '/')
        if (fid && !fid.includes('/')) {
          fallbackCandidates.push(f);
          continue;
        }
        // named readme/index
        const base = stripExt(f.destSlug || f.sourceName || '').toLowerCase();
        if (INDEX_BASENAMES.has(base)) fallbackCandidates.push(f);
      }
    }

    // de-duplicate by docId and prefer files with explicit YAML title 'Introduction' or README base
    const seen = new Set<string>();
    for (const f of fallbackCandidates) {
      const fid = buildDocId(f);
      if (seen.has(fid)) continue;
      seen.add(fid);
      // include only likely-intro docs (title or readme)
      const base = stripExt(f.destSlug || f.sourceName || '').toLowerCase();
      if ((f.destTitle || '').toLowerCase().includes('intro') || INDEX_BASENAMES.has(base)) {
        items.push({ type: 'doc', id: fid, label: safeTitle(f.destTitle) });
      }
    }
  }

  // Cross links
  const cross = loadIntroCrosslinks();
  utils.debugLog(`Loaded ${cross.length} intro cross-links:\n${JSON.stringify(cross)}`);
  for (const link of cross) {
    items.push({
      type: 'ref',
      id: link.id,
      label: link.label,
    });
  }

  return items;
}

// ------------------------------------------------------------------------------------------
// TOP-LEVEL SIDEBAR (one per immediate child folder of docs/)
// ------------------------------------------------------------------------------------------

/**
 * Build a sidebar array for a single top-level folder.
 *
 * - If folder contains only its "index doc" and no other docs/subfolders, return [indexDoc].
 * - Else: [indexDoc?] + subcategories + non-index docs, each sorted appropriately.
 */
function buildTopLevelSidebar(
  folder: FolderIndexEntry,
  index: Index,
  folderMap: Map<string, FolderIndexEntry>,
  filesByFolder: Map<string, FileIndexEntry[]>
): any[] {
  const items: any[] = [];

  const folderKey = utils.toPosix(((folder.normalizedDestDir ?? folder.destDir ?? '') as string).replace(/^[/\\]+|[/\\]+$/g, ''));
  const folderFiles = (filesByFolder.get(folderKey) || []).filter((f) => isMarkdownOrText(f.destSlug));
  const indexDoc = detectIndexDoc(folder, folderFiles);

  const subfolders = index.folders
    .filter((f) => path.dirname(f.sourcePath) === folder.sourcePath)
    .sort((a, b) => cmpByPosThenLabel(a, b, (x) => x.sidebarPosition, (x) => x.destTitle));

  const nonIndexDocs = folderFiles
    .filter((f) => indexDoc ? f !== indexDoc : true)
    .sort((a, b) => cmpByPosThenLabel(a, b, (x) => x.sidebarPosition, (x) => x.destTitle));

  const hasOnlyIndex = !!indexDoc && subfolders.length === 0 && nonIndexDocs.length === 0;

  if (hasOnlyIndex) {
    return [{
      type: 'doc',
      id: buildDocId(indexDoc!, folderMap),
      label: safeTitle(indexDoc!.destTitle) || 'Overview',
    }];
  }

  // First: folder index doc (if any)
  if (indexDoc) {
    items.push({
      type: 'doc',
      id: buildDocId(indexDoc),
      label: safeTitle(indexDoc.destTitle) || 'Overview',
    });
  }

  // Then: immediate subfolders as categories
  for (const sub of subfolders) {
    items.push(buildCategory(sub, index, folderMap, filesByFolder));
  }

  // Finally: non-index docs at this level
  for (const d of nonIndexDocs) {
    items.push({
      type: 'doc',
      id: buildDocId(d, folderMap),
      label: safeTitle(d.destTitle),
    });
  }

  return items;
}

// ------------------------------------------------------------------------------------------
// CATEGORY BUILDER (recursive)
// ------------------------------------------------------------------------------------------

/**
 * Build a category object for a folder (recursively).
 * - If the folder has an index doc, attach `link: { type: 'doc', id }`
 * - Items: [sub-categories first (by folder_position), then docs (by sidebar_position)]
 */
function buildCategory(
  folder: FolderIndexEntry,
  index: Index,
  folderMap: Map<string, FolderIndexEntry>,
  filesByFolder: Map<string, FileIndexEntry[]>
): any {
  const label = safeTitle(folder.destTitle || folder.finalDestFolder || folder.sourceName);

  // get files for this folder (dest-key)
  const folderKey = utils.toPosix(((folder.normalizedDestDir ?? folder.destDir ?? '') as string).replace(/^[/\\]+|[/\\]+$/g, ''));
  const folderFiles = (filesByFolder.get(folderKey) || []).filter((f) => isMarkdownOrText(f.destSlug));
  const indexDoc = detectIndexDoc(folder, folderFiles);

  const children: any[] = [];

  // subfolders first
  const subfolders = index.folders
    .filter((f) => path.dirname(f.sourcePath) === folder.sourcePath)
    .sort((a, b) => cmpByPosThenLabel(a, b, (x) => x.sidebarPosition, (x) => x.destTitle));

  for (const sub of subfolders) {
    children.push(buildCategory(sub, index, folderMap, filesByFolder));
  }

  // then docs
  const otherDocs = folderFiles
    .filter((f) => (indexDoc ? f !== indexDoc : true))
    .sort((a, b) => cmpByPosThenLabel(a, b, (x) => x.sidebarPosition, (x) => x.destTitle));

  for (const f of otherDocs) {
    children.push({
      type: 'doc',
      id: buildDocId(f),
      label: safeTitle(f.destTitle),
    });
  }

  const category: any = {
    type: 'category',
    label,
    items: children,
  };

  if (indexDoc) {
    category.link = {
      type: 'doc',
      id: buildDocId(indexDoc),
    };
  }

  return category;
}

// ------------------------------------------------------------------------------------------
// UTILITIES
// ------------------------------------------------------------------------------------------

/**
 * Detect a folder’s index doc:
 * - index.md | readme.md | <folderName>.md (case-insensitive)
 */
function detectIndexDoc(folder: FolderIndexEntry, files: FileIndexEntry[]): FileIndexEntry | undefined {
  const folderKey = (folder.normalizedDestDir ?? folder.destDir ?? '').toString().replace(/^[/\\]+|[/\\]+$/g, '');
  const folderPosix = utils.toPosix(folderKey);

  // folder base candidates (slug or finalDestFolder or sourceName)
  const folderBases = [
    (folder.finalDestFolder || '').toString(),
    (folder.destSlug || '').toString(),
    (folder.sourceName || '').toString()
  ]
    .map((s) => stripExt(s || '').toLowerCase())
    .filter(Boolean);

  // helper to get file's doc id consistently
  const fileDocId = (f: FileIndexEntry) => (f as any).docId ?? buildDocId(f);

  // 1) exact docId === folderPosix
  {
    const found = files.find((f) => fileDocId(f) === folderPosix);
    if (found) return found;
  }

  // 2) docId === `${folderPosix}/${folderBase}` for any base
  for (const base of folderBases) {
    const expected = folderPosix ? `${folderPosix}/${base}` : base;
    const found = files.find((f) => fileDocId(f) === expected);
    if (found) return found;
  }

  // 3) index/readme basename
  {
    const byIndex = files.find((f) => {
      const base = stripExt(f.destSlug ?? f.sourceName ?? '').toLowerCase();
      return INDEX_BASENAMES.has(base);
    });
    if (byIndex) return byIndex;
  }

  // 4) file whose base matches folder base
  if (folderBases.length) {
    const byName = files.find((f) => folderBases.includes(stripExt(f.destSlug ?? f.sourceName ?? '').toLowerCase()));
    if (byName) return byName;
  }

  return undefined;
}

/**
 * Build a doc id as <destDir>/<destSlug-without-ext>
 * Example:
 *   destDir="how-to-guides/getting-started", destSlug="getting-started-in-two-minutes.md"
 *   → id="how-to-guides/getting-started/getting-started-in-two-minutes"
 */
// NEW: prefer file.docId if present (already computed in step2). Fallback to destDir+destSlug.
function buildDocId(file: FileIndexEntry, _folderMap?: Map<string, FolderIndexEntry>): string {
  // Backwards-compatible: second param accepted but currently unused.

  // 1) Prefer docId computed by step2 (most robust)
  if ((file as any).docId && typeof (file as any).docId === 'string' && (file as any).docId.trim() !== '') {
    return (file as any).docId;
  }

  // 2) Fallback: compute from destDir + destSlug (strip extension)
  const destDirRaw = file.normalizedDestDir ?? (file.destDir ?? '');
  const destDir = utils.toPosix(String(destDirRaw).replace(/^[/\\]+|[/\\]+$/g, ''));
  const slugNoExt = stripExt(file.destSlug ?? file.sourceName ?? '');
  return destDir ? `${destDir}/${slugNoExt}` : slugNoExt;
}

function groupFilesByFolder(files: FileIndexEntry[]): Map<string, FileIndexEntry[]> {
  const map = new Map<string, FileIndexEntry[]>();
  for (const f of files) {
    // prefer normalizedDestDir produced by step2, fall back to destDir
    const rawKey = (f as any).normalizedDestDir ?? f.destDir ?? '';
    const key = utils.toPosix(String(rawKey).replace(/^[/\\]+|[/\\]+$/g, ''));
    const arr = map.get(key) || [];
    arr.push(f);
    map.set(key, arr);
  }
  return map;
}
function isMarkdownOrText(slug: string): boolean {
  const ext = path.extname(slug).toLowerCase();
  return ext === '.md' || ext === '.mdx' || ext === '.txt';
}

function stripExt(name: string): string {
  const ext = path.extname(name);
  return ext ? name.slice(0, -ext.length) : name;
}

function safeTitle(s: string | undefined | null): string {
  return (s || '').trim() || 'Untitled';
}

function ensureDirForFile(filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function cmpByPosThenLabel<T>(
  a: T,
  b: T,
  pos: (x: T) => number | undefined | null,
  label: (x: T) => string | undefined | null
): number {
  const pa = normalizePos(pos(a));
  const pb = normalizePos(pos(b));
  if (pa !== pb) return pa - pb;

  const la = (label(a) || '').toString();
  const lb = (label(b) || '').toString();
  return la.localeCompare(lb, undefined, { numeric: true, sensitivity: 'accent' });
}

function normalizePos(p?: number | null): number {
  // Undefined positions sort after defined ones
  return typeof p === 'number' && !Number.isNaN(p) ? p : Number.POSITIVE_INFINITY;
}

/** Generic-title heuristic */
function isGenericTitle(t?: string): boolean {
  if (!t) return true;
  const normalized = (t || '').toLowerCase().trim();
  const generics = new Set([
    'overview', 'index', 'table of contents', 'table-of-contents', 'table_of_contents',
    'readme', 'introduction', 'intro'
  ]);
  return generics.has(normalized);
}

function humanizeFolderName(folder: FolderIndexEntry): string {
  // try destTitle if it's specific; otherwise fall back to folder path segment
  if (folder.destTitle && !isGenericTitle(folder.destTitle)) return folder.destTitle;
  const name = path.basename(folder.sourcePath).replace(/[-_]+/g, ' ');
  return name.split(' ').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ');
}

function deriveSidebarKey(folder: FolderIndexEntry): string {
  // If destTitle exists and is NOT a generic title like "Overview" or "Index",
  // use it verbatim (this preserves manual punctuation/capitalization).
  const title = (folder.destTitle || '').toString().trim();
  if (title && !isGenericTitle(title)) {
    return title;
  }

  // Otherwise, build a human-friendly name from finalDestFolder / destSlug / destDir
  const fallbackRaw = String(folder.finalDestFolder || folder.destSlug || path.basename(folder.destDir || '') || '')
    .replace(/^\/+|\/+$/g, '')
    .trim();

  if (!fallbackRaw) return 'Overview';

  // If the slug contains hyphens/underscores, convert to Title Case words:
  // "how-to-guides" -> "How To Guides"
  return fallbackRaw
    .split(/[-_\/]+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');
}

// ------------------------------------------------------------------------------------------
// INTRO CROSS-LINKS LOADER
// ------------------------------------------------------------------------------------------

/**
 * Load optional cross-links for the Intro sidebar.
 * Structure:
 *   [
 *     { "id": "how-to-guides/getting-started/getting-started-in-two-minutes", "label": "Getting Started in Two Minutes" },
 *     { "id": "reference-manual/built-in-template-fields/built-in-template-fields", "label": "Built-In Template Fields" }
 *   ]
 * Also supports a CommonJS .js file exporting either an array or { links: [...] }.
 */
function loadIntroCrosslinks(): Array<{ id: string; label: string }> {
  utils.debugLog(`Looking for intro cross-links in candidates:\n${INTRO_CROSSLINK_CANDIDATES.join('\n')}`);
  for (const p of INTRO_CROSSLINK_CANDIDATES) {
    utils.debugLog(`Checking intro cross-links file: ${p}`);
    if (!fs.existsSync(p)) continue;
    try {
      if (p.endsWith('.json')) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        return sanitizeCrosslinks(data);
      }
      if (p.endsWith('.js')) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(p);
        return sanitizeCrosslinks(mod?.default ?? mod);
      }
      if (p.endsWith('.ts')) {
        // Dynamic import of TS file (requires ts-node or equivalent) --> NOTE THIS WILL LIKELY NEED ADJUSTMENT TO BE ESM COMPATIBLE - USE JSON FOR NOW
        return sanitizeCrosslinks(require('ts-node').register().load(p));
      }
      console.warn(`[warn] Unsupported intro cross-links file extension (expected .json, .js, or .ts): ${p}`);
    } catch (err) {
      console.warn(`[warn] Failed to load intro cross-links from ${p}:`, err);
    }
  }
  utils.debugLog('No intro cross-links file found.');
  return [];
}

function sanitizeCrosslinks(x: any): Array<{ id: string; label: string }> {
  if (Array.isArray(x)) {
    return x.filter(validCrosslink).map((y) => ({ id: y.id, label: y.label }));
  }
  if (x && Array.isArray(x.links)) {
    return x.links.filter(validCrosslink).map((y: any) => ({ id: y.id, label: y.label }));
  }
  return [];
}

function validCrosslink(y: any): y is { id: string; label: string } {
  return y && typeof y.id === 'string' && typeof y.label === 'string';
}

// ------------------------------------------------------------------------------------------
// FILE RENDERERS
// ------------------------------------------------------------------------------------------

function renderSidebarsTs(sidebars: Record<string, any[]>): string {
  // Lightweight TS serializer for predictable, human-readable output
  function serialize(obj: any, indent = ''): string {
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      return '[\n' + obj.map((v) => indent + '  ' + serialize(v, indent + '  ')).join(',\n') + '\n' + indent + ']';
    }
    if (obj && typeof obj === 'object') {
      const entries = Object.entries(obj).map(([k, v]) => {
        // ONLY allow unquoted keys that are valid JS identifiers
        const isIdentifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k);
        const safeKey = isIdentifier ? k : JSON.stringify(k);
        return `${indent}  ${safeKey}: ${serialize(v, indent + '  ')}`;
      });
      if (entries.length === 0) return '{}';
      return '{\n' + entries.join(',\n') + '\n' + indent + '}';
    }
    return JSON.stringify(obj);
  }

  const body = serialize(sidebars, '');

  return `//
// ./sidebars.ts :: Auto-generated by step3 (generateSidebars)
// == Multi Sidebar Mode (single docs plugin instance) ==
// Created on ${new Date().toLocaleDateString('en-US', { timeZone: 'PST', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })} PST
// Guardrail: DO NOT add multiple docs plugin instances.
// This file is the single source of truth and will be overwritten.
//
import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = ${body};

export default sidebars;
`;
}


// Helper: produce the normalized lookup key used in filesByFolder
function folderKeyFor(folder: FolderIndexEntry): string {
  const raw = (folder as any).normalizedDestDir ?? folder.destDir ?? '';
  // normalize separators and strip leading/trailing slashes
  return String(raw).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

// A simple text tree to make visual inspection easy
function renderDebugTree(
  root: FolderIndexEntry,
  index: Index,
  folderMap: Map<string, FolderIndexEntry>,
  filesByFolder: Map<string, FileIndexEntry[]>
): string {
  const lines: string[] = [];
  const rootKey = folderKeyFor(root);
  lines.push(`Root: ${root.sourcePath}  (destDir="${root.destDir}" normalized="${rootKey}")`);

  function walkFolder(folder: FolderIndexEntry, depth: number) {
    const indent = '  '.repeat(depth);
    const key = folderKeyFor(folder);
    const files = (filesByFolder.get(key) || []).filter((f) => isMarkdownOrText(f.destSlug));
    const idx = detectIndexDoc(folder, files);

    // folder header: show title, finalDestFolder, and sidebar position
    lines.push(
      `${indent}- [dir] ${safeTitle(folder.destTitle)} (final="${folder.finalDestFolder || folder.destSlug || ''}", pos=${fmtPos(
        folder.sidebarPosition
      )}, key="${key}")`
    );

    // index file (if any)
    if (idx) {
      lines.push(
        `${indent}  - [index] ${safeTitle(idx.destTitle)} (docId=${buildDocId(idx)}, pos=${fmtPos(idx.sidebarPosition)}, file="${idx.sourceName}${idx.sourceExt || ''}")`
      );
    }

    // non-index docs
    const otherDocs = files
      .filter((f) => (idx ? f !== idx : true))
      .sort((a, b) => cmpByPosThenLabel(a, b, (x) => x.sidebarPosition, (x) => x.destTitle));

    for (const d of otherDocs) {
      lines.push(
        `${indent}  - [doc] ${safeTitle(d.destTitle)} (docId=${buildDocId(d)}, pos=${fmtPos(
          d.sidebarPosition
        )}, slug="${d.destSlug}", file="${d.sourceName}${d.sourceExt || ''}")`
      );
    }

    // recurse to child folders (by sourcePath relationship)
    const childrenFolders = index.folders
      .filter((f) => path.dirname(f.sourcePath) === folder.sourcePath)
      .sort((a, b) => cmpByPosThenLabel(a, b, (x) => x.sidebarPosition, (x) => x.destTitle));

    for (const sub of childrenFolders) {
      walkFolder(sub, depth + 1);
    }
  }

  walkFolder(root, 0);
  return lines.join('\n') + '\n';
}


// ====================================================================================================
// Helper: buildAsciiTree
// ====================================================================================================
/**
 * Builds a Unix `tree`-like ASCII view of the docs/index tree.
 *
 * Each folder line shows the folder title and pos.
 * Each doc line shows title, pos and source filename.
 */
function buildAsciiTree(
  index: Index,
  folderMap: Map<string, FolderIndexEntry>,
  filesByFolder: Map<string, FileIndexEntry[]>
): string {
  // Find logical root folders (those with empty normalizedDestDir)
  const rootFolders = index.folders.filter((f) => {
    const k = (f as any).normalizedDestDir ?? f.destDir ?? '';
    return String(k).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') === '';
  });

  let result = '';
  // For each root (usually a single docs/ root), walk its immediate child folders
  for (const root of rootFolders) {
    result += `Root: ${root.sourcePath}\n`;
    const topLevel = index.folders
      .filter((f) => path.dirname(f.sourcePath) === root.sourcePath)
      .sort((a, b) => cmpByPosThenLabel(a, b, (x) => x.sidebarPosition, (x) => x.destTitle));

    for (const sub of topLevel) {
      result += walk(sub, '');
    }

    // root-level docs (if any)
    const rootKey = folderKeyFor(root);
    const rootFiles = (filesByFolder.get(rootKey) || [])
      .filter((f) => isMarkdownOrText(f.destSlug))
      .sort((a, b) => cmpByPosThenLabel(a, b, (x) => x.sidebarPosition, (x) => x.destTitle));
    for (const file of rootFiles) {
      result += `├── ${safeTitle(file.destTitle)} (pos=${fmtPos(file.sidebarPosition)}, "${file.sourceName}${file.sourceExt || ''}")\n`;
    }
  }

  return result;

  function walk(folder: FolderIndexEntry, prefix: string): string {
    let output = `${prefix}${safeTitle(folder.destTitle)} (pos=${fmtPos(folder.sidebarPosition)}, final="${folder.finalDestFolder || folder.destSlug || ''}")\n`;

    const key = folderKeyFor(folder);
    const folderFiles = (filesByFolder.get(key) || []).slice();

    const indexFile = detectIndexDoc(folder, folderFiles);
    // print index file first (if present)
    if (indexFile) {
      output += `${prefix}├── ${safeTitle(indexFile.destTitle)} (pos=${fmtPos(indexFile.sidebarPosition)}, "${indexFile.sourceName}${indexFile.sourceExt || ''}")\n`;
    }

    const nonIndexDocs = folderFiles
      .filter((f) => f !== indexFile && isMarkdownOrText(f.destSlug))
      .sort((a, b) => cmpByPosThenLabel(a, b, (x) => x.sidebarPosition, (x) => x.destTitle));

    for (const file of nonIndexDocs) {
      output += `${prefix}├── ${safeTitle(file.destTitle)} (pos=${fmtPos(file.sidebarPosition)}, "${file.sourceName}${file.sourceExt || ''}")\n`;
    }

    const subfolders = index.folders
      .filter((f) => path.dirname(f.sourcePath) === folder.sourcePath)
      .sort((a, b) => cmpByPosThenLabel(a, b, (x) => x.sidebarPosition, (x) => x.destTitle));

    for (const sub of subfolders) {
      output += walk(sub, prefix + '│   ');
    }

    return output;
  }
}

// Format a sidebar/folder position number or "auto"
function fmtPos(p?: number | null): string {
  return typeof p === 'number' && !Number.isNaN(p) ? String(p) : 'auto';
}

// ====================================================================================================
// Helper: writeAsciiTree
// ====================================================================================================
/**
 * Writes the ASCII debug tree to disk.
 */
function writeAsciiTree(outputPath: string, content: string) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, 'utf8');
}


function debugPrintFilesByFolder(filesByFolder: Map<string, FileIndexEntry[]>, folderMap?: Map<string, FolderIndexEntry>) {
  console.log('=== filesByFolder keys ===');
  for (const [k, arr] of filesByFolder.entries()) {
    console.log(`- folderKey: "${k}" -> ${arr.length} file(s)`);
    for (const f of arr) {
      const docId = f.docId ?? utils.computeDocIdFromDest(f.destDir, f.destSlug);
      console.log(`    • ${f.destTitle || f.sourceName}  | destSlug="${f.destSlug}" | docId="${docId}"`);
    }
  }
  if (folderMap) {
    console.log('=== folderMap keys ===');
    for (const [k, v] of folderMap.entries()) {
      console.log(`- folderKey: "${k}" -> folder.destTitle="${v.destTitle}", finalDestFolder="${v.finalDestFolder}"`);
    }
  }
}