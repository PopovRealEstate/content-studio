# Content Studio

A ready-to-use, blank copy of a complete social media content setup: Instagram Reels, Facebook video, motion graphics, voiceover, captions, and AI images. It runs on a Mac, is driven by Claude Code, and is mostly free and local.

Nothing in here belongs to any brand. Fill in `brand/BRAND.md` and it becomes yours.

## For Claude Code (installing this for someone)

1. Clone this repo to `~/content-studio`.
2. Read `docs/SETUP-YOUR-OWN.md` and follow it with the owner, step by step.
3. Run `./setup.sh` only after the owner has read it. It installs software with Homebrew.
4. Ask the owner to fill in `brand/BRAND.md`. The Reel skill stops and asks if it still holds placeholder text.
5. Do not set up delivery to a phone or Gemini images (`docs/DELIVERY-AND-IMAGES.md`) unless the owner asks. They need the owner's own accounts and logins.

## For the owner: start here

1. `docs/SETUP-YOUR-OWN.md`: from a fresh Mac to your first Reel.
2. `docs/TOOLS.md`: what every tool does and what it costs.
3. `docs/WORKFLOWS.md`: recipes (download a video, remove a watermark, make a Reel, add a voiceover, captions).
4. `docs/ACCOUNTS.md`: which services need your own login.

## What is in the box

| Folder | What it holds |
|---|---|
| `brand/` | `BRAND.md`, the one file where you describe your brand. Every skill reads it |
| `docs/` | Setup guide, tool inventory, workflows, accounts, delivery and image setup |
| `skills/` | Claude Code skills: Reel production, motion graphics, vertical-Reel craft, voiceover, humanizing text |
| `engine/reel-series` | Remotion project that builds a batch of Reels from a list of scripts (starts empty) |
| `engine/logo-sting` | A short animated logo intro, with placeholder branding |
| `scripts/` | Download a video, remove a watermark, make a phone-friendly copy; plus optional `delivery/` and `images/` tools |
| `setup.sh` | One-time installer |

## House rules built into the skills

- Every video is a vertical Reel: 1080x1920, 30 fps, 30 seconds maximum (single-point Reels 7 to 15 seconds).
- Facts are verified or left out. No invented stats, prices or rates.
- Sound effects stay under the voice.
- Nothing is posted or sent without a person approving it.
- Use only footage, images and voices you own or have permission to use. Keep other creators' watermarks and credit unless they have said you may remove them.

## Not included on purpose

Passwords, API keys, personal photos and clips, finished videos, and anyone's accounts.
