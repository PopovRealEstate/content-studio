#!/bin/bash
# Render check stills for a Remotion composition and tile them into out/<prefix>_sheet.jpg.
# Copy into <project>/scripts/. Usage: scripts/sheet.sh <CompId> <prefix> [frame ...]
# bash, not zsh: zsh does not word-split "$frames", which sent --frame "20 45 ..." (Frame NaN).
set -e
cd "$(dirname "$0")/.."
comp=$1; pre=$2; shift 2
frames=("$@"); [ ${#frames[@]} -eq 0 ] && frames=(20 45 110 170 200 290 345 420 470 520 590 700)
# hstack needs >= 2 inputs: pad an odd count by repeating the last frame (not re-rendered).
[ $(( ${#frames[@]} % 2 )) -eq 1 ] && frames+=("${frames[${#frames[@]}-1]}")
mkdir -p out; inputs=(); filt=""; i=0; prev=""
for fr in "${frames[@]}"; do
  if [ "$fr" != "$prev" ]; then
    npx remotion still src/index.ts "$comp" "out/${pre}_$fr.png" --frame "$fr" --overwrite --log=error
  fi
  prev=$fr; inputs+=(-i "out/${pre}_$fr.png"); filt+="[$i]scale=270:480[v$i];"; i=$((i+1))
done
all=""; for ((k = 0; k < i; k++)); do all+="[v$k]"; done
if [ "$i" -lt 4 ]; then
  graph="${filt}${all}hstack=$i"                        # one row
else
  half=$((i / 2)); top=""; bot=""
  for ((k = 0; k < half; k++)); do top+="[v$k]"; done
  for ((k = half; k < i; k++)); do bot+="[v$k]"; done
  graph="${filt}${top}hstack=$half[t];${bot}hstack=$((i - half))[b];[t][b]vstack"
fi
ffmpeg -v error -y "${inputs[@]}" -filter_complex "$graph" "out/${pre}_sheet.jpg"
echo "out/${pre}_sheet.jpg"
