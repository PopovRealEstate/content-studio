"""Silent build (no voiceover): read-along captions + beats timed from the script text alone -> src/data/rNN.json.

Run: python3 scripts/build_silent.py N [N ...]
Each spoken line becomes caption chunks timed at WORD_S per word; cues in reels.py resolve against those fake word times,
so the same beat specs work with no audio. vo stays empty; only SFX play.
"""
import json, re, sys
from pathlib import Path
from reels import REELS
from catalog import pick_shots
from build import write_index, DATA, norm, END_HOLD

WORD_S, LINE_GAP, START = 0.34, 0.5, 0.3


def build_silent(n):
    spec = REELS[n]
    tl = {"id": n, "slug": spec["slug"], "style": spec["style"], "note": spec.get("note", ""), "fine": spec.get("fine", ""),
          "vo": [], "captions": [], "lines": {}, "beats": [], "shots": []}
    words_by_line, t = {}, START
    for name, text in spec["lines"].items():
        ws = []
        for w in text.split():
            ws.append({"w": w, "s": round(t, 3), "e": round(t + WORD_S, 3)})
            t += WORD_S
        words_by_line[name] = ws
        tl["lines"][name] = {"start": ws[0]["s"], "end": ws[-1]["e"], "text": text}
        t += LINE_GAP
    speech_end = t - LINE_GAP

    toks = [{"text": w["w"].upper(), "s": w["s"], "e": w["e"], "line": nm} for nm, ws in words_by_line.items() for w in ws]
    chunk = []
    for i, k in enumerate(toks):
        chunk.append(k)
        nxt = toks[i + 1] if i + 1 < len(toks) else None
        chars = sum(len(c["text"]) for c in chunk) + len(chunk) - 1
        brk = (nxt is None or len(chunk) >= 3 or chars >= 14 or k["text"][-1] in ".,?!:" or nxt["line"] != k["line"]
               or chars + len(nxt["text"]) + 1 > 18)
        if brk:
            tl["captions"].append({"s": chunk[0]["s"], "e": chunk[-1]["e"], "tokens": [{"text": c["text"], "s": c["s"], "e": c["e"]} for c in chunk]})
            chunk = []
    caps = tl["captions"]
    for i, c in enumerate(caps):
        nx = caps[i + 1]["s"] if i + 1 < len(caps) else c["e"] + 0.5
        c["e"] = round(min(nx, c["e"] + 0.35), 3)

    def cue(ref):
        m_ = re.fullmatch(r"(\w+)(?::([^#+\-]+))?(?:#(\d+))?([+\-][\d.]+)?", ref)
        if not m_:
            raise ValueError(f"bad cue {ref}")
        line, word, nth, off = m_.group(1), m_.group(2), int(m_.group(3) or 1), float(m_.group(4) or 0)
        if word is None:
            return round(tl["lines"][line]["start"] + off, 3)
        key, hits = norm(word), 0
        for w in words_by_line[line]:
            hw = norm(w["w"])
            if hw == key or (len(key) >= 4 and not key.isdigit() and hw.startswith(key)):
                hits += 1
                if hits == nth:
                    return round(w["s"] + off, 3)
        raise ValueError(f"reel {n}: cue '{ref}' not found in line {line}: {[w['w'] for w in words_by_line[line]]}")

    for i, b in enumerate(spec["beats"]):
        rb = {k: v for k, v in b.items() if k != "at"}
        rb["t0"] = 0.0 if i == 0 else round(cue(b["at"]) - 0.12, 3)
        if b["type"] == "hero":
            rb["kickerAt"] = cue(b["kickerAt"]) if "kickerAt" in b else rb["t0"] + 0.12
            rb["bigAt"] = cue(b["bigAt"]) if "bigAt" in b else rb["t0"] + 0.12
            if b.get("sub"): rb["subAt"] = cue(b["subAt"]) if "subAt" in b else rb["bigAt"] + 0.5
        elif b["type"] == "list":
            rb["items"] = [{"text": tx, "at": cue(c)} for tx, c in b["items"]]
        elif b["type"] == "vs":
            rb["left"] = {**b["left"], "at": cue(b["left"]["at"])}; rb["right"] = {**b["right"], "at": cue(b["right"]["at"])}
        elif b["type"] == "quote":
            rb["pairs"] = [{**p, "at": cue(p["at"])} for p in b["pairs"]]
        elif b["type"] == "cta":
            rb["headAt"] = cue(b["headAt"]) if "headAt" in b else rb["t0"] + 0.12
            if b.get("action"): rb["actionAt"] = cue(b["actionAt"])
            last = max(rb["headAt"], rb.get("actionAt", 0))
            rb["subAt"] = last + 0.3; rb["brandAt"] = last + 0.6
        tl["beats"].append(rb)
    tl["total"] = round(speech_end + END_HOLD, 3)
    for i, b in enumerate(tl["beats"]):
        b["t1"] = tl["beats"][i + 1]["t0"] if i + 1 < len(tl["beats"]) else tl["total"]
    tl["speechEnd"] = round(speech_end, 3)
    tl["shots"] = pick_shots(n, spec, tl)
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / f"r{n:02d}.json").write_text(json.dumps(tl, indent=1))
    print(f"reel {n:02d} [{spec['style']}] total {tl['total']}s, {len(caps)} caption chunks, {len(tl['shots'])} shots")
    for s in tl["shots"]:
        print(f"    shot @{s['at']:5.2f} {s['clip']} from {s['from']} rate {s['rate']}")


if __name__ == "__main__":
    for a in sys.argv[1:]:
        if a.isdigit():
            build_silent(int(a))
    write_index()
