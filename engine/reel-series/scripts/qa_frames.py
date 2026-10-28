"""Print '<CompId> <frames...>' for a reel: one frame after each beat's last cue + the final frame."""
import json, sys
d = json.load(open(f"src/data/r{int(sys.argv[1]):02d}.json"))
S = dict(luxury="Luxury", motorsport="Motorsport", notes="Notes")[d["style"]]
fr = []
for b in d["beats"]:
    cues = [b.get("bigAt"), b.get("subAt"), b.get("brandAt")] + [x["at"] for x in b.get("items", [])] \
        + [b[k]["at"] for k in ("left", "right") if b.get(k)] + [p["at"] for p in b.get("pairs", [])]
    last = max([c for c in cues if c] + [b["t0"]])
    fr.append(min(int((last + 0.7) * 30), int(b["t1"] * 30) - 3))
fr.append(int(d["total"] * 30) - 2)
print(f"R{int(sys.argv[1]):02d}{S}", " ".join(str(x) for x in sorted(set(max(0, x) for x in fr))))
