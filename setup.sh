#!/bin/sh
# One-time setup on a new Mac. Review before running; it installs software.
set -e
command -v brew >/dev/null || { echo "Install Homebrew first: https://brew.sh" >&2; exit 1; }
brew install ffmpeg yt-dlp node deno rclone openai-whisper

# Claude Code skills from this repo
mkdir -p "$HOME/.claude/skills"
for s in skills/*/; do
  name=$(basename "$s")
  if [ -e "$HOME/.claude/skills/$name" ]; then echo "skip $name (already installed)"; else cp -R "$s" "$HOME/.claude/skills/$name"; fi
done

# video-use (edit footage by transcript), cloned next to your other projects
mkdir -p "$HOME/Developer"
[ -d "$HOME/Developer/video-use" ] || git clone https://github.com/browser-use/video-use "$HOME/Developer/video-use"
[ -e "$HOME/.claude/skills/video-use" ] || ln -s "$HOME/Developer/video-use" "$HOME/.claude/skills/video-use"

# Reel engine dependencies
(cd engine/reel-series && npm install)

echo "Done. Next: fill in brand/BRAND.md, then read docs/SETUP-YOUR-OWN.md steps 4 to 8."
