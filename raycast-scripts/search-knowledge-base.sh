#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Search LLM Knowledge Base
# @raycast.mode silent
# @raycast.argument1 { "type": "text", "placeholder": "搜索词…" }

# Optional parameters:
# @raycast.icon 🔍
# @raycast.packageName AI Knowledge Base

QUERY="$1"
ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$QUERY'))")
open "http://localhost:3000/search?q=${ENCODED}"
