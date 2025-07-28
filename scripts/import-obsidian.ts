import fs from 'fs-extra';
import { Index, Summary } from './types';
import * as utils from './utils'
import * as step1 from './step1-cleanTargetFolder';
import * as step2 from './step2-buildIndex';
import * as step3 from './step3-createDocsTree';
import * as step4 from './step4-remarkFiles';
import * as step5 from './step5-summarize';


// ====================================================================================================
// ====================================================================================================
//                                           --- Main ---
// ====================================================================================================
// ====================================================================================================
/**
 * Main function to execute the import process.
 * This is the entry point for the script.
 * It orchestrates the entire import process by calling the necessary functions in sequence.
 * It cleans the target folder, builds the index, creates the docs tree,
 * copies and transforms files, and logs the summary.
 */
async function main() {

  // Debug
  // console.log("utils keys:", Object.keys(utils));

  // Configuration
  // --------------------------------------------------------------------------------------------------
  // Enable verbose logging if the -v flag is passed
  utils.setVerbose(process.argv.includes('-v'));
  if (utils.VERBOSE) {   console.log('Verbose logging enabled');  } 
  utils.setDebug(process.argv.includes('-d'));
  if (utils.DEBUG)   {   console.log('Debugging enabled');  } 


  // Validation
  // --------------------------------------------------------------------------------------------------
  if (!fs.existsSync(utils.SRC)) {
    console.error(`Source directory does not exist: ${utils.SRC}`);
    process.exit(1);
  }
  if (!fs.existsSync(utils.DEST)) {
    console.error(`Destination directory does not exist: ${utils.DEST}`);
    process.exit(1);
  }

  // Step 1: Clean the target folder by removing old Markdown and text files
  // --------------------------------------------------------------------------------------------------
  utils.verboseLog(`\n-----------------------------\n Step 1: Cleaning target folder: ${utils.DEST}\n-----------------------------`);
  step1.cleanTargetFolder(utils.DEST);

  // Step 2: Build an index of all source files and folders, extracting metadata
  // --------------------------------------------------------------------------------------------------
  utils.verboseLog(`\n-----------------------------\n Step 2: Building file index from: ${utils.SRC}\n-----------------------------`);
  const index = step2.buildIndex(utils.SRC);

  // Step 3: Create the directory structure for Docusaurus docs based on the folder index
  // --------------------------------------------------------------------------------------------------
  utils.verboseLog(`\n-----------------------------\n Step 3: Creating docs tree in: ${utils.DEST}\n-----------------------------`);
  fs.ensureDirSync(utils.DEST); // Ensure the Destination root exists
  step3.createDocsTree(index.folders);

  // Step 4: Initialize a summary object to track progress and statistics
  // --------------------------------------------------------------------------------------------------
  utils.verboseLog(`\n-----------------------------\n Step 4: Using Remark to Rewrite Markdown to MDX in: ${utils.DEST}\n-----------------------------`);
  const summary: Summary = { filesCopied: 0, wikilinksRewritten: 0, unresolvedLinks: 0 };
  await step4.copyAndTransformFiles(index, summary); // Copy and transform each file from the source to the Destination

  // Step 5: Log a summary of the import process, including stats and mappings
  // --------------------------------------------------------------------------------------------------
  utils.verboseLog(`\n-----------------------------\n Step 5: Outputting summary of actions\n-----------------------------`);
  step5.logSummary(summary, index);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
