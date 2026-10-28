#!/usr/bin/env python3
"""iMessage notify microservice: the single integration point for operator notifications.

REQUIRES your own setup (see docs/DELIVERY-AND-IMAGES.md): a BlueBubbles server signed in to YOUR
Apple ID, its URL and password, your own phone number as the operator chat, and a NOTIFY_TOKEN.
Nothing in this file is pre-configured for anyone.

Anything that needs to text the operator (scripts, automations) POSTs here, and this host-side
service forwards to the BlueBubbles REST API. It keeps the BlueBubbles password on the host and
gives ONE place to change the operator recipient.

This is for OPERATOR notifications only (alerts/briefings to the operator) — it does
NOT throttle, because it's a single known recipient who wants every alert.
Do not use it for marketing blasts to other people.

Endpoints:
  POST /notify   body {"text": "...", "attachment_path": "<allowlisted file>"?}
                 -> always sent to the configured operator chat. A caller-supplied
                 "to" is ignored.
  GET  /health   -> {"ok": true}   (no recipient or number is exposed)

Auth: mandatory. The shared secret NOTIFY_TOKEN (process env or the
CONTENT_STUDIO_ENV file) must be sent in the X-Notify-Token header; ?token= is not
accepted. The service refuses to start without a token, whatever the bind.

Binding: always 127.0.0.1 (port from notify_config.json "port", default 8092).
There is no bind_host setting. Docker Desktop containers reach it through
host.docker.internal; verify that path, do not widen the bind for it.

Attachments: only real files under ~/Desktop or $CONTENT_STUDIO_HOME (default ~/content-studio-output,
which holds the Gemini image output dir images/ and the staging dir imessage/), no dot-prefixed path
component, max 20MB.

Config resolution (the file named by CONTENT_STUDIO_ENV, then notify_config.json
for non-secret keys only; the token and bind_host are never read from the json):
  bb_url            BlueBubbles base URL   (BLUEBUBBLES_SERVER_URL)
  bb_password       BlueBubbles password   (BLUEBUBBLES_PASSWORD)
  operator_chatguid recipient chat         (default any;-;+1XXXXXXXXXX, or BLUEBUBBLES_HOME_CHANNEL)
  port              default 8092
Process-env overrides, used by the test harness: NOTIFY_TOKEN, NOTIFY_PORT,
NOTIFY_BB_URL, NOTIFY_BB_PASSWORD.
"""
from __future__ import annotations

import hmac
import json
import os
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONFIG_PATH = HERE / "notify_config.json"
ENV_FILE = Path(os.environ.get("CONTENT_STUDIO_ENV", str(Path.home() / ".content-studio.env")))
HERMES_ENV = ENV_FILE
AISTACK_ENV = ENV_FILE
BIND_HOST = "127.0.0.1"                     # fixed on purpose, not configurable
MAX_BODY = 1024 * 1024
MAX_ATTACHMENT = 20 * 1024 * 1024
# Attachment roots. CONTENT_STUDIO_HOME holds generated images and send_video.py's staging dir
# (a folder launchd can read; ~/Desktop is blocked for launchd jobs by macOS privacy rules).
CS_HOME = Path(os.environ.get("CONTENT_STUDIO_HOME", str(Path.home() / "content-studio-output")))
ATTACH_ROOTS = (
    Path.home() / "Desktop",
    CS_HOME,
)

DEFAULTS = {
    "bb_url": "http://127.0.0.1:1234",
    "bb_password": "",
    "operator_chatguid": "",   # REQUIRED: e.g. any;-;+1XXXXXXXXXX (your own number)
    "port": 8092,
    "token": "",
}


def _read_env_file(path: Path) -> dict:
    vals = {}
    try:
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            vals[k.strip()] = v.strip().strip('"').strip("'")
    except OSError:
        pass
    return vals


def load_config() -> dict:
    cfg = dict(DEFAULTS)
    env = _read_env_file(HERMES_ENV)
    if env.get("BLUEBUBBLES_SERVER_URL"):
        cfg["bb_url"] = env["BLUEBUBBLES_SERVER_URL"].rstrip("/")
    if env.get("BLUEBUBBLES_PASSWORD"):
        cfg["bb_password"] = env["BLUEBUBBLES_PASSWORD"]
    if env.get("BLUEBUBBLES_HOME_CHANNEL"):
        cfg["operator_chatguid"] = env["BLUEBUBBLES_HOME_CHANNEL"]
    # Shared secret: the env file is the single source.
    for src in (env, _read_env_file(AISTACK_ENV)):
        if src.get("NOTIFY_TOKEN"):
            cfg["token"] = src["NOTIFY_TOKEN"]
    if CONFIG_PATH.exists():
        try:
            extra = json.loads(CONFIG_PATH.read_text())
            if isinstance(extra, dict):
                # Secrets and the bind address are never taken from the json file.
                for k in ("token", "bind_host"):
                    extra.pop(k, None)
                cfg.update(extra)
        except (json.JSONDecodeError, OSError):
            pass
    for key, env_key in (("token", "NOTIFY_TOKEN"), ("port", "NOTIFY_PORT"),
                         ("bb_url", "NOTIFY_BB_URL"), ("bb_password", "NOTIFY_BB_PASSWORD")):
        if os.environ.get(env_key):
            cfg[key] = os.environ[env_key]
    return cfg


CFG = load_config()


def strip_markdown(text: str) -> str:
    """iMessage renders no Markdown, so convert the *bold*/_italic_/`code`/[link](url)
    markup into clean plain text (paired markers only,
    so stray underscores in emails/filenames are left intact)."""
    import re
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)          # **bold**
    text = re.sub(r"\*(.+?)\*", r"\1", text)              # *bold/italic*
    text = re.sub(r"`(.+?)`", r"\1", text)                # `code`
    text = re.sub(r"(?<!\w)_(.+?)_(?!\w)", r"\1", text)   # _italic_ (not inside words)
    text = re.sub(r"\[(.+?)\]\((.+?)\)", r"\1 (\2)", text)  # [text](url)
    return text


def attachment_allowed(path: str) -> str | None:
    """Return the resolved path if it is an existing regular file under an allowlisted
    root and neither the given path nor the resolved path has a dot-prefixed component;
    else None."""
    try:
        if not path or "\0" in path:
            return None
        given = os.path.abspath(os.path.expanduser(path))
        real = os.path.realpath(given)
        for p in (given, real):
            if any(part.startswith(".") for part in Path(p).parts[1:]):
                return None
        if not os.path.isfile(real):
            return None
        for root in ATTACH_ROOTS:
            rr = os.path.realpath(str(root))
            if os.path.commonpath([rr, real]) == rr:
                return real
    except (ValueError, OSError):
        return None
    return None


def bb_send_attachment(path: str, target: str, text: str = "") -> dict:
    """Send a local file as an iMessage attachment via BlueBubbles REST
    (multipart POST /api/v1/message/attachment). The file must pass
    attachment_allowed()."""
    if not CFG["bb_password"]:
        return {"ok": False, "error": "no bb_password configured"}
    import uuid
    real = attachment_allowed(path)
    if not real:
        return {"ok": False, "error": "attachment not allowed"}
    if os.path.getsize(real) > MAX_ATTACHMENT:
        return {"ok": False, "error": "attachment over 20MB"}
    chat_guid = target if ";-;" in target else f"any;-;{target}"
    boundary = f"----notify{uuid.uuid4().hex}"
    name = os.path.basename(real)
    with open(real, "rb") as fh:
        blob = fh.read()
    fields = {
        "chatGuid": chat_guid,
        "tempGuid": f"temp-notify-att-{time.time()}",
        "name": name,
        "method": "apple-script",
    }
    parts = []
    for k, v in fields.items():
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
    parts.append(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"attachment\"; filename=\"{name}\"\r\n"
        f"Content-Type: application/octet-stream\r\n\r\n".encode() + blob + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    body_bytes = b"".join(parts)
    url = f"{CFG['bb_url']}/api/v1/message/attachment?password={urllib.parse.quote(CFG['bb_password'])}"
    last = ""
    for attempt in range(3):
        req = urllib.request.Request(
            url, data=body_bytes,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}, method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                rb = json.loads(r.read().decode())
            if rb.get("status") == 200:
                if text:
                    bb_send(text, target)  # caption as a follow-up text
                return {"ok": True, "guid": (rb.get("data") or {}).get("guid"), "status": 200}
            last = f"status {rb.get('status')}: {rb.get('message')}"
        except Exception as e:
            last = str(e)
        if attempt < 2:
            time.sleep(1.5 * (attempt + 1))
    return {"ok": False, "error": last}


def bb_send(text: str, target: str) -> dict:
    """Send via BlueBubbles REST. target may be a chatGuid (contains ';-;') or a
    bare +phone/email (resolved to a chat)."""
    if not CFG["bb_password"]:
        return {"ok": False, "error": "no bb_password configured"}
    text = strip_markdown(text)
    chat_guid = target if ";-;" in target else f"any;-;{target}"
    url = f"{CFG['bb_url']}/api/v1/message/text?password={urllib.parse.quote(CFG['bb_password'])}"
    payload = {
        "chatGuid": chat_guid,
        # tempGuid is fixed for the life of this send: BlueBubbles dedups on it, so retrying a
        # transient failure can never double-send the message.
        "tempGuid": f"temp-notify-{time.time()}",
        "message": text,
    }
    data = json.dumps(payload).encode()
    last = ""
    for attempt in range(3):  # retry transient BlueBubbles / network hiccups (idempotent via tempGuid)
        req = urllib.request.Request(
            url, data=data,
            headers={"Content-Type": "application/json"}, method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body = json.loads(r.read().decode())
            if body.get("status") == 200:
                return {"ok": True, "guid": (body.get("data") or {}).get("guid"), "status": 200}
            last = f"status {body.get('status')}"
        except Exception as e:
            last = str(e)
        if attempt < 2:
            time.sleep(1.5 * (attempt + 1))
    return {"ok": False, "error": last}


class Handler(BaseHTTPRequestHandler):
    def _json(self, code: int, obj: dict) -> None:
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _authorized(self) -> bool:
        tok = self.headers.get("X-Notify-Token", "")
        if not CFG["token"] or not tok:
            return False
        return hmac.compare_digest(tok.encode("utf-8", "replace"), CFG["token"].encode("utf-8"))

    def do_GET(self):
        if urllib.parse.urlparse(self.path).path == "/health":
            self._json(200, {"ok": True})
        else:
            self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if urllib.parse.urlparse(self.path).path != "/notify":
            return self._json(404, {"ok": False, "error": "not found"})
        if not self._authorized():
            return self._json(401, {"ok": False, "error": "unauthorized"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > MAX_BODY:
                return self._json(413, {"ok": False, "error": "body too large"})
            body = json.loads(self.rfile.read(length).decode()) if length else {}
        except (ValueError, json.JSONDecodeError) as e:
            return self._json(400, {"ok": False, "error": f"bad body: {e}"})
        text = (body.get("text") or "").strip()
        attachment = (body.get("attachment_path") or "").strip()
        if not text and not attachment:
            return self._json(400, {"ok": False, "error": "missing text or attachment_path"})
        target = CFG["operator_chatguid"]   # caller-supplied "to" is deliberately ignored
        if attachment:
            result = bb_send_attachment(attachment, target, text=text)
        else:
            result = bb_send(text, target)
        self._json(200 if result.get("ok") else 502, result)

    def log_message(self, *args):  # quieter
        pass


def main():
    # Fail-closed: the send endpoint sends iMessages from the operator's account, so a
    # token is mandatory whatever the bind.
    if not CFG["token"]:
        raise SystemExit(
            "notify: refusing to start with no token. Set NOTIFY_TOKEN in the env file "
            "(callers must send it in the X-Notify-Token header).")
    if not CFG["operator_chatguid"]:
        raise SystemExit("notify: no operator chat. Set BLUEBUBBLES_HOME_CHANNEL (e.g. any;-;+1XXXXXXXXXX) in the env file.")
    srv = ThreadingHTTPServer((BIND_HOST, int(CFG["port"])), Handler)
    print(f"iMessage notify service on {BIND_HOST}:{CFG['port']} (operator chat configured)", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
