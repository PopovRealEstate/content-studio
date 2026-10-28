# Delivery to your phone and AI image generation

These two features were part of the original setup. They are NOT ready to use out of the box. Each one depends on accounts, logins and permissions that belong to one person, so you have to set them up yourself on your own Mac. The scripts here have had every personal detail removed.

Both are optional. Without them you still have everything else: download, edit, build Reels, voiceover, captions. Finished videos land on your Desktop.

## Part 1: Text finished videos to your own phone

What it does: `scripts/delivery/send_video.py` sends a finished MP4 to your phone as an iMessage attachment (files up to 19 MB). Bigger files are uploaded to your Google Drive and you get a private link. If Drive fails, it sends a compressed copy.

How it works: send_video.py talks to a small local service, `scripts/delivery/notify_service.py`, which talks to BlueBubbles, a Mac app that sends iMessages. The service only ever sends to the one phone number you configure, and only files under your Desktop or `~/content-studio-output`.

What you must set up yourself:

1. **An Apple ID signed in to Messages on this Mac.** Messages > Settings > iMessage. Use your own. A separate Apple ID for the Mac works too, but it needs its own real phone number for verification.
2. **BlueBubbles server** from https://bluebubbles.app. Install it, sign in, give it the macOS permissions it asks for (Full Disk Access, Automation for Messages). Set a server password. Note the local URL (usually `http://127.0.0.1:1234`).
3. **An env file** with your own values, outside the repo:

   ```
   cat > ~/.content-studio.env <<'ENVEOF'
   BLUEBUBBLES_SERVER_URL=http://127.0.0.1:1234
   BLUEBUBBLES_PASSWORD=<your BlueBubbles password>
   BLUEBUBBLES_HOME_CHANNEL=any;-;+1<your 10 digit phone number>
   NOTIFY_TOKEN=<make one up: openssl rand -hex 24>
   ENVEOF
   chmod 600 ~/.content-studio.env
   ```

   Never commit this file or paste it anywhere. The repo's `.gitignore` already excludes `.env` files.
4. **Run the notify service** at login. Test it by hand first: `python3 scripts/delivery/notify_service.py`, then `curl -s http://127.0.0.1:8092/health` should print `{"ok": true}`. To keep it running, create a launchd job with a plist that runs `python3 /Users/<you>/content-studio/scripts/delivery/notify_service.py` with `RunAtLoad` and `KeepAlive` set. Ask Claude to write it for you.
5. **Google Drive for big files (optional):** run `rclone config`, create a remote named `gdrive`, and sign in with your own Google account. Use your own Google Cloud OAuth client id; the shared one is being retired.
6. **Try it:** `python3 scripts/delivery/send_video.py ~/Desktop/test.mp4 "test"`.

Known gotchas from the original build:

- macOS blocks background jobs from reading `~/Desktop`. send_video.py copies the file into `~/content-studio-output/imessage/` first; do not bypass it.
- iMessage refuses some codecs. Facebook downloads are often AV1; run `scripts/phone-safe.sh` first.
- If the service answers 502, BlueBubbles is not running. Open it and retry.
- Attachments over about 20 MB fail; that is why the Drive route exists.

## Part 2: AI images from Gemini

Two scripts in `scripts/images/`. Pick one.

**A. Gemini web app, free, no API key: `gemini_web_image.py`**

It drives the real Gemini website in Chrome, so it needs YOUR Chrome profile signed in to YOUR Google account.

1. Open Chrome, go to https://gemini.google.com and sign in. Use the profile you want these images tied to.
2. Chrome menu bar: View > Developer > **Allow JavaScript from Apple Events**. Turn it on.
3. The first run triggers a macOS prompt to let Terminal control Chrome. Click Allow (System Settings > Privacy & Security > Automation).
4. Run: `python3 scripts/images/gemini_web_image.py "a red brick house at sunset"`. The PNG is saved under `~/content-studio-output/images/`. Add `--send` to text it to yourself (needs Part 1).

It clicks buttons on the live page, so it can break when Google changes the site. It prints exactly which step failed. Only run it while you are not using that Chrome window.

**B. Gemini API, paid per image: `gemini_image.py`**

1. Get an API key at https://aistudio.google.com and add `GEMINI_API_KEY=<your key>` to `~/.content-studio.env`.
2. Run: `python3 scripts/images/gemini_image.py "a red brick house at sunset"`.
3. Check the model name at the top of the script against Google's current list; it may change.

## What is yours to protect

The env file, your BlueBubbles password, your NOTIFY_TOKEN and your API keys. Anyone with them can text from your account or spend your money. They are never stored in this repo.
