#!/bin/bash
# Render finished reels to ~/Desktop/30 Reels/reel-NN-<slug>.mp4 and print duration, size, stereo peak.
# Usage: scripts/render.sh N [N ...]
set -e
cd "$(dirname "$0")/.."
OUT="$HOME/Desktop/30 Reels"; mkdir -p "$OUT"
for n in "$@"; do
  nn=$(printf "%02d" "$n")
  read -r style slug < <(python3 -c "import json; d=json.load(open('src/data/r$nn.json')); print(d['style'], d['slug'])")
  case $style in luxury) S=Luxury;; motorsport) S=Motorsport;; notes) S=Notes;; esac
  f="$OUT/reel-$nn-$slug.mp4"
  npx remotion render src/index.ts "R$nn$S" "$f" --codec h264 --crf 22 --log=error
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  pk=$(ffmpeg -v error -i "$f" -vn -ac 2 -f f32le - | python3 -c "import sys,numpy as np; x=np.frombuffer(sys.stdin.buffer.read(),dtype=np.float32); print(f'{20*np.log10(np.max(np.abs(x))+1e-12):.2f}')")
  sz=$(du -m "$f" | cut -f1)
  echo "RENDERED reel $nn [$style] ${d}s ${sz}MB peak ${pk}dBFS -> $f"
done
