import { Index, Summary } from './types.ts';

// ====================================================================================================
// Step 5: Log Summary 
// ====================================================================================================
/**
 * Logs a summary of the import process, including the number of files copied,
 * wikilinks rewritten, unresolved links, and a mapping of titles to destination paths.
 *
 * @param summary - The summary object containing counts and mappings.
 * @param index - The file index used for title-to-path mapping.
 */

export function logSummary(summary: Summary, index: Index) {
  console.log('--- Import Summary ---');
  console.log(`Files copied: ${summary.filesCopied}`);
  console.log(`Wikilinks rewritten: ${summary.wikilinksRewritten || 0}`);
  console.log(`Unresolved links: ${summary.unresolvedLinks || 0}`);
  console.log('Title-to-path map:');
  for (const [title, entry] of index.fileTitleMap.entries()) {
    console.log(`  "${title}" → ${entry.destDir}/${entry.destSlug}`);
  }
}
