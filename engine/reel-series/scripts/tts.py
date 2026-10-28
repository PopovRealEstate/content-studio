"""Record one VoiceStudio take per line (your cloned or chosen voice) -> public/r/NN/vo/<line>.wav.

Run: python3 scripts/tts.py [--all | --ready | N ...] [--force]
A take is re-recorded only when its text changed (stored beside it as <line>.txt) or with --force.
--ready = every reel not marked pending (awaiting fact check).
"""
import json, os, sys, time, urllib.error, urllib.request
from pathlib import Path
from reels import REELS

ROOT = Path(__file__).resolve().parent.parent
VOICE = os.environ.get("VOICESTUDIO_VOICE", "")  # voice id from VoiceStudio (Voices tab / GET /v1/voices)


def vo_dir(n):
    return ROOT / "public" / "r" / f"{n:02d}" / "vo"


def record(n, force=False):
    d = vo_dir(n); d.mkdir(parents=True, exist_ok=True)
    for name, text in REELS[n]["lines"].items():
        wav, txt = d / f"{name}.wav", d / f"{name}.txt"
        if not force and wav.exists() and txt.exists() and txt.read_text() == text:
            continue
        body = json.dumps({"model": "tts-1", "voice": VOICE, "input": text, "response_format": "wav"}).encode()
        req = urllib.request.Request("http://localhost:3900/v1/audio/speech", body, {"Content-Type": "application/json"})
        t0 = time.time()
        for attempt in range(60):  # VoiceStudio answers 429 when its queue is full: wait and retry
            try:
                with urllib.request.urlopen(req, timeout=600) as r:
                    wav.write_bytes(r.read())
                break
            except urllib.error.HTTPError as ex:
                if ex.code not in (429, 503) or attempt == 59:
                    raise
                time.sleep(10)
        txt.write_text(text)
        print(f"reel {n:02d} {name} ({time.time() - t0:.0f}s)", flush=True)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    if "--all" in sys.argv:
        ids = sorted(REELS)
    elif "--ready" in sys.argv:
        ids = [n for n in sorted(REELS) if not REELS[n].get("pending")]
    else:
        ids = [int(a) for a in args]
    for n in ids:
        record(n, force)
    print("tts done", ids, flush=True)
