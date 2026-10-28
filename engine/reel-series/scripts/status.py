"""Which reels are fully voiced / built / rendered."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from reels import REELS
R = Path(__file__).resolve().parent.parent
out = Path.home() / "Desktop" / "30 Reels"
voiced, built, rendered, left = [], [], [], 0
for n, r in sorted(REELS.items()):
    d = R / "public" / "r" / f"{n:02d}" / "vo"
    ok = sum(1 for k, v in r["lines"].items() if (d / f"{k}.txt").exists() and (d / f"{k}.txt").read_text() == v)
    left += len(r["lines"]) - ok
    if ok == len(r["lines"]): voiced.append(n)
    if (R / "src" / "data" / f"r{n:02d}.json").exists(): built.append(n)
    if list(out.glob(f"reel-{n:02d}-*.mp4")): rendered.append(n)
print("voiced  ", voiced); print("built   ", built); print("rendered", rendered); print("takes left", left)
print("ready to build", [n for n in voiced if n not in built])
