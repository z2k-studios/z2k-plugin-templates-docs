#!/bin/zsh

# Set your GitHub username (for Docusaurus deploy)
export GIT_USER="z2k-gwp"

# Use SSH or token? (uncomment one)
export USE_SSH=false
# export GIT_PASS="your_github_token_here"

# Run deploy
echo "🚀 Running Docusaurus deploy..."
npm run deploy

# Docusaurus appends a period to the URL in its output (sentence punctuation),
# which terminals misread as part of the link. Echo a clean URL to click instead.
echo ""
echo "✅ Live: https://z2k-studios.github.io/z2k-plugin-templates-docs/"

