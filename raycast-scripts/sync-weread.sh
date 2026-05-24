#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Sync WeRead Books
# @raycast.mode fullOutput

# Optional parameters:
# @raycast.icon 📚
# @raycast.packageName AI Knowledge Base
# @raycast.description Fetch latest book data from WeRead (微信读书) and update the Books page

WIPA_DIR="/Users/admin/Documents/ClaudeCode/llm-wipa"
NODE="/opt/homebrew/bin/node"

# Run sync
cd "$WIPA_DIR" || { echo "❌ Cannot find $WIPA_DIR"; exit 1; }

echo "📚 Syncing WeRead books…"
OUTPUT=$("$NODE" --env-file=.env scripts/sync-weread.js 2>&1)
STATUS=$?

if [ $STATUS -eq 0 ]; then
  echo "$OUTPUT"
  echo ""
  echo "✅ Done — refresh http://localhost:3000/books to see updates"
else
  echo "$OUTPUT"
  echo ""
  echo "❌ Sync failed (exit $STATUS)"
  echo "Tip: cookie may be expired — log into weread.qq.com in Arc and re-run."
  exit 1
fi
