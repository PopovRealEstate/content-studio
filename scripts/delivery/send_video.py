#!/usr/bin/env python3
"""Deliver a finished video to the operator: iMessage attachment, or Google Drive link.

REQUIRES your own setup (see docs/DELIVERY-AND-IMAGES.md): a BlueBubbles server, a notify
service listening on NOTIFY_URL, and a NOTIFY_TOKEN line in the file named by CONTENT_STUDIO_ENV.

Usage: send_video.py <video.mp4> [caption] [--dry-run]

- <= 19MB: sent as an iMessage attachment via the local notify service (:8092),
  which defaults to the operator's own number.
- >  19MB: uploaded to Google Drive (rclone remote "gdrive:", folder DRIVE_DIR)
  and the Drive link is texted instead. The link is private to the Drive owner;
  nothing is shared publicly.
- If Drive is unavailable or full: falls back to a compressed 720p copy in
  ~/remotion-projects/_imessage/ sent as an attachment. The original file is
  never modified.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

NOTIFY_URL = os.environ.get("NOTIFY_URL", "http://127.0.0.1:8092/notify")
ENV_FILE = Path(os.environ.get("CONTENT_STUDIO_ENV", str(Path.home() / ".content-studio.env")))
CACHE_DIR = Path(os.environ.get("CONTENT_STUDIO_CACHE", str(Path.home() / "content-studio-output" / "imessage")))
LIMIT = 19 * 1024 * 1024  # notify service caps attachments at 20MB
REMOTE = "gdrive:"
DRIVE_DIR = "Claude Videos"


def read_token() -> str:
    try:
        for line in ENV_FILE.read_text().splitlines():
            if line.strip().startswith("NOTIFY_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError:
        pass
    return ""


def notify(payload: dict) -> dict:
    req = urllib.request.Request(
        NOTIFY_URL,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "X-Notify-Token": read_token()},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read().decode())


def rclone(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["rclone", *args], capture_output=True, text=True)


def drive_upload(video: Path) -> str:
    """Upload to Drive and return a view link, or raise RuntimeError."""
    if not shutil.which("rclone") or REMOTE not in rclone("listremotes").stdout.split():
        raise RuntimeError("rclone remote gdrive: not configured")
    about = rclone("about", REMOTE, "--json")
    if about.returncode == 0:
        free = json.loads(about.stdout).get("free")
        if free is not None and free < video.stat().st_size:
            raise RuntimeError(f"Drive full: {free / 1e6:.0f} MB free, video is "
                               f"{video.stat().st_size / 1e6:.0f} MB")
    dest = f"{REMOTE}{DRIVE_DIR}/{video.name}"
    up = rclone("copyto", str(video), dest)
    if up.returncode != 0:
        raise RuntimeError(f"upload failed: {up.stderr.strip()[-300:]}")
    stat = rclone("lsjson", "--stat", dest)
    file_id = json.loads(stat.stdout).get("ID") if stat.returncode == 0 else None
    if not file_id:
        raise RuntimeError("uploaded, but could not read the Drive file ID")
    return f"https://drive.google.com/file/d/{file_id}/view"


def stage(video: Path) -> Path:
    """Copy into CACHE_DIR before handing the path to the notify service.

    notify runs under launchd without macOS Desktop/Documents/Downloads access
    (TCC), so reading a file there hangs instead of failing and the send times
    out. The copy is made by this process, which has access.
    """
    if CACHE_DIR in video.parents:
        return video
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    dest = CACHE_DIR / video.name
    shutil.copy2(video, dest)
    return dest


def phone_copy(src: Path) -> Path:
    """Re-encode to <=1280px H.264/AAC, stepping CRF up until it fits."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    out = CACHE_DIR / f"{src.stem}-imessage.mp4"
    for crf in (26, 30, 34):
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(src),
             "-vf", "scale='min(1280,iw)':-2", "-c:v", "libx264", "-crf", str(crf),
             "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
             "-movflags", "+faststart", str(out)],
            check=True,
        )
        if out.stat().st_size <= LIMIT:
            return out
    raise SystemExit(f"still over 20MB after compression: {out}")


def main() -> None:
    args = [a for a in sys.argv[1:] if a != "--dry-run"]
    dry = "--dry-run" in sys.argv
    if not args:
        raise SystemExit(__doc__)
    video = Path(args[0]).expanduser().resolve()
    caption = args[1] if len(args) > 1 else ""
    if not video.is_file():
        raise SystemExit(f"no such file: {video}")
    if not str(video).startswith(str(Path.home()) + "/"):
        raise SystemExit("notify service only accepts files under your home folder")
    size_mb = video.stat().st_size / 1e6

    if video.stat().st_size <= LIMIT:
        print(f"route: iMessage attachment ({size_mb:.1f} MB)")
        if dry:
            return print("dry run: not sent")
        result = notify({"attachment_path": str(stage(video)), "text": caption})
    else:
        if dry:
            ok = REMOTE in rclone("listremotes").stdout.split()
            return print(f"route: Google Drive link ({size_mb:.1f} MB), remote "
                         f"{'configured' if ok else 'MISSING'}; dry run: not sent")
        try:
            link = drive_upload(video)
            print(f"route: Google Drive ({size_mb:.1f} MB) -> {link}")
            text = f"{caption}\n{link}".strip() if caption else f"{video.name}\n{link}"
            result = notify({"text": text})
        except RuntimeError as e:
            print(f"Drive unavailable ({e}); sending a compressed phone copy")
            small = phone_copy(video)
            result = notify({"attachment_path": str(small),
                             "text": f"{caption} (compressed; full file on Desktop)".strip()})
    print(json.dumps(result))
    if not result.get("ok"):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
