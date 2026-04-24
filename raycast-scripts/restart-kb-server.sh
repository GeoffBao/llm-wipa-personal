#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Restart LLM KB Server
# @raycast.mode silent

# Optional parameters:
# @raycast.icon 🔄
# @raycast.packageName AI Knowledge Base

launchctl kickstart -k gui/$(id -u)/com.llm-wipa.server

# Wait and notify
sleep 3
if curl -s --max-time 3 http://localhost:3000 > /dev/null 2>&1; then
  osascript -e 'display notification "Knowledge Base server restarted" with title "🟢 LLM KB"'
else
  osascript -e 'display notification "Server failed to restart — check logs" with title "🔴 LLM KB"'
fi
