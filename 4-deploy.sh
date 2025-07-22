#!/bin/zsh

# Set your GitHub username (for Docusaurus deploy)
export GIT_USER="z2k-gwp"

# Use SSH or token? (uncomment one)
export USE_SSH=false
# export GIT_PASS="your_github_token_here"

# Run deploy
echo "🚀 Running Docusaurus deploy..."
npm run deploy

