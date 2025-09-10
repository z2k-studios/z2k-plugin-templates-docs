#!/bin/zsh
# This docs resets the ./docs folder (to which a new import adds files to) by deleting it entirely.
echo "Cleaning up docs..."
rm -rf ./docs
mkdir ./docs
echo "🧹 Docs folder cleaned."
