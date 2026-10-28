#!/bin/bash
# QA sheet per reel (frames from scripts/qa_frames.py). Usage: scripts/qa.sh N [N ...]
cd "$(dirname "$0")/.."
for n in "$@"; do
  line=$(python3 scripts/qa_frames.py "$n")
  comp=${line%% *}; frames=${line#* }
  scripts/sheet.sh "$comp" "qa$(printf %02d "$n")" $frames 2>&1 | tail -1
done
