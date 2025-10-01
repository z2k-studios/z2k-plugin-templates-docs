import fs from 'fs-extra';
import { Index, Summary } from './types.ts';
import * as utils from './utils.ts'
import * as step1 from './step1-cleanTargetFolder.ts';
import * as step2 from './step2-buildIndex.ts';
import * as step3 from './step3-writeSidebar.ts'
import * as step4 from './step4-createDocsTree.ts';
import * as step5 from './step5-remarkFiles.ts';
import * as step6 from './step6-summarize.ts';


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
  utils.setTesting(process.argv.includes('-t'));
  if (utils.TESTING)   {   console.log('Test Jigs enabled');  } // Note: this will reset the SRC path to the test jig folder

  utils.initializeLogs();


  // Log the source and destination paths
  utils.verboseLog(`Source (Obsidian) folder:      ${utils.cleanFolderNamesForConsoleOutput(utils.SRC_DOCS)}`);
  utils.verboseLog(`Destination (Docusaurus) folder: ${utils.cleanFolderNamesForConsoleOutput(utils.PATH_DOCS)}`);
  
  // Validation
  // --------------------------------------------------------------------------------------------------
  if (!fs.existsSync(utils.SRC_DOCS)) {
    console.error(`Source directory does not exist: ${utils.SRC_DOCS}`);
    process.exit(1);
  }
  if (!fs.existsSync(utils.PATH_DOCS)) {
    console.error(`Destination directory does not exist: ${utils.PATH_DOCS}`);
    process.exit(1);
  }

  // Step 1: Clean the target folder by removing old Markdown and text files
  // --------------------------------------------------------------------------------------------------
  utils.verboseLog(`\n-----------------------------\n Step 1: Cleaning target folder: ${utils.PATH_DOCS}\n-----------------------------`);
  step1.cleanTargetFolder(utils.PATH_DOCS);

  // Step 2: Build an index of all source files and folders, extracting metadata
  // --------------------------------------------------------------------------------------------------
  utils.verboseLog(`\n-----------------------------\n Step 2: Building file index from: ${utils.SRC_DOCS}\n-----------------------------`);
  const index = step2.buildIndex(utils.SRC_DOCS);

  // Step 3: Create the sidebars.ts file based on the index
  // --------------------------------------------------------------------------------------------------
  utils.verboseLog(`\n-----------------------------\n Step 3: Writing sidebars.ts to: ${step3.SIDEBAR_PATH}\n-----------------------------`);
  step3.generateSidebars(index);

  // Step 4: Create the directory structure for Docusaurus docs based on the folder index
  // --------------------------------------------------------------------------------------------------
  utils.verboseLog(`\n-----------------------------\n Step 4: Creating docs tree in: ${utils.PATH_DOCS}\n-----------------------------`);
  fs.ensureDirSync(utils.PATH_DOCS); // Ensure the Destination root exists
  step4.createDocsTree(index.folders);

  // Step 4: Initialize a summary object to track progress and statistics
  // --------------------------------------------------------------------------------------------------
  utils.verboseLog(`\n-----------------------------\n Step 5: Using Remark to Rewrite Markdown to MDX in: ${utils.PATH_DOCS}\n-----------------------------`);
  const summary: Summary = { filesCopied: 0, wikilinksRewritten: 0, unresolvedLinks: 0 };
  await step5.copyAndTransformFiles(index, summary); // Copy and transform each file from the source to the Destination

  // Step 5: Log a summary of the import process, including stats and mappings
  // --------------------------------------------------------------------------------------------------
  utils.verboseLog(`\n-----------------------------\n Step 6: Outputting summary of actions\n-----------------------------`);
  step6.logSummary(summary, index);

  // Close out any log files
  utils.closeLogs();

}



main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
