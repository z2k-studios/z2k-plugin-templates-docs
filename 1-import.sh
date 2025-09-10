#!/bin/zsh

# Runs the import-obsidian.ts script using ts-node.
# - This is a workhorse script that imports all of the markdown files from an Obsidian vault, 
#   converts them into Docusaurus friendly markdown files - building a full index of all files
#   in the process, and then builds a folder structure in the ./docs folder to hold all of the
#   imported markdown files - setting the files as read-only to prevent accidental edits. 
#
./scripts/import-obsidian.sh "$@"
