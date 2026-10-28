# Tools and skills inventory

Checked 2026-10-28. "Local" means it runs on the Mac with no account. "Cloud" means it needs a login.

## 1. Command-line tools (installed with Homebrew)

| Tool | What it does here | Type |
|---|---|---|
| ffmpeg 9.0.2 | Cut, convert, re-encode, mask watermarks, burn subtitles, measure audio | Local, free |
| yt-dlp | Download videos from YouTube, Facebook and Instagram links | Local, free |
| openai-whisper | Speech to text for transcripts and captions | Local, free |
| node, deno | Run Remotion and yt-dlp's YouTube helper | Local, free |
| rclone | Upload big files to Google Drive and get a private link | Local tool, Google account |

## 2. Video, motion graphics and voice

| Tool | What it does | Type |
|---|---|---|
| Remotion (npm, v4) | Builds motion-graphics video from code: titles, captions, map pins, B-roll layouts. Renders 1080x1920 MP4 | Local; free for individuals, check Remotion's license for company use |
| video-use (github.com/browser-use/video-use, MIT) | Edits real footage by transcript: cut, color grade, overlays, burn subtitles. Patched locally to use mlx-whisper instead of ElevenLabs | Local, free |
| mlx-whisper | Fast Apple-silicon transcription with word timestamps (lives inside video-use's Python environment) | Local, free |
| VoiceStudio (github.com/debpalash/VoiceStudio) | Text to speech and cloned-voice voiceover. API on `localhost:3900` | Local, free |
| Ollama, LM Studio | Run local language models. No models are kept in LM Studio | Local, free |

## 3. Claude Code skills in this repo (`skills/`)

| Skill | Use it for |
|---|---|
| `instagram-reel` | End-to-end Reel: design brief, script, voiceover, Remotion build, QA, render |
| `remotion-motion-graphics` | Motion craft rules and the design-brief step for any Remotion video |
| `remotion-vertical-reel-craft` | 9:16 layout zones, captions, map pins, SFX levels, length rules, batch of 30 Reels |
| `omnivoice` | Speak or transcribe through VoiceStudio, clone a voice, time a voiceover to on-screen text |
| `humanize-writing` | Make a draft sound less like AI |

## 4. Claude Code plugins and skills installed from elsewhere

Install these from their own sources; they are not copied here.

| Plugin | What it gives you |
|---|---|
| `instagram-skills` v1.0.32 | `ig-content-planner`, `ig-caption-writer`, `ig-hashtag-strategist`, `ig-hook-extractor`, `ig-carousel-planner`, `ig-repurposer`, `ig-profile-optimizer`, `ig-audience-insights`, `ig-humanizer` |
| `instagram-search` | Search Instagram content |
| `watch` v0.2.0 | Watch a video URL or file (frames plus transcript) so Claude can answer questions about it |
| `impeccable`, taste skills (`design-taste-frontend`, `brandkit`, others) | Design quality for graphics and brand boards |
| `self-improving-skills` | Distills lessons into skills after complex work |

## 5. Cloud connectors available inside Claude

| Connector | Used for | Cost note |
|---|---|---|
| vidIQ | Top-performing Reels in a niche, profile reels, video transcripts, thumbnails, scheduled Instagram publish | Credit-based; one outlier search costs 5 credits; plans include a monthly allowance |
| Higgsfield (Artlist) | AI image, video, music, voiceover, sound-effect search | Credit-based |
| Descript | Edit video and audio by text, captions, export | Subscription |
| Google Drive, Gmail, Calendar | File hand-off, drafts, scheduling | Google account |
| Canva, Figma | Design files | Need sign-in |

## 6. Captions: which tool for which meaning

- **On-screen captions in a Reel:** built in Remotion (see `remotion-vertical-reel-craft`).
- **Captions burned onto raw footage:** `video-use`.
- **Transcript or subtitle file:** `openai-whisper` or mlx-whisper.
- **The post caption you write under the video:** `ig-caption-writer`, then `ig-hashtag-strategist`, then `ig-humanizer`.

## 7. Facebook

There is no Facebook-specific skill. Facebook video was handled with `yt-dlp` (download) and `ffmpeg` (re-encode, watermark mask). Facebook often serves AV1, which iMessage rejects, so re-encode to H.264 first (`scripts/phone-safe.sh`).

## 8. Optional extras (need your own setup)

- Gemini image generation (`scripts/images/`) and phone delivery (`scripts/delivery/`) depend on your own Google login, Apple ID and BlueBubbles server. Setup is in `docs/DELIVERY-AND-IMAGES.md`.
- Voiceover is optional. Reels work fine as text, B-roll and sound effects.
