import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { unified, Plugin } from 'unified';
import remarkParse from 'remark-parse';
import wikiLinkPlugin from '@flowershow/remark-wiki-link';
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

  // Build out the permalinks array for the wiki-link plugin
  const permalinks = buildPermalinksArray(index);
  utils.verboseLog(`Built ${permalinks.length} permalinks for wiki-link plugin`);

  // Optionally warn on basename collisions
  warnOnBasenameCollisions(index);

  // If debug mode, only process the first file for faster iteration
  if (utils.DEBUG) {
    if (index.files.length > 0) {
      utils.verboseLog('DEBUG mode - processing only first file for faster iteration');
      await copyAndTransformAFile(index.files[0], permalinks, summary);
    }
    return;
  }

  // Step through each file in the index
  // --------------------------------------------------------------------------------------------------
  for (const file of index.files) {
    await copyAndTransformAFile(file, permalinks, summary);
  }
}


// -----------------------------------------------------------------------------
// copyAndTransformAFile: Process a single file
// -----------------------------------------------------------------------------
// Helper: process a single file
// Note: this function is async because it uses await for the remark processing
async function copyAndTransformAFile(file: Index['files'][number], permalinks: string[] , summary: Summary) {

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
      .use(wikiLinkPlugin, {
        // Obsidian uses "|" as the alias divider by default
        aliasDivider: "|",
        format: "regular", //"shortestPossible",
        // permalinks,
        newClassName: "unResolved", // add a class for any unresolved links (NOTE: useless as we are not outputting HTML)
      })

      // More of my own custom plugins - if commented out, then please see below for reasons
      // .use(remarkObsidianLinks, { index, summary }). // if I need to implement my own wikilink transformations
      // .use(remarkObsidianCallout)
      
      // Now stringify back to markdown
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
// --- Wiki-Link Plugin: build a permalink mapping list ---
// -----------------------------------------------------------------------------

/**
 * Build the `permalinks` array for @flowershow/remark-wiki-link (format: "shortestPossible").
 * Each permalink is a POSIX-style, extensionless path relative to your docs root,
 * e.g. "guides/intro-to-the-system" or "index".
 */
export function buildPermalinksArray(index: Index): string[] {
  const set = new Set<string>();

  for (const f of index.files) {
    // Only include markdown-like docs that become pages
    const lowerExt = f.destSlug.toLowerCase();
    if (!(lowerExt.endsWith(".md") || lowerExt.endsWith(".mdx"))) continue;

    // Compose "destDir/destSlug" → make POSIX → strip extension
    const rel = path
      .posix
      .join(f.destDir.replace(/\\/g, "/"), f.destSlug.replace(/\\/g, "/")) //convert all forward slashes to backslashes and remove double slashes
      .replace(/\.(md|mdx)$/i, ""); // strip the extension

    set.add(rel);
  }

  return Array.from(set).sort();
}


// -----------------------------------------------------------------------------
// --- Wiki-Link Plugin: create warnings for basename collisions ---
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
      console.warn(`[wiki] basename collision for "${base}":\n  ${list.join("\n  ")}`);
    }
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
// NOTE: This plugin code is CURRENTLY COMMENTED OUT in favor of using the wikiLinkPlus plugin above
// because the wikiLinkPlus plugin handles more edge cases and is better maintained.
// However, this custom plugin is kept here for reference and potential future use.
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
// NOTE: This plugin is currently INACTIVE after learning about:
/**
 * NOTE: Removing custom Remark callout handling in favor of a Rehype plugin inside Docusaurus.
 *
 * Why this change:
 * 1) Correct layer of abstraction: callouts are ultimately HTML constructs (boxes, titles, icons).
 *    Handling them in Rehype (HTML AST) matches the final output domain better than Remark (Markdown AST).
 *    Docusaurus already runs a remark → rehype pipeline internally and supports rehype plugins in config.
 *    Docs: https://docusaurus.io/docs/markdown-features/plugins
 *
 * 2) Maintenance & ecosystem alignment: the previously used Remark plugin has been deprecated/archived,
 *    and the maintainer now maintains a Rehype version instead.
 *    - Archived Remark plugin: https://github.com/escwxyz/remark-obsidian-callout
 *    - Rehype plugin (current): https://github.com/lin-stephanie/rehype-callouts
 *
 * 3) Features & fidelity: the Rehype plugin provides HTML-level control (attributes/classes),
 *    supports collapsible callouts via <details>, and avoids double-processing or divergence between
 *    our preprocessor and Docusaurus’ own HTML generation.
 *
 * 4) Simpler pipeline: keep Obsidian-specific link rewrites in Remark (where appropriate),
 *    but delegate callout rendering to Docusaurus’ rehype stage (configured in docusaurus.config.js).
 *    If needed, see unified’s bridge for context: https://unifiedjs.com/explore/package/remark-rehype/
 *
 * Implementation note:
 * - In docusaurus.config.js, add the rehype plugin, e.g.:
 *     const rehypeCallouts = require("rehype-callouts");
 *     // ...
 *     presets: [
 *       [
 *         "@docusaurus/preset-classic",
 *         {
 *           docs: {
 *             remarkPlugins: [/* your existing remark plugins * /],
 *             rehypePlugins: [[rehypeCallouts, {/* options if any * /}]],
 *           },
 *         },
 *       ],
 *     ];
 *
 * Result: fewer custom transforms to maintain, better HTML semantics, and alignment with the
 *         actively maintained plugin landscape for callouts.
 */

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
