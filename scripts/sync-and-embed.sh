#!/bin/bash
# Daily Readwise sync + incremental vector index update
# Runs: sync-readwise.js --incremental → embed-readwise.js --incremental

set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE=/opt/homebrew/bin/node
LOG_PREFIX="[sync-and-embed $(date '+%Y-%m-%d %H:%M')]"

echo "$LOG_PREFIX Starting Readwise incremental sync..."
$NODE --env-file="$DIR/.env" "$DIR/scripts/sync-readwise.js" --incremental
echo "$LOG_PREFIX Readwise sync done. Updating vector index..."
$NODE --env-file="$DIR/.env" "$DIR/scripts/embed-readwise.js" --incremental
echo "$LOG_PREFIX Done."
