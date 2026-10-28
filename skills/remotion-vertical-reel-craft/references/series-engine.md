# Series engine: many reels from one data-driven Remotion project

Worked example: a 30-reel educational series (10 per style) in
`engine/reel-series` in this repo (copy it to `~/remotion-projects/reel-series` to work). Read the scripts there for
full code. Each reel is data, not a component: adding a reel means adding one dict.

## Layout

```
scripts/reels.py     REELS = {n: dict(...)}: spoken lines + beat specs (the only per-reel authoring)
scripts/tts.py       one VoiceStudio take per line -> public/r/NN/vo/<line>.wav (+ <line>.txt sidecar)
scripts/build.py     Whisper + envelope -> cut, trim, captions, cues, shots -> src/data/rNN.json + index.ts
scripts/catalog.py   clean B-roll segments + deterministic per-reel shot picker
scripts/render.sh    render to the delivery folder, print duration / MB / stereo peak
scripts/qa_frames.py + qa.sh + sheet.sh   auto QA sheet per reel
scripts/status.py    voiced / built / rendered / ready-to-build lists
src/engine.tsx       types, useClock, Footage, Captions, Soundtrack, thin(), fit(), Rich markup
src/styles/*.tsx     one template per look; each renders the generic beat types
src/Root.tsx         one <Composition> per data file
```

## 1. Reel spec (`reels.py`)

```python
3: dict(slug="earnest-vs-option", style="luxury", pool=["home"], fine=FP_LEGAL,
    fix={"Principle": "Principal"},          # optional Whisper homophone map
    pending=True,                            # optional: awaiting fact check, tts --ready skips it
    lines=dict(a="These two things sound the same but are different.", b="...", e="..."),
    beats=[
        dict(type="hero", at="a", kicker="Know the difference", big="Two different\n*checks*", bigAt="a:two"),
        dict(type="vs", at="b", left=dict(title="Earnest money", body="...", at="b:earnest"),
                               right=dict(title="Option fee", body="...", at="c:option")),
        dict(type="list", at="b", mode="number", items=[("Purchase price", "c:purchase"), ...]),
        dict(type="cta", at="e", head="Questions?", action="Contact me", actionAt="e:contact", sub="..."),
    ]),
```

Cue grammar: `"c"` = start of line c; `"c:word"` = first Whisper word in line c matching
(case/punct-insensitive, number words match digits); `"c:word#2"` = 2nd match;
`"c:word+0.3"` = offset seconds. On-screen markup: `*accent*`, `\n`. Beat types: hero,
list (modes number/check/x/stack), vs, quote, cta. Spell numbers as spoken in `lines`.

## 2. TTS (`tts.py`)
- Resumable: skip a line when `<line>.wav` exists and `<line>.txt` equals the current
  text. Editing a line re-records only that line; `rm <line>.txt` forces one take.
- Wrap `urlopen` in a 429 retry loop (sleep 10s, up to 60 tries).
- Run ONE queue in the background (`run_in_background: true`); it outlives the Bash
  tool timeout. VoiceStudio serializes synthesis: a second queue doubled per-take time
  (~20s to ~40s), so throughput stayed flat, and a third concurrent client got HTTP 429.
  To re-record a fix urgently, kill the queue and restart it with the fix first
  (`tts.py 9 && tts.py --ready`).

## 3. Build (`build.py`, run with `uv run --project ~/Developer/video-use`)
Per line, in order:
1. `analyze`: mlx-whisper (`whisper-large-v3-turbo`, `word_timestamps=True`,
   `initial_prompt` with brand + acronyms) + 20ms RMS envelope, cached in
   `analysis.json` keyed by the take text AND the wav's `st_mtime`. Keyed on text
   alone, a re-recorded take with unchanged text reused the stale transcript (a
   "Yeah." artifact survived the re-record until the key included mtime).
2. Auto dead air: runs of hops under -38 dB inside speech lasting >= 0.42s are cut,
   leaving 0.26s of pause; 10ms crossfades; every time goes through `remap()` (manual
   version: omnivoice `references/voiceover-sync-to-picture.md` section 7).
3. Trim to `[onset-0.05, offset+0.12]` with the `areverse` double-fade.
4. Glue Whisper fragments, apply the `fix` map, run the vocab check, snap starts to the
   envelope, restore a dropped first word (code below).
5. Transcript check: `SequenceMatcher` ratio of script vs heard < 0.9 prints `!`.

Homophones the vocab check caught, fixed via the per-reel `fix` map: "Principle" for
"Principal", "Hale" for "Hail", "Counselors" for "counselor". Split hyphenated words
into the script vocab ("debt-to-income", "as-is"), or their parts false-flag.

Then captions (1-3 words, <= ~16 chars per chunk, break on punctuation, line change, or
a 0.3s gap), cue resolution, beats (`t0 = cue - 0.12`, `t1` = next beat's t0, last
beat ends at `speechEnd + 1.9s`), shots, `rNN.json`, and a regenerated
`src/data/index.ts`. Wrap each reel in try/except and print FAILED lines at the end so
one bad cue does not stop the batch. `--ready-audio` builds every fully voiced reel.

```python
# glue "Pre" + "-qualified", "$600" + ",000", "20" + "%"
if merged and re.match(r"^[-,%.']", w["w"]) and not re.fullmatch(r"[.?!]", w["w"]):
    merged[-1] = {**merged[-1], "w": merged[-1]["w"] + w["w"], "e": w["e"]}
# vocab check: flags inserted filler ("Yeah.") the voice clone added at a take start
script_vocab = {norm(p) for v in text.split() for p in [v] + v.split("-")}   # hyphen parts too
odd = [w["w"] for w in merged if norm(w["w"]).isalpha() and norm(w["w"]) not in script_vocab]
# restore a lone first word Whisper dropped ("Three." before a pause)
first = text.split()[0]
if ws and norm(first) != norm(ws[0]["w"]) and words[0]["s"] - onset > 0.5:
    ws.insert(0, {"w": first, "s": m(onset), "e": max(m(min(onset + 0.6, words[0]["s"] - 0.1)), m(onset) + 0.2)})
# cue match: prefix match only for words >= 4 chars and never for numbers ("40" matched "4000")
if hw == key or (len(key) >= 4 and not key.isdigit() and hw.startswith(key)):
```

## 4. B-roll catalog (`catalog.py`)
- `SEGMENTS = [(clip, in_s, out_s, tag), ...]`: only brand-free, person-free spans of
  the 30fps proxies, tagged home / outside / garage / car. The docstring lists every
  excluded clip or span and why (builder signs, doormat, dealer logos, hand in frame).
- `pick_shots(n, spec, tl)`: one slot per beat, 2 (or 3 for the fast style) when a
  beat is long; pool tags alternate from `spec["pool"]`; candidate index
  `(n*5 + i*3 + k) % len` so neighbouring reels open on different clips; no segment
  repeats inside a reel; in-point offset `((n*1.7 + i*2.3) % 1) * room`; a short
  segment gets `rate = max(0.5, avail/dur)` instead of running out.
- Mirror only `home` shots (`flip = (n+i) % 3 == 0 and tag == "home"`). Mirrored cars
  and garages show reversed logos and plates.
- Scan EVERY second of every clip for branding before adding a segment, not one
  frame at 45%. A company wall logo visible through a doorway only from
  ~11-18s of a stair clip slipped into 11 reels and was caught on one QA sheet.
  ```bash
  ffmpeg -v error -y -i clip.mp4 -vf "fps=1,scale=200:356,tile=15x2:padding=2" -frames:v 1 scan_a.jpg
  ffmpeg -v error -y -i scan_a.jpg -i scan_b.jpg -i scan_c.jpg -filter_complex vstack=inputs=3 scan.jpg
  ffmpeg -v error -y -ss 12 -i clip.mp4 -frames:v 1 -vf "crop=500:500:x:y" zoom.jpg   # suspicious blob
  ```
  Stack 3-4 clips per image and read each one.
- After finding a logo: list affected reels by testing each shot's source span
  `[from, from + dur*rate]` against the logo window, drop that span from `SEGMENTS`,
  then rebuild and re-render only those reels. Heavily blurred backgrounds (Notes
  style, 18px blur) made small wall text illegible; re-cut them anyway for consistency.

## 5. Templates and Root
- Style files import everything shared from `engine.tsx` and only decide palette,
  fonts, layout per beat type, and an `sfxFor(data)` list (passed through `thin()` so
  SFX within 0.18s of a louder one are dropped; levels under section 5b).
- Size display text with `fit(text, width, ratio, max, min)` =
  `floor(width / (longestLine * ratio))`. Calibrate `ratio` per font from a check
  frame: Barlow Condensed Italic 800 uppercase needed 0.5 (0.43 clipped titles).
- Root maps the generated index: `REELS.map(d => <Composition id={`R${pad(d.id)}${NAME[d.style]}`}
  component={STYLE[d.style]} defaultProps={{data: d}} durationInFrames={Math.round(d.total*30)} .../>)`.
- A Notes-style scrolling card: the scroll viewport is
  `CARD.h - head - foot - titleH - fineprintH` (52px here). Without subtracting the
  fine print, the newest line scrolled under it.

## 6. Render, QA, delivery
- `render.sh`: `npx remotion render src/index.ts R${nn}${Style} "$f" --codec h264 --crf 22`.
  crf 20 produced 19-20MB for 20-26s reels; crf 22 brought the same 20s reel from 20MB
  to 15MB, under the 19MB iMessage attachment limit. Print ffprobe duration, `du -m`,
  and a stereo-decoded peak per file. Outdoor/foliage footage compresses worse: a 24s
  luxury reel with outdoor shots hit 24MB at crf 22 and went out as a Drive link, so
  check size per reel and raise crf (or send the link) when over 19MB.
- `qa_frames.py N` prints `<CompId> <frames>`: for each beat, 0.7s after its last cue
  (capped at `t1*30 - 3`), plus `total*30 - 2`. `qa.sh` feeds it to `sheet.sh`.
- Keep the Python in a file. In macOS `/bin/bash` 3.2 a quoted heredoc inside
  `< <(python3 - <<'PY' ... PY)` broke: the dict literal's braces were expanded and
  the read failed with `ambiguous redirect`.
- Pipeline per reel as audio lands: `status.py` -> `build.py N` -> `qa.sh N` -> read
  sheet -> fix -> `render.sh N ...` in the background -> deliver.

## 7. Fact check in parallel
Before recording, split reels into factual (claims about law, loans, deadlines) and
non-factual. Mark factual ones `pending=True`, launch one background general-purpose
agent to verify them, and record the non-factual reels meanwhile (`tts.py --ready`).
Brief the agent with: primary-source list (CFPB, Fannie Mae, state statutes, TREC,
Comptroller, TDI), claim IDs with the exact script wording and what to check, and a
strict output per claim: `ID, VERIFIED / REVISE / UNVERIFIED`, a verbatim quote
(<= 40 words) from a page it actually fetched + URL, and for REVISE the minimal
corrected spoken wording, hedged where the source is conditional. Apply REVISE
wording to `reels.py`, clear `pending`, then record those reels.
