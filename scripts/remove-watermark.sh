#!/bin/sh
# Mask a watermark by blending the surrounding pixels (ffmpeg delogo), re-encode to H.264.
# Only use on video you own or have the creator's permission to edit.
# Usage: scripts/remove-watermark.sh in.mp4 out.mp4 X Y W H   (box in source pixels, X,Y = top-left)
set -e
[ $# -eq 6 ] || { echo "usage: $0 in.mp4 out.mp4 X Y W H" >&2; exit 1; }
ffmpeg -v error -y -i "$1" -vf "delogo=x=$3:y=$4:w=$5:h=$6" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 22 -preset medium \
  -c:a copy -movflags +faststart "$2"
echo "wrote $2"
