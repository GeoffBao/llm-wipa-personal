#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title LLM KB Server Status
# @raycast.mode inline
# @raycast.refreshTime 30s

# Optional parameters:
# @raycast.icon 🟢
# @raycast.packageName AI Knowledge Base

if curl -s --max-time 1 http://localhost:3000 > /dev/null 2>&1; then
  echo "🟢 Running on http://localhost:3000"
else
  echo "🔴 Server offline"
fi
