#!/bin/sh
# Download a video as an H.264 MP4 (up to 1080p) into ~/Desktop/video-downloads.
# Usage: scripts/download.sh "<url>"        COOKIES=chrome scripts/download.sh "<url>"
set -e
[ -n "$1" ] || { echo "usage: $0 <url>" >&2; exit 1; }
OUT="${OUT_DIR:-$HOME/Desktop/video-downloads}"
mkdir -p "$OUT"
cd "$OUT"
if [ -n "$COOKIES" ]; then set -- --cookies-from-browser "$COOKIES" "$@"; fi
exec yt-dlp -S "vcodec:h264,res:1080,acodec:aac" --merge-output-format mp4 \
  -o "%(title).80B [%(id)s].%(ext)s" "$@"
