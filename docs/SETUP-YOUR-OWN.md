# Set up your own studio

This is the full path from a fresh Mac to making Reels. Do the steps in order. The first four give you a working studio with no accounts beyond Claude. Steps 5 to 8 are optional extras.

## 0. What you need

- A Mac with Apple silicon, macOS up to date, and about 20 GB free disk space (more if you add voice models).
- A Claude account with Claude Code installed: https://claude.com/claude-code
- Your own footage (phone clips and photos) in one folder, for example `~/Desktop/Media`.

## 1. Get this repo

```
git clone <your private repo url> ~/content-studio
cd ~/content-studio
```

Keep it at `~/content-studio`. The skills look for `~/content-studio/brand/BRAND.md` and the engines there.

## 2. Fill in your brand file

Open `brand/BRAND.md` and replace every placeholder. Then update the two places that draw your name on screen:

- `engine/reel-series/src/engine.tsx`, the `BRAND` constant (closing card of every Reel).
- `engine/logo-sting/src/theme.ts`, the `brand` block (logo intro).

Change the palette constants at the top of `engine/reel-series/src/styles/Luxury.tsx`, `Motorsport.tsx` and `Notes.tsx` to your colors.

## 3. Install the tools and skills

```
./setup.sh
```

It installs ffmpeg, yt-dlp, node, deno, rclone and Whisper with Homebrew, copies the skills into `~/.claude/skills`, clones `video-use`, and installs the Reel engine's packages. Read it first; it is short.

Then install the Claude Code plugins that are not in this repo. Inside Claude Code run `/plugin` and add:

- `instagram-skills` (captions, hooks, hashtags, planning)
- `watch` (lets Claude watch a video)
- `impeccable` (design polish), optional

## 4. Make your first Reel

Start Claude Code in `~/content-studio` and say: "Make a Reel about <your topic>." The `instagram-reel` skill asks 2 to 4 questions, writes the script, builds the video and renders it to your Desktop. Check the finished file before you post anything.

For many Reels at once, see `docs/WORKFLOWS.md` section 5 and fill in `engine/reel-series/scripts/reels.py` and `catalog.py` (they contain one placeholder example).

## 5. Optional: voiceover in your own voice

1. Install VoiceStudio from https://github.com/debpalash/VoiceStudio (download the app, move it to Applications).
2. Open it, record or upload a clean 20 to 60 second sample of your voice, and create a voice. Copy the voice id.
3. `export VOICESTUDIO_VOICE=<voice id>` (put it in `~/.zshrc`).
4. Check `curl -sf http://localhost:3900/health`.

The `omnivoice` skill handles the rest. Only clone a voice that is yours, or that you have permission to use.

## 6. Optional: AI images from Gemini

See `docs/DELIVERY-AND-IMAGES.md`, part 2. Needs your own Google account in Chrome (free) or your own API key (paid).

## 7. Optional: get finished videos texted to your phone

See `docs/DELIVERY-AND-IMAGES.md`, part 1. Needs BlueBubbles on your Mac, signed in to your Apple ID. It is the most involved step; skip it if saving to the Desktop is enough.

## 8. Optional: research and posting accounts

See `docs/ACCOUNTS.md` for vidIQ, Higgsfield, Descript and Google Drive.

## When something breaks

- A download stops working: `brew upgrade yt-dlp`.
- A Remotion render fails: run `npm install` again in the engine folder, then retry.
- A voice take comes back empty: open VoiceStudio and make sure it is running; run only one voice request at a time.
- Ask Claude to read the relevant skill and fix it. The skills hold the lessons from the original setup.
