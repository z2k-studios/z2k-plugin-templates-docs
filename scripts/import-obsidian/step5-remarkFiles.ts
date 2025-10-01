import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { unified, Plugin } from 'unified';
import remarkParse from 'remark-parse';
// import wikiLinkPlugin from '@flowershow/remark-wiki-link';
import remarkStringify, { Options as RemarkStringifyOptions } from 'remark-stringify';
import { visit } from 'unist-util-visit';

import { Index, Summary, FileIndexEntry } from './types.ts';
import * as utils from './utils.ts'

// VERSION 1.1.0

// ====================================================================================================
// Constants
// ====================================================================================================
const UNRESOLVED_LOG_NAME = 'unresolvedLinks.log';


// ====================================================================================================
// Step 5: Copy & Transform Each File
// ====================================================================================================
/**
 * Copies and transforms each file from the source to the destination.
 *
 * @param index - The file index containing metadata about each file.
 * @param summary - The summary object to track the overall progress.
 */
export async function copyAndTransformFiles(index: Index, summary: Summary) {

  // Optionally warn on basename collisions
  warnOnBasenameCollisions(index);

  // Initialize unresolved links log file (clear old contents)
  // NOTE: We use utils.SRC here because unresolved links are logged with absolute paths to the source files and this allows the source repo to be able to load the offending files directly.
  UNRESOLVED_LOG_PATH = path.join(utils.SRC_DOCS, UNRESOLVED_LOG_NAME);
  try {
    fs.ensureDirSync(utils.SRC_DOCS);
    const header = 
`# This file is created by the import-obsidian script (and its typescript step routines - specifically step4-remarkFiles.ts).
# It is intended to allow the user to have clickable links for VS Code into the documentation source files for unresolved links.
# To use these as clickable links:
#    1) open the Z2K System Workspace in VS Code
#    2) go to the Docs folder [ cd "/Users/gp/Vaults/Z2K Studios Workspace/Code/Obsidian Plugins/z2k-plugin-templates/docs" ]
#        (or ${utils.SRC_DOCS} if you are using a different repo name)
#    3) cat this file [ clear &&cat unresolvedLinks.log ]
#    4) Command-Click each link below to open the source file at the specified line/column.
# ---------------------------------------------------------------------------------------------------------------------------
#
`;
    fs.writeFileSync(UNRESOLVED_LOG_PATH, header, 'utf8');
    // Copy the Unresolved log to the Debug folder too
    const debugUnresolvedPath = path.join(utils.PATH_DOCS_DEBUG, UNRESOLVED_LOG_NAME);
    fs.copyFileSync(UNRESOLVED_LOG_PATH, debugUnresolvedPath);
  } catch (e) {
    utils.warningLog('Could not initialize unresolved links log at', UNRESOLVED_LOG_PATH, e);
    UNRESOLVED_LOG_PATH = null;
  }

  // Step through each file in the index
  // --------------------------------------------------------------------------------------------------
  for (const file of index.files) {
    await copyAndTransformAFile(file, index, summary);
  }
}


// -----------------------------------------------------------------------------
// copyAndTransformAFile: Process a single file
// -----------------------------------------------------------------------------
// Helper: process a single file
// Note: this function is async because it uses await for the remark processing
async function copyAndTransformAFile(file: Index['files'][number], index: Index, summary: Summary) {

  // Construct the destination file path
  const destFilePath = path.join(utils.PATH_DOCS, file.destDir, file.destSlug);

  // Ensure the destination directory exists
  fs.ensureDirSync(path.dirname(destFilePath));

  // Verbose logging
  utils.verboseLog(`Processing file: ${utils.cleanFolderNamesForConsoleOutput(file.sourcePath)} -> ${utils.cleanFolderNamesForConsoleOutput(destFilePath)}`);

  // Check if the file is a Markdown or text file - if so, transform it from obsidian to MDX / Docusaurus format
  if (utils.isMarkdownOrText(file.sourceName + file.sourceExt)) {

    // --- Markdown: Transform ---
    let raw = fs.readFileSync(file.sourcePath, 'utf8');
    const parsed = matter(raw);
    let { content, data } = parsed;

    // Determine YAML frontmatter line offset (so remark's line numbers can be adjusted)
    let yamlLineOffset = 0;
    try {
      const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
      if (fmMatch && fmMatch[0]) {
        yamlLineOffset = fmMatch[0].split(/\r?\n/).length - 1;
      }
    } catch (e) {
      yamlLineOffset = 0;
    }

    // Expand Obsidian embeds before remark parses content
    // NOTE: pass the current file sourcePath so preprocessEmbeds can resolve ![[#Heading]] self-embeds.
    content = preprocessEmbeds(content, index, path.dirname(file.sourcePath), file.sourcePath);

    // my custom options for remark-stringify
    // See: https://www.npmjs.com/package/remark-stringify
    const myStringifyOptions: RemarkStringifyOptions = {
      // --- KEY OPTIONS ---
      bullet: "-",              // use "-" for list items
      rule: "-",              // keep HR as '---'
      ruleSpaces: false,        // no spaces around HR
      fences: true,             // keep fenced code blocks
      listItemIndent: "one",    // tab for nested list items 
      closeAtx: false,           // close ATX headings with `###` not escaped
      tightDefinitions: true,   // definition lists compact
      resourceLink: true,       // keep [text](url) instead of <url>
      emphasis: "*",            // pick style for italics
      strong: "*",              // style for bold
       // optional: you can tweak this further if docusaurus needs
    };

    // Add missing YAML fields
    if (!file.hasYamlTitle) data.title = file.destTitle;
    if (!file.hasYamlSlug) data.slug = path.basename(file.destSlug, file.sourceExt);
    if (!file.hasYamlSidebar && file.sidebarPosition > 0) data.sidebar_position = file.sidebarPosition;

    // Transform content with remark
    // This is the key moment where we process the source Markdown into Docusaurus format
    const transformed = await unified()
      .use(remarkParse)
      //.use(remarkFrontmatter) // Parse YAML frontmatter - useful if we needed to set YAML properties
      //.use(remarkGfm) // GitHub Flavored Markdown - but since Obsidian is already mostly GFM compliant, this is skipped here

      .use(z2kRemarkWikiLinkToMD, { index, currentFile: file, summary, yamlLineOffset }) // <<-- pass yaml offset so line numbers can be adjusted

      // More of my own custom plugins - if commented out, then please see below for reasons
      // .use(remarkObsidianLinks, { index, summary }). // if I need to implement my own wikilink transformations
      // .use(remarkObsidianCallout)
      
      // Now stringify back to markdown
      .use(remarkStringify, myStringifyOptions)
      .process(content);

    // Now get rid of the changes we don't want (argh)
    const finalOutput = postProcessMarkdown(String(transformed));

    // Write new file
    const out = matter.stringify(finalOutput.toString(), data);
    fs.writeFileSync(destFilePath, out, 'utf8');
    fs.chmodSync(destFilePath, 0o444); // read-only
    // utils.verboseLog(`Wrote and chmod 444: ${utils.cleanFolderNamesForConsoleOutput(destFilePath)}`);
    summary.filesCopied++;

  } else {

    // --- Media or other files: Copy as-is ---
    fs.copyFileSync(file.sourcePath, destFilePath);
    utils.verboseLog(`Copied media/other file: ${utils.cleanFolderNamesForConsoleOutput(file.sourcePath)} -> ${utils.cleanFolderNamesForConsoleOutput(destFilePath)}`);
    summary.filesCopied++;
  }

}


/**
 * =====================================================================================
 * Custom Remark Plugin: z2kRemarkWikiLinkToMD
 * -------------------------------------------------------------------------------------
 * Converts Obsidian-style wikilinks ([[Page]], [[Page#Heading]], [[Page|Alias]],
 * [[Page#Heading|Alias]]) into standard Markdown links for Docusaurus.
 *
 * Example:
 *   [[How to Get Started#Quick|Start Guide]]
 * becomes:
 *   [Start Guide](how-to-get-started#quick)
 * =====================================================================================
 */
function z2kRemarkWikiLinkToMD(options: { index: Index, currentFile?: FileIndexEntry, summary: Summary, yamlLineOffset?: number }) {
  return (tree: any) => {
    visit(tree, 'text', (node: any, nodeIndex?: number | null, parent?: any | null) => {
      const regex = /\[\[([^\]\|]+?)(#[^\]\|]+)?(?:\|([^\]]+))?\]\]/g;
      let match: RegExpExecArray | null;
      const newNodes: any[] = [];
      let lastIndex = 0;

      while ((match = regex.exec(node.value)) !== null) {
        const full = match[0];
        const rawTarget = match[1] || '';
        const heading = match[2] || '';
        const alias = match[3] || '';
        const target = rawTarget.trim();

        // Preserve text before match
        const before = node.value.slice(lastIndex, match.index);
        if (before) newNodes.push({ type: 'text', value: before });

        // Header-only link (e.g., [[#Header]]): create intra-page anchor
        if (target.startsWith('#')) {
          const rawAnchor = target.replace(/^#+/, '');
          const anchor = rawAnchor.startsWith('^') ? '#^' + rawAnchor.slice(1) : '#' + utils.sluggify(rawAnchor);
          // show the header text (no leading '#') unless an alias is provided
          const display = alias ? alias : rawAnchor.trim(); 
          newNodes.push({ type: 'link', url: anchor, children: [{ type: 'text', value: display }] });
          lastIndex = regex.lastIndex;
          continue;
        }

        // Attempt resolution
        let entry: FileIndexEntry | undefined;
        const key = target.toLowerCase();

        // Path-like or explicit md path: try matching by sourcePath suffix
        if (target.includes('/') || /^.+\.md$/i.test(target)) {
          const normalizedTargetPath = target.replace(/\.md$/i, '').replace(/\\/g, '/').toLowerCase();
          entry = options.index.files.find(f => {
            const p = f.sourcePath.replace(/\.md$/i, '').replace(/\\/g, '/').toLowerCase();
            return p.endsWith(normalizedTargetPath) || p.includes('/' + normalizedTargetPath) || f.sourceName.toLowerCase() === normalizedTargetPath;
          });
        }

        // filename map
        if (!entry) {
          const arr = options.index.fileNameMap.get(key);
          if (arr && arr.length > 0) entry = arr[0];
        }

        // title and slug maps
        if (!entry) entry = options.index.fileTitleMap.get(key);
        if (!entry) entry = options.index.fileSlugMap.get(key);

        // slugified / normalized fallback lookup (handle explicit .md or name variants)
        if (!entry) {
          // Prefer a normalized key without file extension for lookups
          const targetNoExt = String(target || '').replace(/\.md$/i, '').trim();
          const normalizedKey = utils.normalizeFileKey(targetNoExt); // uses same normalization as other lookups

          // Try slug map (slugify the no-ext value), then fileNameMap/title maps by normalized key,
          // then as a last resort try the slugified no-ext again via fileNameMap (covers edge cases).
          const s = utils.sluggify(targetNoExt);
          entry =
            options.index.fileSlugMap.get(s) ||
            options.index.fileNameMap.get(normalizedKey)?.[0] ||
            options.index.fileTitleMap.get(normalizedKey) ||
            options.index.fileNameMap.get(s)?.[0];
        }

        if (entry) {
          // Build canonical URL base (helper keeps logic tidy and handles explicit .md or path-like sources)
          const urlBase = buildWikilinkUrlBase(target, entry);
          let url = urlBase;
          let display: string;
          if (heading) {
            // prefer the heading text as the display when no alias is provided
            const rawHeading = String(heading).replace(/^#/, '');
            const anchor = rawHeading.startsWith('^') ? '#^' + rawHeading.slice(1) : '#' + utils.sluggify(rawHeading);
            url += anchor;
            display = alias ? alias : rawHeading.trim();
          } else {
            display = alias ? alias : target;
          }
          newNodes.push({ type: 'link', url, children: [{ type: 'text', value: display }] });

        } else {

          // fallback
          const s = utils.sluggify(target);
          let fallbackUrl = '/' + s;
          if (heading) {
            const rawHeading = String(heading).replace(/^#/, '');
            const anchor = rawHeading.startsWith('^') ? '#^' + rawHeading.slice(1) : '#' + utils.sluggify(rawHeading);
            fallbackUrl += anchor;
          }

          let displayFallback: string;
          if (heading) {
            const rawHeading = String(heading).replace(/^#/, '');
            displayFallback = alias ? alias : rawHeading.trim();
          } else {
            displayFallback = alias ? alias : target;
          }
          newNodes.push({ type: 'link', url: fallbackUrl, children: [{ type: 'text', value: displayFallback }] });          

          const inner = full.replace(/^\[\[/, '').replace(/\]\]$/, '');

          // Compute canonical source info and adjusted position once
          const sourcePath = options.currentFile?.sourcePath || parent?.data?.filePath || 'unknown';
          const sourceName = options.currentFile?.sourceName || path.basename(sourcePath);
          const rawLine = parent?.position?.start?.line;
          const yamlOffset = options.yamlLineOffset || 0;
          const adjustedLine = typeof rawLine === 'number' ? rawLine + yamlOffset : '?';
          const col = parent?.position?.start?.column || '?';

          // Skip logging on any internatl test files - they all begin with "_"
          if (!sourceName.startsWith('_')) {
            // Log to console (with absolute path)
            utils.warningLog(`${sourcePath}:${adjustedLine}:${col} - Unresolved wikilink: [[${inner}]]`); 

            // Write unresolved links to the log file (skip internal test file)
            // NOTE: I commented out the try/catch here because if you have the file open in VS Code it tends to fail writing a new version silently
            // try {
              appendToUnresolvedLog(`${sourcePath}:${adjustedLine}:${col} - Unresolved wikilink: [[${inner}]]`);
            // } catch (e) {
              // defensive - don't crash the processor if logging fails
            //   console.warn('Error while attempting to write unresolved link entry:', e);
            // }

            // Increment reference count for the target if it exists in the index
            safeIncrementUnresolved(options);

          }
        }
        lastIndex = regex.lastIndex;
      }

      // trailing text
      const after = node.value.slice(lastIndex);
      if (after) newNodes.push({ type: 'text', value: after });

      if (newNodes.length > 0 && parent && Array.isArray(parent.children)) {
        const insertAt = typeof nodeIndex === 'number' ? nodeIndex : parent.children.indexOf(node);
        parent.children.splice(insertAt, 1, ...newNodes);
      }
    });
  };
}


// ====================================================================================================
// HELPER FUNCTIONS
// ====================================================================================================


// -----------------------------------------------------------------------------
// --- Create warnings for basename collisions ---
// -----------------------------------------------------------------------------
/**
 * Log potential ambiguity for shortest-possible resolution:
 * same basename (e.g. "readme") living under multiple folders.
 */
export function warnOnBasenameCollisions(index: Index) {
  const byBase = new Map<string, string[]>();
  for (const f of index.files) {
    const base = f.destSlug.replace(/\.(md|mdx)$/i, "").toLowerCase(); // e.g. "readme"
    const full = path.posix.join(f.destDir.replace(/\\/g, "/"), base); // e.g. "guides/readme"
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base)!.push(full);
  }
  for (const [base, list] of byBase.entries()) {
    if (list.length > 1) {
      utils.warningLog(`[wikilink] basename collision for "${base}":\n  ${list.join("\n  ")}`);
    }
  }
}


// -----------------------------------------------------------------------------
// --- Lookup a page's data in Index ---
// -----------------------------------------------------------------------------
function lookupPageInIndex(name: string | undefined, index: Index): string | null {
  if (!name || typeof name !== 'string') {
    utils.verboseLog(`lookupPageInIndex called with invalid name: ${String(name)}`);
    return null;
  }
  const normalized = name.trim().replace(/\s+/g, ' ').toLowerCase();
  for (const file of index.files) {
    if (file.sourceName.toLowerCase() === normalized) {
      return file.sourceName;
    }
  }
  return null;
}

function lookupPagePathInIndex(name: string | undefined, index: Index): string {
  if (!name || typeof name !== 'string') {
    utils.verboseLog(`lookupPagePathInIndex called with invalid name: ${String(name)}`);
    return './404-not-found';
  }
  const normalized = name.trim().replace(/\s+/g, ' ').toLowerCase();
  for (const file of index.files) {
    if (file.sourceName.toLowerCase() === normalized) {
      return file.destDir ? `./${file.destDir}/${file.destSlug}` : `./${file.destSlug}`;
    }
  }
  utils.verboseLog(`No path found for page: ${name}`);
  return './404-not-found';
}

function incrementRefCount(name: string, index: Index): void {
  for (const file of index.files) {
    if (file.sourceName === name) {
      (file as any).referenceCount = ((file as any).referenceCount || 0) + 1;
      return;
    }
  }
}


// Safe helper to increment unresolvedLinks when a summary object may or may not be present
function safeIncrementUnresolved(options?: { summary?: Summary }) {
  try {
    if (options && options.summary) {
      options.summary.unresolvedLinks = (options.summary.unresolvedLinks || 0) + 1;
    }
  } catch (e) {
    // swallow - defensive
  }
}


// Add module-level unresolved log path and helpers
let UNRESOLVED_LOG_PATH: string | null = null;
function appendToUnresolvedLog(line: string) {
  try {
    if (UNRESOLVED_LOG_PATH) {
      fs.appendFileSync(UNRESOLVED_LOG_PATH, line + '\n', 'utf8');
      // verbose notification for debugging
      utils.verboseLog(`Appended unresolved link to ${UNRESOLVED_LOG_PATH}: ${line}`);
    } else {
      utils.verboseLog('UNRESOLVED_LOG_PATH not set; skipping append for line:', line);
    }
  } catch (e) {
    utils.warningLog('Failed to append to unresolved links log:', UNRESOLVED_LOG_PATH, e);
  }
}

// Handle some post processing of the new markdown text
function postProcessMarkdown(md: string): string {

  // remark writes out new markdown text, but has a number of changes that we don't want 
  // This undoes them. 

  return md
    // Unescape underscores in identifiers / headings
    .replace(/\\_/g, "_")
    // Unescape ==highlight== markers
    .replace(/\\==/g, "==")

    // Unescape escaped link brackets
    .replace(/\\\[/g, "[")
    .replace(/\\\]/g, "]")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")");
}


/**
 * Strips leading YAML frontmatter (--- ... ---) from a Markdown string.
 * Returns the Markdown content without YAML.
 */
function stripYamlFrontmatter(md: string): string {
  if (md.startsWith("---")) {
    const lines = md.split("\n");
    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        endIndex = i;
        break;
      }
    }
    if (endIndex !== -1) {
      return lines.slice(endIndex + 1).join("\n");
    }
  }
  return md;
}

// Robust slug for heading comparisons (GitHub/Docusaurus-like)
function slugifyHeading(text: string): string {
  return text
    .normalize("NFKD")                // split accents
    .replace(/[\u0300-\u036f]/g, "")  // drop combining marks
    .replace(/[`*_~]/g, "")           // drop md inline markers
    .replace(/[^\w\s-]/g, "")         // drop punctuation except hyphen/space
    .trim()
    .replace(/\s+/g, "-")             // spaces -> hyphen
    .replace(/-+/g, "-")              // collapse hyphens
    .toLowerCase();
}

/**
 * Extract section under a given header, INCLUDING the header line,
 * stopping at the next header of the same or higher level.
 * Returns null if the header isn't found.
 */
function extractHeaderSection(content: string, header: string): string | null {
  const lines = content.split(/\r?\n/);
  const targetSlug = slugifyHeading(header);

  let headerIndex = -1;
  let headerLevel = 0;

  // Find the header line by slug
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*(#+)\s+(.*)$/);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].trim();
    if (slugifyHeading(text) === targetSlug) {
      headerIndex = i;
      headerLevel = level;
      break;
    }
  }

  if (headerIndex === -1) return null;

  // Collect from this header until next header of same or higher level
  const section: string[] = [lines[headerIndex]];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const m = lines[i].match(/^\s*(#+)\s+(.*)$/);
    if (m) {
      const level = m[1].length;
      if (level <= headerLevel) break;
    }
    section.push(lines[i]);
  }
  return section.join("\n").trim();
}

 
/**
 * Build canonical URL base for a wikilink target.
 *
 * Priority:
 *  1) Use entry.docId when present (already canonical: destDir/stripExt(destSlug)).
 *  2) If entry exists but docId missing, compute docId via utils.computeDocIdFromDest(entry.destDir, entry.destSlug).
 *  3) If no entry, but the author used a path or explicit .md, preserve author intent while slugifying each segment.
 *  4) Final fallback: slugify the entire target and return a root-based path.
 *
 * Returns a posix-style absolute path suitable for Docusaurus (leading slash, no extension).
 */
function buildWikilinkUrlBase(target: string, entry?: FileIndexEntry): string {
  // 1) Prefer canonical docId when available
  if (entry && entry.docId) {
    return path.posix.join('/', entry.docId.replace(/\\/g, '/'));
  }

  // 2) If entry exists, compute a docId from destDir/destSlug (centralized logic)
  if (entry) {
    try {
      const computed = utils.computeDocIdFromDest(entry.destDir, entry.destSlug);
      if (computed) {
        return path.posix.join('/', String(computed).replace(/\\/g, '/'));
      }
    } catch (e) {
      utils.warningLog('buildWikilinkUrlBase: computeDocIdFromDest failed for', entry?.sourcePath, e);
      // fall through to heuristic behavior below
    }
  }

  // Normalize the incoming target string
  const raw = String(target || '').trim();

  // 3) If the author wrote a path or included .md, preserve that structure but slugify each segment
  if (raw.includes('/') || /\.md$/i.test(raw)) {
    const normalizedTarget = raw.replace(/\.md$/i, '').replace(/\\/g, '/').replace(/^\.\//, '');
    const safePath = normalizedTarget
      .split('/')
      .map(seg => utils.sluggify(seg.trim()))
      .filter(Boolean)
      .join('/');
    return path.posix.join('/', safePath);
  }

  // 4) Final fallback: slugify whole target
  return '/' + utils.sluggify(raw);
}

// Helper: prefix any header-only wikilinks inside embedded content so they resolve to the
// original file (e.g. [[#Header]] -> [[SourceFile#Header]]). This keeps anchors pointing to
// the embedded file rather than to the host where the embed is pasted.
function prefixEmbeddedHeaderWikilinks(text: string, prefixName: string) {
  // match [[#Heading]] and [[#Heading|Alias]] (capture heading and alias)
  return text.replace(/\[\[#([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, hdr, alias) => {
    // preserve any caret ^ anchors (e.g. #^note)
    if (alias) {
      return `[[${prefixName}#${hdr}|${alias}]]`;
    } else {
      return `[[${prefixName}#${hdr}]]`;
    }
  });
}

/**
 * Expand Obsidian-style embeds (![[file]] or ![[file#header]]) inline.
 *
 * Supports:
 *   - Embedding entire files: ![[foo]]
 *   - Embedding a section under a header: ![[foo#Some Header]]
 *
 * Behavior:
 *   - Resolves the file via the Index (filename map first, then slug map).
 *   - Falls back to relative path if not found in Index.
 *   - Strips YAML frontmatter from the embedded file.
 *   - If a header is specified, includes the header itself and all content
 *     until the next header of the same or higher level.
 *   - Returns a warning marker if the file or header cannot be found.
 *
 * @param content     The raw markdown content of the current file
 * @param index       The index built in step2 (file maps for resolution)
 * @param currentDir  Directory of the current file, for relative resolution
 */
export function preprocessEmbeds(
  content: string,
  index: Index,
  currentDir: string,
  currentFilePath?: string
): string {
  // Match anything inside ![[...]] and parse it ourselves (robust to leading '#' for header-only embeds)
  const embedPattern = /!\[\[([^\]]+)\]\]/g;

  return content.replace(embedPattern, (match, payload) => {
    try {
      // Parse payload into fileNamePart and headerPart
      // e.g. "file" => fileNamePart="file", headerPart=undefined
      //      "file#Header" => fileNamePart="file", headerPart="Header"
      //      "#Header" => fileNamePart="", headerPart="Header"  (self-embed)
      const raw = String(payload || '').trim();
      const hashIndex = raw.indexOf('#');
      let fileNamePart = raw;
      let headerPart: string | undefined = undefined;
      if (hashIndex === 0) {
        // payload begins with '#' -> header-only embed of current file
        fileNamePart = '';
        headerPart = raw.slice(1);
      } else if (hashIndex > 0) {
        fileNamePart = raw.slice(0, hashIndex);
        headerPart = raw.slice(hashIndex + 1);
      }

      // --- Resolve target file ---
      let targetEntry: FileIndexEntry | undefined;
      const key = utils.normalizeFileKey(fileNamePart);

      // Header-only self-embed: use the current file
      if (!fileNamePart) {
        if (!currentFilePath) {
          utils.warningLog(`Header-only embed encountered but currentFilePath not provided. Payload: ${payload}`);
          return `> **Missing embed (unknown source): ${payload}**`;
        }
        // Try to find the index entry for the current file
        targetEntry = index.files.find(f => f.sourcePath === currentFilePath);
      } else {
        // 1. Try filename map (may return multiple entries, pick first for now)
        const nameMatches = index.fileNameMap.get(key);
        if (nameMatches && nameMatches.length > 0) {
          targetEntry = nameMatches[0];
        }

        // 2. Try slug map
        if (!targetEntry) {
          const slugMatch = index.fileSlugMap.get(key);
          if (slugMatch) targetEntry = slugMatch;
        }

        // 3. Fallback: relative guess
        // will be resolved to currentDir/<key>.md if not found in index
      }

      const targetPath = targetEntry
        ? targetEntry.sourcePath
        : (fileNamePart ? path.join(currentDir, key + ".md") : currentFilePath || path.join(currentDir, 'index.md'));

      if (!fs.existsSync(targetPath)) {
        utils.warningLog(`Embed target not found: ${fileNamePart || '#'+(headerPart||'') } (normalized: ${key}) in ${currentDir}`);
        return `> **Missing embed: ${fileNamePart || '#'+(headerPart||'')}**`;
      }

      // --- Read file and strip YAML frontmatter ---
      const rawFile = fs.readFileSync(targetPath, "utf8");
      const { content: targetContent } = matter(rawFile);

      // Determine prefix name to use (prefer sourceName without extension).
      const embedPrefixName = targetEntry
        ? targetEntry.sourceName.replace(/\.[^/.]+$/, "")
        : path.basename(targetPath, ".md");

      // --- Handle header embedding ---
      if (headerPart) {
        const section = extractHeaderSection(targetContent, headerPart);
        if (section) {
          // Prefix header-only wikilinks inside the embedded section to point back to the origin file
          return prefixEmbeddedHeaderWikilinks(section.trim(), embedPrefixName);
        } else {
          utils.warningLog(`Header '${headerPart}' not found in ${fileNamePart || path.basename(targetPath)}`);
          return `> **Missing embed section:** ${fileNamePart || path.basename(targetPath)}#${headerPart}`;
        }
      }

      // No header specified → embed whole file
      // Prefix header-only wikilinks across the whole embedded file before returning
      return prefixEmbeddedHeaderWikilinks(targetContent.trim(), embedPrefixName);
    } catch (err) {
      utils.errorLog(`Error embedding ${payload} inside a file within ${currentDir}:`, err);
      return `> **Error embedding ${payload}**`;
    }
  });
}

