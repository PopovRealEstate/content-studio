#!/usr/bin/env python3
"""Generate an image with the Gemini WEB APP (no API, no billing) and text it back.

REQUIRES your own setup (see docs/DELIVERY-AND-IMAGES.md): Chrome signed in to YOUR Google
account, and the notify service only if you use --send.

Drives the logged-in gemini.google.com session in Chrome via AppleScript
JavaScript injection (View > Developer > Allow JavaScript from Apple Events
must be checked, and the calling process (Terminal) needs the one-time Automation grant
to control Chrome).

    python3 scripts/images/gemini_web_image.py "a red brick house" --send

Flow: open a FRESH Gemini chat -> insert prompt into the Quill editor +
dispatch Enter -> poll for the "Download full size image" button -> click it
-> catch the new Gemini_Generated_Image_*.png in ~/Downloads (falling back to
canvas extraction when Chrome blocks the programmatic download) -> move it to
$CONTENT_STUDIO_HOME/images/ -> (--send) text it to the operator via the notify service.

Fail-loud: every step prints what broke and exits nonzero, so a Claude run can surface the real error instead of inventing success.
"""
import argparse
import base64
import os
import json
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

HOME_DIR = Path(os.environ.get("CONTENT_STUDIO_HOME", str(Path.home() / "content-studio-output")))
ENV_FILE = Path(os.environ.get("CONTENT_STUDIO_ENV", str(Path.home() / ".content-studio.env")))
OUT_DIR = HOME_DIR / "images"
DOWNLOADS = Path.home() / "Downloads"
NOTIFY = os.environ.get("NOTIFY_URL", "http://127.0.0.1:8092/notify")
GEMINI_URL = "https://gemini.google.com/app"
DL_LABEL = "Download full size image"


def run_js(js: str, timeout: int = 20) -> str:
    """Execute JS in Chrome's active tab via AppleScript; return the result string."""
    esc = js.replace("\\", "\\\\").replace('"', '\\"')
    script = (f'with timeout of {timeout} seconds\n'
              f'tell application "Google Chrome" to execute active tab of '
              f'front window javascript "{esc}"\nend timeout')
    p = subprocess.run(["osascript", "-e", script], capture_output=True, text=True,
                       timeout=timeout + 10)
    if p.returncode != 0:
        raise RuntimeError(f"osascript failed: {(p.stderr or '').strip()[:300]}")
    return (p.stdout or "").strip()


def _env(key: str) -> str:
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if line.strip().startswith(key + "="):
            return line.split("=", 1)[1].strip()
    return ""


def open_fresh_chat(load_timeout: int = 45) -> None:
    subprocess.run(["open", "-a", "Google Chrome", GEMINI_URL], check=True)
    deadline = time.time() + load_timeout
    while time.time() < deadline:
        time.sleep(3)
        try:
            state = run_js(
                'document.readyState + \"|\" + (document.querySelector(\"div.ql-editor\") ? \"editor\" : \"no-editor\")')
        except RuntimeError:
            continue  # window may still be opening / consent racing
        if state.endswith("|editor"):
            return
    sys.exit("ERROR: Gemini page did not load an editor within %ss "
             "(is Chrome signed in to Google?)" % load_timeout)


def submit_prompt(prompt: str) -> None:
    injected = json.dumps("Generate an image: " + prompt)[1:-1]
    ok = run_js(
        'var ed = document.querySelector(\"div.ql-editor\");'
        'if (!ed) { \"no-editor\" } else {'
        'ed.focus(); document.execCommand(\"selectAll\", false, null);'
        f'document.execCommand(\"insertText\", false, \"{injected}\"); \"inserted\" }}')
    if ok != "inserted":
        sys.exit(f"ERROR: could not insert prompt (editor state: {ok})")
    # The "Send message" button only exists after Angular processes the text —
    # it renders a tick later, and synthetic Enter keydowns are unreliably
    # honored. Poll briefly, then click the real button.
    for _ in range(10):
        time.sleep(1)
        clicked = run_js(
            'var b = Array.from(document.querySelectorAll(\"button\"))'
            '.find(x => x.getAttribute(\"aria-label\") === \"Send message\" && x.offsetParent !== null);'
            'b ? (b.click(), \"sent\") : \"no-button\"')
        if clicked == "sent":
            return
    sys.exit("ERROR: Send message button never appeared after inserting the prompt")


def wait_and_download(gen_timeout: int = 180) -> None:
    """Poll for the download button on the generated image, then click it."""
    deadline = time.time() + gen_timeout
    while time.time() < deadline:
        time.sleep(5)
        try:
            n = run_js(
                f'Array.from(document.querySelectorAll(\"button\"))'
                f'.filter(b => b.getAttribute(\"aria-label\") === \"{DL_LABEL}\").length')
        except RuntimeError:
            continue
        if n.isdigit() and int(n) > 0:
            clicked = run_js(
                f'var bs = Array.from(document.querySelectorAll(\"button\"))'
                f'.filter(b => b.getAttribute(\"aria-label\") === \"{DL_LABEL}\");'
                f'bs[bs.length-1].click(); \"clicked\"')
            if clicked == "clicked":
                return
    # No image button — surface Gemini's own reply text (refusal, quota note, etc.)
    try:
        tail = run_js('document.body.innerText.slice(-400)')[-300:]
    except RuntimeError:
        tail = "(page unreadable)"
    sys.exit(f"ERROR: no generated image within {gen_timeout}s. Page tail: {tail}")


def catch_download(started_at: float, timeout: int = 60) -> Path:
    deadline = time.time() + timeout
    while time.time() < deadline:
        for f in DOWNLOADS.glob("Gemini_Generated_Image_*.png"):
            if f.stat().st_mtime >= started_at and not f.name.endswith(".crdownload"):
                return f
        time.sleep(2)
    # Chrome silently refuses programmatic download clicks (no user gesture ->
    # automatic-download block), so the file may never land even though the
    # image is rendered in the page. Pull the pixels out through a canvas.
    return canvas_extract()


def canvas_extract() -> Path:
    """Read the generated image out of the page via canvas.toDataURL.

    fetch() on the img's blob: URL fails (revoked), but drawing the img
    element onto a canvas works and is synchronous. The base64 is pulled
    through the AppleScript bridge in chunks small enough to be reliable.
    """
    grab = ('(function(){try{'
            'var img=Array.from(document.querySelectorAll("img")).filter(i=>i.naturalWidth>400)[0];'
            'if(!img)return "no-img";'
            'var c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;'
            'c.getContext("2d").drawImage(img,0,0);'
            'window.__b64=c.toDataURL("image/png").split(",")[1];'
            'return "ok|"+window.__b64.length;}catch(e){return "err:"+e}})()')
    st = ""
    for _ in range(6):  # tolerate transient -1712 AppleEvent timeouts
        try:
            st = run_js(grab, timeout=30)
            break
        except RuntimeError:
            time.sleep(2)
    if not st.startswith("ok|"):
        sys.exit("ERROR: download never landed and canvas fallback failed "
                 f"(state: {st or 'osascript unreachable'})")
    total = int(st.split("|")[1])
    chunk = 150000
    parts = []
    for off in range(0, total, chunk):
        for _ in range(6):
            try:
                parts.append(run_js(f"window.__b64.slice({off},{off + chunk})", timeout=30))
                break
            except RuntimeError:
                time.sleep(2)
        else:
            sys.exit(f"ERROR: canvas fallback died pulling chunk at offset {off}")
    b64 = "".join(parts)
    if len(b64) != total:
        sys.exit(f"ERROR: canvas fallback got {len(b64)} of {total} base64 chars")
    dest = DOWNLOADS / "Gemini_Generated_Image_canvas.png"
    dest.write_bytes(base64.b64decode(b64))
    return dest


def send(path: Path, caption: str) -> None:
    req = urllib.request.Request(
        NOTIFY, data=json.dumps({"text": caption, "attachment_path": str(path)}).encode(),
        method="POST",
        headers={"Content-Type": "application/json", "X-Notify-Token": _env("NOTIFY_TOKEN")})
    with urllib.request.urlopen(req, timeout=90) as r:
        out = json.loads(r.read().decode())
    if not out.get("ok"):
        sys.exit(f"ERROR: image at {path} but notify send failed: {out.get('error')}")
    print(f"texted to operator (guid {out.get('guid')})")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("prompt")
    ap.add_argument("--send", action="store_true", help="text the image via the notify service")
    ap.add_argument("--timeout", type=int, default=180, help="max seconds to wait for generation")
    args = ap.parse_args()

    started = time.time()
    open_fresh_chat()
    submit_prompt(args.prompt)
    wait_and_download(args.timeout)
    got = catch_download(started)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    slug = re.sub(r"[^a-z0-9]+", "-", args.prompt.lower())[:40].strip("-")
    dest = OUT_DIR / f"{slug}-{int(started)}.png"
    got.rename(dest)
    print(dest)
    if args.send:
        send(dest, f"Here you go: {args.prompt}")


if __name__ == "__main__":
    main()
