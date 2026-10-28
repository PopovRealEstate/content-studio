# Workflows

Run commands from the repo folder unless noted. Output goes to `~/Desktop` so finished files are easy to find.

## 1. Download a video (YouTube, Facebook, Instagram)

```
scripts/download.sh "<video url>"
```

Saves an H.264 MP4 (up to 1080p) into `~/Desktop/video-downloads/`. H.264 matters: Facebook often serves AV1 at very high resolution, and iMessage refuses it.

- Private or friends-only video: add your browser login with `COOKIES=chrome scripts/download.sh "<url>"`.
- Download fails after months of working: `brew upgrade yt-dlp`.

## 2. Remove a watermark (only with the creator's permission)

1. Extract a frame and find the watermark's box in source pixels: `ffmpeg -ss 30 -i in.mp4 -frames:v 1 frame.png`.
2. Run `scripts/remove-watermark.sh in.mp4 out.mp4 X Y W H` where X,Y is the top-left corner of the box and W,H its size.
3. Look at a few frames of the result. The filter blends the surrounding pixels, so a soft smudge can remain on light backgrounds. If it bothers you, crop the bottom of the picture instead.

## 3. Make a copy that texts and uploads cleanly

```
scripts/phone-safe.sh in.mp4 [out.mp4]
```

Re-encodes to H.264, 720p tall, with audio. A 1440x2560 AV1 file of 11 MB became 3.5 MB.

## 4. Make an Instagram Reel

Ask Claude: "make a Reel about <topic>" with the `instagram-reel` skill installed. It follows this order:

1. Design brief: Claude asks 2 to 4 questions about whatever your request leaves open, then states an exact style (colors, fonts, motion, pacing, sound).
2. Research and hooks: `ig-content-planner`, `ig-hook-extractor` (hook lands in the first 2 seconds).
3. Script: one point per Reel, budgeted at about 2.6 spoken words per second plus 1.5 to 2 seconds for the end card. Every claim and its source goes in a `CREDITS.md`.
4. Voiceover (optional): local VoiceStudio, one take per line, then word timings. Skip if you want text-only Reels.
5. Footage: probe clips, build contact sheets to choose shots, make 1080x1920 proxies. Skip shots that show another company's logo.
6. Build and QA in Remotion: check still frames before rendering.
7. Render to `~/Desktop`, then review before posting.

## 5. Make a batch of Reels (10 to 30)

Engine: `engine/reel-series`. Scripts and specs live in `scripts/reels.py`. One time: `cd engine/reel-series && npm install`. Per Reel number N:

```
python3 scripts/tts.py N      # voice takes (skip for silent Reels; use build_silent.py)
python3 scripts/build.py N    # build the timeline and Remotion data
scripts/qa.sh N               # still-frame check
scripts/render.sh N           # render the MP4
```

To add a Reel, add a dictionary to `scripts/reels.py`. The footage catalog and branding exclusions are in `scripts/catalog.py`. `public/` (clips, audio) is not in the repo; add your own footage there.

## 6. Add a voiceover

Open VoiceStudio (`open -a VoiceStudio`), check `curl -sf http://localhost:3900/health`, then ask Claude with the `omnivoice` skill active. Run one speech request at a time. A cloned voice can add a stray "Yeah."; listen for words that are not in the script.

## 7. Captions and transcripts

- Transcript or subtitle file: `whisper in.mp4 --model small --output_format srt`.
- On-screen animated captions: Remotion, per `remotion-vertical-reel-craft`.
- Post caption text: `ig-caption-writer` (hook in the first 125 characters), then `ig-hashtag-strategist` (3 to 5 tags, not 30), then `ig-humanizer`.

## 8. Edit footage you filmed

Ask Claude with the `video-use` skill: it transcribes, proposes cuts, and burns subtitles. It needs the `video-use` repo cloned (see `setup.sh`).

## 9. Share a big file

Files under about 19 MB can be texted. Larger files: upload with rclone and share the private Drive link (`rclone copyto file.mp4 "gdrive:Claude Videos/file.mp4"`), after setting up your own remote.
