#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Open LLM Knowledge Base
# @raycast.mode silent

# Optional parameters:
# @raycast.icon 🧠
# @raycast.packageName AI Knowledge Base

# Check if server is running, start if not
if ! curl -s --max-time 1 http://localhost:3000 > /dev/null 2>&1; then
  launchctl start com.llm-wipa.server
  sleep 2
fi

open "http://localhost:3000"
