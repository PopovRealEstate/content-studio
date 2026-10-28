"""Per reel: measure takes (mlx-whisper + envelope), cut dead air, trim, and write src/data/rNN.json.

Run: uv run --project ~/Developer/video-use python scripts/build.py N [N ...] | --ready-audio
Prints the transcript check (script vs Whisper) and every resolved cue so misses are visible.
"""
import json, re, subprocess, sys, wave
from difflib import SequenceMatcher
from pathlib import Path
import numpy as np
from reels import REELS
from catalog import pick_shots

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"
START, GAP, END_HOLD, HOP = 0.25, 0.2, 1.9, 0.02
NUMW = {w: str(i) for i, w in enumerate("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split())}
NUMW.update({"thirty": "30", "forty": "40", "fifty": "50", "sixty": "60", "seventy": "70", "eighty": "80", "ninety": "90"})


def norm(s):
    s = s.lower().replace("’", "'")
    s = re.sub(r"[^a-z0-9]", "", s)
    return NUMW.get(s, s)


def read_wav(p):
    w = wave.open(str(p)); sr = w.getframerate()
    return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32), sr


def envelope(x, sr, hop=HOP):
    n = int(sr * hop)
    return np.array([20 * np.log10(np.sqrt(np.mean((x[i:i + n] / 32768) ** 2)) + 1e-9) for i in range(0, len(x) - n, n)])


def analyze(n):
    """Whisper words + onset/offset per take, cached in analysis.json keyed by take text."""
    vo = ROOT / "public" / "r" / f"{n:02d}" / "vo"
    cache_p = vo / "analysis.json"
    cache = json.loads(cache_p.read_text()) if cache_p.exists() else {}
    for name, text in REELS[n]["lines"].items():
        mtime = (vo / f"{name}.wav").stat().st_mtime
        if cache.get(name, {}).get("text") == text and cache[name].get("mtime") == mtime:
            continue
        import mlx_whisper
        x, sr = read_wav(vo / f"{name}.wav")
        env = envelope(x, sr)
        loud = np.where(env > -32)[0]
        r = mlx_whisper.transcribe(str(vo / f"{name}.wav"), path_or_hf_repo="mlx-community/whisper-large-v3-turbo",
                                   word_timestamps=True, language="en", initial_prompt="Add brand names and jargon here so Whisper spells them correctly.")
        words = [{"w": wd["word"].strip(), "s": wd["start"], "e": wd["end"]} for seg in r["segments"] for wd in seg["words"]]
        cache[name] = {"text": text, "mtime": mtime, "dur": len(x) / sr, "onset": loud[0] * HOP, "offset": (loud[-1] + 1) * HOP, "words": words}
    cache_p.write_text(json.dumps(cache, indent=1))
    return cache


def dead_air(env, onset, offset, thr=-38.0, min_len=0.42, keep=0.26):
    """Runs of quiet hops inside speech longer than min_len -> (cut_start, cut_end) leaving `keep` s of pause."""
    cuts, i0 = [], None
    a, b = int(onset / HOP), int(offset / HOP)
    for i in range(a, b + 1):
        q = i < b and env[i] < thr
        if q and i0 is None:
            i0 = i
        elif not q and i0 is not None:
            if (i - i0) * HOP >= min_len:
                s, e = i0 * HOP, i * HOP
                cuts.append((s + keep / 2, e - keep / 2))
            i0 = None
    return cuts


def build(n):
    spec = REELS[n]
    A = analyze(n)
    vo = ROOT / "public" / "r" / f"{n:02d}" / "vo"
    tl = {"id": n, "slug": spec["slug"], "style": spec["style"], "note": spec.get("note", ""), "fine": spec.get("fine", ""),
          "vo": [], "captions": [], "lines": {}, "beats": [], "shots": []}
    words_by_line, t = {}, START
    issues = []
    for name, text in spec["lines"].items():
        a = A[name]
        x, sr = read_wav(vo / f"{name}.wav")
        env = envelope(x, sr)
        cuts = dead_air(env, a["onset"], a["offset"])

        def remap(v):
            shift = 0.0
            for c0, c1 in cuts:
                if v >= c1: shift += c1 - c0
                elif v > c0: return c0 - shift
            return v - shift
        # cut dead air (10ms crossfades), then trim to speech
        xf = int(0.01 * sr); keep_parts, pos = [], 0
        for c0, c1 in cuts:
            keep_parts.append(x[pos:int(c0 * sr)]); pos = int(c1 * sr)
        keep_parts.append(x[pos:])
        y = keep_parts[0]
        for seg in keep_parts[1:]:
            ramp = np.linspace(0, 1, xf)
            y = np.concatenate([y[:-xf], y[-xf:] * (1 - ramp) + seg[:xf] * ramp, seg[xf:]])
        tmp = vo / f"{name}_cut.wav"
        with wave.open(str(tmp), "wb") as o:
            o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr); o.writeframes(y.astype(np.int16).tobytes())
        trim0 = remap(max(0.0, a["onset"] - 0.05)); trim1 = remap(min(a["dur"], a["offset"] + 0.12))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-af",
                        f"atrim=start={trim0}:end={trim1},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.03,areverse,afade=t=in:st=0:d=0.06,areverse",
                        "-ar", "48000", str(vo / f"{name}_fx.wav")], check=True)
        dur = trim1 - trim0
        m = lambda v: round(t + remap(v) - trim0, 3)
        # snap word starts forward to the loudness envelope (Whisper runs early after pauses)
        # glue Whisper fragments back together: "Pre" + "-qualified", "$600" + ",000", "20" + "%"
        merged = []
        for w in a["words"]:
            if merged and re.match(r"^[-,%.']", w["w"]) and not re.fullmatch(r"[.?!]", w["w"]):
                merged[-1] = {**merged[-1], "w": merged[-1]["w"] + w["w"], "e": w["e"]}
            else:
                merged.append(dict(w))
        for w in merged:  # per-reel spelling fixes for homophones Whisper picks ("Principle" -> "Principal")
            for k, v in spec.get("fix", {}).items():
                w["w"] = w["w"].replace(k, v)
        script_vocab = {norm(p) for v in text.split() for p in [v] + v.split("-")}  # hyphen parts too
        odd = [w["w"] for w in merged if norm(w["w"]).isalpha() and norm(w["w"]) not in script_vocab]
        if odd:
            issues.append(f"  ? {name}: caption words not in script: {odd}")
        a = {**a, "words": merged}
        ws = []
        for w in a["words"]:
            s, e = w["s"], w["e"]
            i0, i1 = int(s / HOP), max(int(e / HOP), int(s / HOP) + 1)
            loud = np.where(env[i0:i1] > -32)[0]
            if len(loud): s = (i0 + loud[0]) * HOP
            s = max(s, a["onset"])
            ws.append({"w": w["w"], "s": m(s), "e": m(max(e, s + 0.05))})
        # Whisper sometimes drops a lone first word ("Three." before a pause). If the script's first word is missing
        # and there is a gap of speech before Whisper's first word, restore it from the script at the onset.
        first = text.split()[0]
        if ws and norm(first) != norm(ws[0]["w"]) and a["words"] and a["words"][0]["s"] - a["onset"] > 0.5:
            s0 = m(a["onset"])
            e0 = m(min(a["onset"] + 0.6, a["words"][0]["s"] - 0.1))
            ws.insert(0, {"w": first, "s": s0, "e": max(e0, s0 + 0.2)})
            print(f"  restored first word '{first}' in {name}")
        words_by_line[name] = ws
        tl["vo"].append({"file": f"r/{n:02d}/vo/{name}_fx.wav", "start": round(t, 3)})
        tl["lines"][name] = {"start": round(t, 3), "end": round(t + dur, 3)}
        # transcript check
        sw = [norm(v) for v in text.split()]
        hw = [norm(v["w"]) for v in a["words"]]
        ratio = SequenceMatcher(None, "".join(sw), "".join(hw)).ratio()
        if ratio < 0.9:
            issues.append(f"  ! {name}: {ratio:.2f} heard: {' '.join(v['w'] for v in a['words'])}")
        if cuts:
            print(f"  cut {name}: " + ", ".join(f"{c1 - c0:.2f}s@{c0:.2f}" for c0, c1 in cuts))
        t += dur + GAP
    speech_end = t - GAP

    # captions: Whisper tokens, "%" merged, dotted acronyms collapsed; 1-3 words / <=16 chars per chunk
    toks = []
    for name in spec["lines"]:
        for w in words_by_line[name]:
            txt = w["w"].upper()
            if re.fullmatch(r"([A-Z]\.){2,}[,.?!]?", txt):
                txt = txt.replace(".", "") + ("" if txt[-1] not in ",?!" else txt[-1])
            if toks and txt in ("%", "%.", "%,", "%?") and toks[-1]["line"] == name:
                toks[-1]["text"] += txt; toks[-1]["e"] = w["e"]; continue
            toks.append({"text": txt, "s": w["s"], "e": w["e"], "line": name})
    chunk = []
    for i, k in enumerate(toks):
        chunk.append(k)
        nxt = toks[i + 1] if i + 1 < len(toks) else None
        chars = sum(len(c["text"]) for c in chunk) + len(chunk) - 1
        brk = (nxt is None or len(chunk) >= 3 or chars >= 14 or k["text"][-1] in ".,?!:" or nxt["line"] != k["line"]
               or nxt["s"] - k["e"] > 0.3 or chars + len(nxt["text"]) + 1 > 18)
        if brk:
            tl["captions"].append({"s": chunk[0]["s"], "e": chunk[-1]["e"], "tokens": [{"text": c["text"], "s": c["s"], "e": c["e"]} for c in chunk]})
            chunk = []
    caps = tl["captions"]
    for i, c in enumerate(caps):
        nx = caps[i + 1]["s"] if i + 1 < len(caps) else c["e"] + 0.5
        c["e"] = round(min(nx, c["e"] + 0.35), 3)

    # cues
    def cue(ref):
        m_ = re.fullmatch(r"(\w+)(?::([^#+\-]+))?(?:#(\d+))?([+\-][\d.]+)?", ref)
        if not m_:
            raise ValueError(f"bad cue {ref}")
        line, word, nth, off = m_.group(1), m_.group(2), int(m_.group(3) or 1), float(m_.group(4) or 0)
        if word is None:
            return round(tl["lines"][line]["start"] + off, 3)
        key = norm(word); hits = 0
        for w in words_by_line[line]:
            hw = norm(w["w"])
            if hw == key or (len(key) >= 4 and not key.isdigit() and hw.startswith(key)):  # numbers match exactly ("40" != "4000")
                hits += 1
                if hits == nth:
                    return round(w["s"] + off, 3)
        raise ValueError(f"reel {n}: cue '{ref}' not found in line {line}: {[w['w'] for w in words_by_line[line]]}")

    beats = spec["beats"]
    for i, b in enumerate(beats):
        rb = {k: v for k, v in b.items() if k not in ("at",)}
        rb["t0"] = 0.0 if i == 0 else round(cue(b["at"]) - 0.12, 3)
        if b["type"] == "hero":
            rb["kickerAt"] = cue(b["kickerAt"]) if "kickerAt" in b else rb["t0"] + 0.12
            rb["bigAt"] = cue(b["bigAt"]) if "bigAt" in b else rb["t0"] + 0.12
            if b.get("sub"): rb["subAt"] = cue(b["subAt"]) if "subAt" in b else rb["bigAt"] + 0.5
        elif b["type"] == "list":
            rb["items"] = [{"text": tx, "at": cue(c)} for tx, c in b["items"]]
        elif b["type"] == "vs":
            rb["left"] = {**b["left"], "at": cue(b["left"]["at"])}
            rb["right"] = {**b["right"], "at": cue(b["right"]["at"])}
        elif b["type"] == "quote":
            rb["pairs"] = [{**p, "at": cue(p["at"])} for p in b["pairs"]]
        elif b["type"] == "cta":
            rb["headAt"] = cue(b["headAt"]) if "headAt" in b else rb["t0"] + 0.12
            if b.get("action"): rb["actionAt"] = cue(b["actionAt"])
            last = max(rb["headAt"], rb.get("actionAt", 0))
            rb["subAt"] = last + 0.3
            rb["brandAt"] = last + 0.6
        tl["beats"].append(rb)
    tl["total"] = round(speech_end + END_HOLD, 3)
    for i, b in enumerate(tl["beats"]):
        b["t1"] = tl["beats"][i + 1]["t0"] if i + 1 < len(tl["beats"]) else tl["total"]
    tl["speechEnd"] = round(speech_end, 3)
    tl["shots"] = pick_shots(n, spec, tl)

    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / f"r{n:02d}.json").write_text(json.dumps(tl, indent=1))
    print(f"reel {n:02d} [{spec['style']}] total {tl['total']}s, {len(caps)} caption chunks, {len(tl['shots'])} shots")
    for b in tl["beats"]:
        det = {k: v for k, v in b.items() if k.endswith("At")}
        print(f"  {b['type']:5s} {b['t0']:6.2f}-{b['t1']:6.2f} {det}" + (f" items@{[x['at'] for x in b['items']]}" if b["type"] == "list" else ""))
    for s in issues:
        print(s)
    return tl


def write_index():
    ids = sorted(int(p.stem[1:]) for p in DATA.glob("r*.json"))
    lines = [f'import r{i:02d} from "./r{i:02d}.json";' for i in ids]
    lines.append(f"export const REELS = [{', '.join(f'r{i:02d}' for i in ids)}];")
    (DATA / "index.ts").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    ids = [int(a) for a in sys.argv[1:] if a.isdigit()]
    if "--ready-audio" in sys.argv:
        ids = [n for n in sorted(REELS) if all((ROOT / "public" / "r" / f"{n:02d}" / "vo" / f"{k}.txt").exists()
               and (ROOT / "public" / "r" / f"{n:02d}" / "vo" / f"{k}.txt").read_text() == v for k, v in REELS[n]["lines"].items())]
    failed = []
    for n in ids:
        try:
            build(n)
        except Exception as ex:  # keep going; report at the end
            failed.append((n, str(ex)))
    write_index()
    for n, ex in failed:
        print(f"FAILED reel {n}: {ex}")
