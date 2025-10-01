import { Index, Summary } from './types.ts';
import * as utils from './utils.ts'

// ====================================================================================================
// Step 6: Log Summary 
// ====================================================================================================
/**
 * Logs a summary of the import process, including the number of files copied,
 * wikilinks rewritten, unresolved links, and a mapping of titles to destination paths.
 *
 * @param summary - The summary object containing counts and mappings.
 * @param index - The file index used for title-to-path mapping.
 */

export function logSummary(summary: Summary, index: Index) {
  utils.statusLog('--- Import Summary ---');
  utils.statusLog(`Files copied: ${summary.filesCopied}`);
  utils.statusLog(`Wikilinks rewritten: ${summary.wikilinksRewritten || 0}`);
  utils.statusLog(`Unresolved links: ${summary.unresolvedLinks || 0}`);
  if (utils.VERBOSE || utils.DEBUG) {
    utils.statusLog('Title-to-path map:');
    for (const [title, entry] of index.fileTitleMap.entries()) {
      utils.statusLog(`  "${title}" → ${entry.destDir}/${entry.destSlug}`);
    }
  }
}
