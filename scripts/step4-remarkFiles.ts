import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { unified, Plugin } from 'unified';
import remarkParse from 'remark-parse';
import remarkWikiLink from 'remark-wiki-link';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';

import { Node, Parent } from 'unist';
import { Literal } from 'mdast';

import { Index, Summary } from './types.ts';
import * as utils from './utils.ts'

// ====================================================================================================
// Step 4: Copy & Transform Each File
// ====================================================================================================
/**
 * Copies and transforms each file from the source to the destination.
 *
 * @param index - The file index containing metadata about each file.
 * @param summary - The summary object to track the overall progress.
 */
export async function copyAndTransformFiles(index: Index, summary: Summary) {

  // If debug mode, only process the first file for faster iteration
  if (utils.DEBUG) {
    if (index.files.length > 0) {
      utils.verboseLog('DEBUG mode - processing only first file for faster iteration');
      await copyAndTransformAFile(index.files[0], index, summary);
    }
    return;
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
  const destFilePath = path.join(utils.DEST, file.destDir, file.destSlug);

  // Ensure the destination directory exists
  fs.ensureDirSync(path.dirname(destFilePath));

  // Verbose logging
  utils.verboseLog(`\n\nProcessing file: ${utils.cleanFolderNamesForConsoleOutput(file.sourcePath)} -> ${utils.cleanFolderNamesForConsoleOutput(destFilePath)}`);

  // Check if the file is a Markdown or text file - if so, transform it from obsidian to MDX / Docusaurus format
  if (utils.isMarkdownOrText(file.sourceName + file.sourceExt)) {

    // --- Markdown: Transform ---
    let raw = fs.readFileSync(file.sourcePath, 'utf8');
    const parsed = matter(raw);
    let { content, data } = parsed;

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
      .use(remarkWikiLink, {
        pageResolver: (name: any) => {
          if (!name || typeof name !== 'string') {
            utils.verboseLog(`remarkWikiLink.pageResolver called with invalid name: ${String(name)} (file: ${file.sourcePath})`);
            // Quick scan for potentially malformed wikilinks in this file content
            try {
              const bad: string[] = [];
              const wikire = /\[\[\s*([^|\]#]*)\s*(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
              let m: RegExpExecArray | null;
              while ((m = wikire.exec(content)) !== null && bad.length < 10) {
                bad.push(m[0]);
              }
              if (bad.length) {
                utils.verboseLog(`Potential malformed wikilinks in ${utils.cleanFolderNamesForConsoleOutput(file.sourcePath)}: ${bad.join('; ')}`);
              }
            } catch (e) {
              utils.verboseLog(`Error scanning content for wikilinks: ${String(e)}`);
            }
            return [];
          }

          utils.verboseLog(`remarkWikiLink.pageResolver processing name: "${name}" (file: ${file.sourcePath})`);
          const result = lookupPageInIndex(name, index);
          if (result) {
            utils.verboseLog(`Resolved wikilink "${name}" → ${result}`);
            incrementRefCount(result, index);
            return [result];
          } else {
            utils.verboseLog(`Could not resolve wikilink: "${name}" (file: ${file.sourcePath})`);
            return [];
          }
        },
        hrefTemplate: ({ page, alias, hash} : { page?: string, alias?: string, hash?: string }) => {
          const candidate = (page && typeof page === 'string') ? page : (alias && typeof alias === 'string' ? alias : undefined);
          if (!candidate) {
            utils.verboseLog(`remarkWikiLink.hrefTemplate called with invalid args: page=${String(page)}, alias=${String(alias)}, hash=${String(hash)} (file: ${file.sourcePath})`);
            // Attempt to locate wikilink occurrences in the file for diagnostics (include line numbers and surrounding text)
            try {
              const matches: Array<{text:string, index:number, line:number, lineText:string}> = [];
              const wikireAll = /\[\[([^\]]*)\]\]/g;
              let mm: RegExpExecArray | null;
              const lines = content.split(/\r?\n/);
              while ((mm = wikireAll.exec(content)) !== null && matches.length < 50) {
                const text = mm[0];
                const idx = mm.index || 0;
                const line = content.slice(0, idx).split(/\r?\n/).length;
                const lineText = lines[line - 1] || '';
                matches.push({ text, index: idx, line, lineText });
              }
              if (matches.length) {
                utils.verboseLog(`Found wikilinks in file ${utils.cleanFolderNamesForConsoleOutput(file.sourcePath)}: ${matches.map(m => `${m.text}@L${m.line}`).slice(0,10).join('; ')}`);
                matches.slice(0,5).forEach(m => utils.verboseLog(`  ${m.text} at line ${m.line}: ${m.lineText.trim()}`));
              } else {
                utils.verboseLog(`No explicit [[..]] wikilinks found in file ${utils.cleanFolderNamesForConsoleOutput(file.sourcePath)}`);
              }
            } catch (e) {
              utils.verboseLog(`Error scanning content for wikilinks: ${String(e)}`);
            }
            return './404-not-found';
          }
          const resolvedPath = lookupPagePathInIndex(candidate, index);
          return hash ? `${resolvedPath}#${utils.sluggify(hash)}` : resolvedPath;
        },
    })
      // .use(remarkObsidianLinks, { index, summary }). // if I need to implement my own wikilink transformations
      .use(remarkObsidianCallout)
      .use(remarkStringify)
      .process(content);

    // Write new file
    const out = matter.stringify(transformed.toString(), data);
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


// -----------------------------------------------------------------------------
// --- Wiki-Link Plugin: lookup data in Index ---
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


// -----------------------------------------------------------------------------
// --- Remark Plugin: Obsidian Wikilinks & Syntax ---
// -----------------------------------------------------------------------------
// This is an AI generate wikilinks alternative plugin.
function remarkObsidianLinks(options: { index: Index, summary: Summary }) {
  const { index } = options;
  return (tree: any) => {
    visit(tree, 'wikiLink', (node: any) => {
      // node.value: e.g. "Page", "Page#Section", "Page|Alt Name"
      let target = node.value as string;
      let alt = '';
      // Handle [[Page|Alt Name]]
      if (target.includes('|')) {
        [target, alt] = target.split('|');
      }
      // Handle [[Page#Section]]
      let anchor = '';
      if (target.includes('#')) {
        [target, anchor] = target.split('#');
      }
      const key = target.trim().toLowerCase();
      let entry = index.fileNameMap.get(key)?.[0];
      if (!entry) {
        // Try title map
        entry = index.fileTitleMap.get(key);
      }
      if (!entry) {
        // Try slug map
        entry = index.fileSlugMap.get(key);
      }
      if (!entry) {
        // Unresolved
        utils.verboseLog(`Unresolved wikilink: [[${node.value}]]`);
        node.type = 'text';
        node.value = `[[${node.value}]]`;
        options.summary.unresolvedLinks = (options.summary.unresolvedLinks || 0) + 1;
        return;
      }
      // Build relative path
      let relPath = path.relative(
        path.join(utils.DEST, entry.sourceDir),
        path.join(utils.DEST, entry.destDir, entry.destSlug)
      );
      relPath = relPath.replace(/\\/g, '/');
      if (!relPath.startsWith('.')) relPath = './' + relPath;
      if (
        node.children &&
        node.children[0] &&
        node.children[0].type === 'paragraph' &&
        node.children[0].children &&
        node.children[0].children[0] &&
        node.children[0].children[0].type === 'text' &&
        /^\[!\w+\]/.test(node.children[0].children[0].value)
      ) {
        const calloutType = node.children[0].children[0].value.match(/^\[!(\w+)\]/)?.[1] || 'info';
        node.type = 'code';
        node.lang = calloutType.toLowerCase();
        node.value = node.children
          .map((c: any) => (c.children ? c.children.map((cc: any) => cc.value).join('') : ''))
          .join('\n');
        delete node.children;
      }
    });

    // Remove ^blockrefs
    visit(tree, 'text', (node: any) => {
      node.value = node.value.replace(/\^\w+/, '');
    });
  };
}


// -----------------------------------------------------------------------------
// --- Remark Plugin: Obsidian Callouts / Admonitions ---
// -----------------------------------------------------------------------------
// Note: the callout regex in theory is only matched in the context of a parent block being a block quote
const CALLOUT_REGEX = /^\[!(\w+)\](.*)$/;
const remarkObsidianCallout: Plugin = () => {
  return (tree) => {
    visit(tree, 'blockquote', (node: any, index, parent: Parent) => {
      if (!node.children || node.children.length === 0) return;

      const firstChild = node.children[0];
      if (
        firstChild.type !== 'paragraph' ||
        firstChild.children.length === 0 ||
        firstChild.children[0].type !== 'text'
      ) {
        return;
      }

      const firstTextNode = firstChild.children[0] as Literal;
      const match = CALLOUT_REGEX.exec(firstTextNode.value as string);
      if (!match) return;

      const calloutType = match[1].toLowerCase(); // e.g. 'note', 'warning'
      const firstLine = match[2].trim(); // after the callout type

      // Rebuild the callout content
      const contentLines = [];

      if (firstLine) {
        contentLines.push(firstLine);
      }

      // Extract the rest of the lines
      for (let i = 1; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.type === 'paragraph') {
          const text = child.children.map((c: any) => c.value || '').join('');
          contentLines.push(text);
        }
      }

      // Construct new nodes to replace the blockquote
      const newNodes: Node[] = [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              value: `:::${calloutType}`,
            },
          ],
        },
        ...contentLines.map((line) => ({
          type: 'paragraph',
          children: [{ type: 'text', value: line }],
        })),
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              value: ':::',
            },
          ],
        },
      ];

      if (parent && typeof index === 'number') {
        parent.children.splice(index, 1, ...newNodes);
      }
    });
  };
};
