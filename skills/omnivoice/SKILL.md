---
name: omnivoice
description: Speak and transcribe through the user's local VoiceStudio (free, offline, no API key) via its OpenAI-compatible API at localhost:3900. Use when the user asks for TTS, "say this in my voice", a cloned-voice voiceover for a video or intro, or transcription. Also covers cleaning a cloned-voice clip, syncing its words to on-screen text, and timing a multi-part (countdown/top-N) voiceover to captions and pins under a length cap (Remotion or any editor).
metadata:
  provenance: self-improving-skills

---
# VoiceStudio — local TTS & STT

The user runs [VoiceStudio](https://github.com/debpalash/VoiceStudio), a fully-local voice app exposing an OpenAI-compatible audio API at `http://localhost:3900/v1`. Use it whenever the user asks to generate speech, narrate text, clone a voice, or transcribe audio — it costs nothing, works offline, and their audio never leaves the machine.

## Local note (this machine)

- Installed as the desktop app `/Applications/VoiceStudio.app` (v0.5.2). If `/health`
  fails, `open -a VoiceStudio` and wait for :3900.
- **Do NOT use it for video-use transcription.** Both `/v1/audio/transcriptions`
  (`verbose_json`) and `/transcribe` return segment-level timing only; the word
  timestamps are computed internally and dropped. video-use needs word boundaries, so
  its `helpers/transcribe.py` calls mlx-whisper directly. Use VoiceStudio for TTS,
  voice cloning, dubbing, and plain transcripts/subtitles.

## Before the first call

Check the backend is up:

```sh
curl -sf http://localhost:3900/health
```

If it fails, tell the user to launch VoiceStudio (or `bun run desktop-prod` from a source checkout) — don't fall back to a cloud API without asking; local-first is why they installed it.

## Text-to-speech

```sh
curl -s http://localhost:3900/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model": "tts-1", "voice": "alloy", "input": "TEXT HERE", "response_format": "wav"}' \
  --output speech.wav
```

- `model`: `tts-1` or `tts-1-hd` — both map to the user's active TTS engine.
- `voice`: OpenAI names (`alloy`, `echo`, `nova`, …) work, **but the real power is the user's own cloned voice-profile IDs** — discover them first (below) and prefer a named clone when the user says "my voice" / "the narrator voice" / a profile by name.
- `response_format`: `wav`, `mp3`, `flac`, `opus`, or `pcm`.
- Long texts are fine — the engine chunks at sentence boundaries internally.

## Discover the user's voices

```sh
curl -s http://localhost:3900/v1/audio/voices
```

Lists every cloned/designed voice profile (id + name) and the installed engines. Use a profile's id as the `voice` value in `/speech`.

Shape (v0.5.2): `{"voices": [...], "engines": ...}`. User profiles have
`"type": "profile"` and the id under `voice_id` (e.g. `{"voice_id": "3da2182c",
"name": "...", "type": "profile"}`); OpenAI alias entries are mixed into the same
list, so filter on `type`. `GET /profiles` returns full profile records, including
`ref_text` (empty means the clone was made without a transcript).

## Using a generated line as a video voiceover

- Expect ~30s for the first synthesis of a short line (32s for 4.3s of audio); run
  it in the background and build the edit meanwhile. Output wav is 24 kHz mono.
- VoiceStudio embeds an inaudible AudioSeal watermark in generated speech.
- A cloned-voice clip can start with ~1.4s of room tone before speech, and Whisper
  word times on it ran 0.3-0.4s early. Measure onsets from a loudness envelope,
  trim with `atrim` + `afade`, cue on-screen words 2 frames early, duck the music,
  and verify by transcribing the final render's audio. Full recipe with code:
  `references/voiceover-sync-to-picture.md`.
- Multi-part scripts (countdown/top-N reels with a length cap): record one take per
  segment, snap Whisper word starts to the loudness envelope, fit the cap with trim +
  `atempo`, and emit one `timeline.json` for Remotion. Section 7 of the same reference.
- Noisy lead-in usually comes from the reference recording. A quieter 5-10s sample
  entered with its exact transcript is the likely fix at the source.
- Batch takes (dozens of lines): synthesis is serialized, so run ONE sequential client
  in the background. Two parallel clients each took ~2x longer per take (no speedup),
  and a third concurrent client got HTTP 429; retry 429 with a sleep. Skip lines whose
  `<line>.txt` sidecar already matches the text so reruns resume.
- A cloned voice can prepend a filler word ("Yeah.") to a take. Compare Whisper's words
  to the script's vocabulary and re-record flagged takes.

## Speech-to-text

```sh
curl -s http://localhost:3900/v1/audio/transcriptions \
  -F file=@clip.wav -F model=whisper-1 -F response_format=json
```

- `model`: `whisper-1` maps to the active ASR engine (WhisperX by default; the user picks in Model Catalogue → Engines).
- `response_format`: `json`, `text`, `verbose_json` (per-segment timestamps), `srt`, or `vtt` — use `srt`/`vtt` directly when the user wants subtitles.

## Python (openai SDK)

```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:3900/v1", api_key="none")  # any string; nothing checks it

audio = client.audio.speech.create(model="tts-1", voice="alloy", input="Hello!", response_format="wav")
text = client.audio.transcriptions.create(model="whisper-1", file=open("clip.wav", "rb")).text
```

## Notes

- **No API key, no billing** (the user's own hardware). No quota either, but the queue is small: concurrent clients get HTTP 429 (see the batch-takes note above). First synthesis after a cold start may take longer (model loading); subsequent calls are fast.
- Anything beyond speech/transcription (video dubbing, batch jobs, voice design, audiobooks) lives in the full REST API — the interactive reference is embedded in the app at **Settings → OpenAPI Reference**, or ask the user to open it.
- If a call errors with an engine/model message, the actionable detail is usually in the response body — surface it to the user verbatim; VoiceStudio's errors are written to be user-fixable (e.g. which Settings toggle to flip).
