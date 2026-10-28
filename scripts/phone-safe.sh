#!/bin/sh
# Re-encode to H.264, 720p tall, AAC audio: small enough to text and playable on any phone.
# Usage: scripts/phone-safe.sh in.mp4 [out.mp4]
set -e
[ -n "$1" ] || { echo "usage: $0 in.mp4 [out.mp4]" >&2; exit 1; }
OUT="${2:-${1%.*}-720p.mp4}"
ffmpeg -v error -y -i "$1" -vf "scale=-2:720" -c:v libx264 -profile:v high -pix_fmt yuv420p \
  -crf 26 -preset medium -c:a aac -b:a 128k -movflags +faststart "$OUT"
echo "wrote $OUT"
