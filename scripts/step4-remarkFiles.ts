import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';
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

  // Step through each file in the index
  // --------------------------------------------------------------------------------------------------
  for (const file of index.files) {

    // Construct the destination file path
    const destFilePath = path.join(utils.DEST, file.destDir, file.destSlug);

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

      // Add missing YAML fields
      if (!file.hasYamlTitle) data.title = file.destTitle;
      if (!file.hasYamlSlug) data.slug = path.basename(file.destSlug, file.sourceExt);
      if (!file.hasYamlSidebar && file.sidebarPosition > 0) data.sidebar_position = file.sidebarPosition;

      // Transform content with remark
      const transformed = await unified()
        .use(remarkParse)
        .use(remarkObsidianLinks, { index, summary })
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
}

// --- Remark Plugin: Obsidian Wikilinks & Syntax ---

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
