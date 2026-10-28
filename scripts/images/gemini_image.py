#!/usr/bin/env python3
"""Generate an image with the Gemini API and optionally text it to the operator.

REQUIRES your own setup (see docs/DELIVERY-AND-IMAGES.md): your own GEMINI_API_KEY in the file
named by CONTENT_STUDIO_ENV (API use is billed to your key).

The generation half of the image pipeline (the delivery half is the notify
service's attachment_path support):

    python3 scripts/images/gemini_image.py "a red brick house at sunset" --send

Stdlib only, matching the rest of the stack. Key: GEMINI_API_KEY in
the env file. Output: PNG under $CONTENT_STUDIO_HOME/images/, path on
stdout. --send texts the image to the operator chat via :8092 (caption = the
prompt). Fail-loud: any API error prints the provider's actual message and
exits nonzero.
"""
import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

HOME_DIR = Path(os.environ.get("CONTENT_STUDIO_HOME", str(Path.home() / "content-studio-output")))
ENV_FILE = Path(os.environ.get("CONTENT_STUDIO_ENV", str(Path.home() / ".content-studio.env")))
OUT_DIR = HOME_DIR / "images"
MODEL = "gemini-3.1-flash-image"
NOTIFY = os.environ.get("NOTIFY_URL", "http://127.0.0.1:8092/notify")


def _env(key: str) -> str:
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if line.strip().startswith(key + "="):
            return line.split("=", 1)[1].strip()
    return ""


def generate(prompt: str, model: str = MODEL) -> bytes:
    key = _env("GEMINI_API_KEY")
    if not key:
        sys.exit("ERROR: GEMINI_API_KEY missing from the env file (CONTENT_STUDIO_ENV)")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
    }
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            resp = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit(f"ERROR: Gemini API HTTP {e.code}: {e.read().decode()[:400]}")
    for part in (resp.get("candidates") or [{}])[0].get("content", {}).get("parts", []):
        data = part.get("inlineData") or part.get("inline_data") or {}
        if data.get("data"):
            return base64.b64decode(data["data"])
    sys.exit(f"ERROR: no image in response: {json.dumps(resp)[:400]}")


def send(path: Path, caption: str) -> None:
    tok = _env("NOTIFY_TOKEN")
    req = urllib.request.Request(
        NOTIFY, data=json.dumps({"text": caption, "attachment_path": str(path)}).encode(),
        method="POST", headers={"Content-Type": "application/json", "X-Notify-Token": tok})
    with urllib.request.urlopen(req, timeout=90) as r:
        out = json.loads(r.read().decode())
    if not out.get("ok"):
        sys.exit(f"ERROR: generated {path} but notify send failed: {out.get('error')}")
    print(f"texted to operator (guid {out.get('guid')})")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("prompt")
    ap.add_argument("--model", default=MODEL)
    ap.add_argument("--send", action="store_true", help="text the image via the notify service")
    args = ap.parse_args()
    png = generate(args.prompt, args.model)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    slug = re.sub(r"[^a-z0-9]+", "-", args.prompt.lower())[:40].strip("-")
    path = OUT_DIR / f"{slug}-{int(time.time())}.png"
    path.write_bytes(png)
    print(path)
    if args.send:
        send(path, f"Here you go: {args.prompt}")


if __name__ == "__main__":
    main()
