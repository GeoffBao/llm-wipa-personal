#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Sync Apple Books
# @raycast.mode fullOutput

# Optional parameters:
# @raycast.icon 📖
# @raycast.packageName AI Knowledge Base
# @raycast.description Fetch reading data from Apple Books and update the Books page

WIPA_DIR="/Users/admin/Documents/ClaudeCode/llm-wipa"
NODE="/opt/homebrew/bin/node"

cd "$WIPA_DIR" || { echo "❌ Cannot find $WIPA_DIR"; exit 1; }

echo "📖 Syncing Apple Books…"
OUTPUT=$("$NODE" --env-file=.env scripts/sync-apple-books.js 2>&1)
STATUS=$?

if [ $STATUS -eq 0 ]; then
  echo "$OUTPUT"
  echo ""
  echo "✅ Done — refresh http://localhost:3000/books to see updates"
else
  echo "$OUTPUT"
  echo ""
  echo "❌ Sync failed (exit $STATUS)"
  exit 1
fi
