---
name: remotion-vertical-reel-craft
description: Use this when building a 9:16 Reel/Short/TikTok in Remotion from phone B-roll, user images/SVGs, and a segmented voiceover (countdown, top-3, faceless explainer like "you don't need 20% down"), rendering one video "in 3 styles", or batch-producing a series ("make 30 reels"): iPhone .MOV proxies, contact sheets, 1080x1920 zones, map pins, captions, verified claims, length rules, still-sheet QA. Complements remotion-motion-graphics; VO timing is in omnivoice's voiceover-sync reference.
metadata:
  provenance: self-improving-skills
  origin: distilled
---

# Vertical reel craft (Remotion, phone footage, segmented VO)

## When this applies
- A 1080x1920 reel is built from the user's own phone clips (iPhone .MOV/.MP4) plus
  provided images/SVGs, often with a voiceover and per-item graphics (map pins,
  layout cards, a countdown).
- Triggers: "make a reel from my media folder", "top 3 ... near <city>", "pin appears
  when I say the name", "burned-in captions", "under 30 seconds", "make the same video
  in each of the 3 styles", a reel from a content plan (educational / finance tip).
- Read `remotion-motion-graphics` for motion craft. For voiceover timing (one take per
  segment, word snapping, `atempo`, `timeline.json`), read
  `~/.claude/skills/omnivoice/references/voiceover-sync-to-picture.md` section 7.

## The technique

### 1. Inventory and prep the footage
iPhone clips are usually HEVC with `rotation -90` in side data, often 4K60 or
4K120. Probe everything first. In zsh an unmatched glob aborts the loop
("no matches found: *.mp4", exit 1), so enable `nullglob`:

```bash
setopt nullglob; for f in *.MOV *.mov *.MP4 *.mp4; do
  ffprobe -v error -select_streams v:0 -show_entries \
    stream=width,height,codec_name,r_frame_rate:stream_side_data=rotation:format=duration \
    -of csv=p=0 "$f" | tr '\n' ' '; echo " $f"; done
```

Transcode only the clips you use into vertical 30fps H.264 proxies in `public/clips/`.
ffmpeg applies the rotation automatically, so no `transpose` is needed:

```bash
ffmpeg -v error -y -i "IMG_3074.MOV" \
  -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30" \
  -c:v libx264 -crf 18 -preset fast -pix_fmt yuv420p -an public/clips/racing.mp4
```

To see the whole folder, grab one frame per clip at 45% of its duration and tile the
frames into one sheet. To pick in-points, make a 1fps strip per proxy: tile N is
second N.

```bash
ffmpeg -v error -y -ss "$T45" -i "$f" -frames:v 1 \
  -vf "scale=240:420:force_original_aspect_ratio=decrease,pad=240:420:(ow-iw)/2:(oh-ih)/2" "sheet/$n.jpg"
ffmpeg -v error -y -pattern_type glob -i "sheet/[0-9]*.jpg" -vf "tile=8x3:padding=4" -frames:v 1 sheet.jpg
ffmpeg -v error -y -i public/clips/racing.mp4 -vf "fps=1,scale=180:320,tile=8x2:padding=3" -frames:v 1 strip.jpg
```

Scan every contact sheet for third-party branding before picking shots: builder
monument signs, flags, "only N homesites remaining" signs, branded doormats and
shopping bags. Leave the clip out or set its in-point past the brand (a hallway clip
started at 6.0s to skip a builder doormat), and list the exclusions in `CREDITS.md`.
One frame per clip misses brands that show for only a few seconds; for a series, scan
every second (recipe in `references/series-engine.md` section 4).

Label tiles by their order (write an `index.txt` of `NN filename`) rather than with
`drawtext`: the Homebrew ffmpeg on this Mac has no drawtext filter
(`No such filter: 'drawtext'`). Check with `ffmpeg -filters | grep drawtext`.

Play shots with `<OffthreadVideo src={staticFile(...)} trimBefore={Math.round(from * fps)} muted />`.
In Remotion 4.0.523 `trimBefore` is the current prop and `startFrom` is marked
`@deprecated` (renamed). When one source clip has to fill several segments, use
different in-points and mirror one reuse with `transform: scaleX(-1)` so it does not
read as a repeat.

### 2. Layout zones for 1080x1920 (px, from checked frames)
Keep the zones in the theme (`layout: { headerTop: 250, captionTop: 1330, insetX: 700,
insetY: 250, insetSize: 320 }`): segment header near y=250, burned-in captions at
y~1330, the map inset top-right (320px at x=700, y=250), and the main card centered
around y~980. Instagram covers roughly the top 220px, the bottom 420px, and a right
button rail from y~1150.

- **Legibility scrim goes UNDER the type.** The upstream five-layer stack puts the
  grade above graphics. A darkening gradient in that layer grays out white captions.
  Split it: a `Scrim` (dark top and bottom gradient) sits between footage and
  graphics, and only a faint color tint (`mix-blend-mode: soft-light`, ~8%) plus grain
  and vignette sit on top.
- **Fit variable-aspect images into a max box**, not a fixed width, so a
  near-square image cannot reach the captions:
  `const H = Math.min(960 / aspect, 620); const W = H * aspect;`
- **Put tags inside cards** (e.g. a "TRACK MAP" chip in the card's bottom-left
  corner). A tag above a card collided with the header's subline.
- **Captions:** 2-4 words per chunk, uppercase condensed, active word in the hero
  color, readable over footage via `WebkitTextStroke: "3px #000", paintOrder: "stroke fill"`
  plus a soft shadow. Hide captions during a title card that already shows the title.
- **End card with several map pins:** labels collide when pins cluster near one
  edge. Use numbered pins with labels off, and put a legend list under the map.

### 3. Map pins from real coordinates
Get coordinates from the Wikipedia API instead of guessing:

```bash
curl -sL -A "Mozilla/5.0" "https://en.wikipedia.org/w/api.php?action=query&prop=coordinates&titles=Anna,_Texas&format=json"
# -> query.pages.*.coordinates[0].lat / .lon
```

A stylized regional map only needs an equirectangular projection with a cos(latitude)
factor on longitude, so distances do not stretch east-west:

```ts
const LON0 = -97.85, LON1 = -96.35, LAT0 = 32.35, LAT1 = 33.6;   // region bbox
const K = Math.cos((33 * Math.PI) / 180);                           // mid-latitude
const SPAN = Math.max((LON1 - LON0) * K, LAT1 - LAT0);
export const project = (lat: number, lon: number) => ({
  x: (((lon - LON0) * K) / SPAN) * 1000, y: ((LAT1 - lat) / SPAN) * 1000 });  // 1000x1000 viewBox
```

Draw roads as straight city-to-city links and say so in `CREDITS.md` ("stylized, not
survey data"). Leave mileage off unless a source states it. Driving distance
depends on the route.

### 4. Facts for the script (verified or omitted)
Use only facts from a source you fetched: the venue's official site first, then
Wikipedia. When the local SearXNG general search returns zero results, fetch the
pages directly and search the text:

```python
t = re.sub(r'(?s)<(script|style)[^>]*>.*?</\1>', ' ', html); t = re.sub(r'<[^>]+>', ' ', t)
for m in re.finditer(r'.{0,80}\d+\.\d+[- ]mile.{0,80}', t, re.I): print(m.group(0))
```

A sentence splitter on `.` cuts decimals apart ("3.1-mile" came out as "1-mile"), so
match the number pattern itself. For opening year, location, and coordinates, read
the Wikipedia infobox. Log every source in `CREDITS.md`. Mockups and option previews
shown to the user (AskUserQuestion `preview`, style frames) follow the same rule: no
invented claims, not even as placeholder copy.

**Faceless educational reels (finance, loans, market tips).** Check every claim against
a primary source (CFPB, VA.gov, HUD, Freddie Mac / Fannie Mae), not a blog. A small
fetch helper (`grab.py URL PATTERN...`) curls with a browser User-Agent, strips
script/style/tags, collapses whitespace, prints the text length, and prints 160 chars
around each regex match. A tiny length (60 or 1,700 chars) with no match means the page
renders client-side. Treat that claim as unverified and **drop it** (FHA 3.5% was cut for
this reason). Then:
- Match the script's hedge to the source's condition: "some loan programs" (3% is for
  income-limited borrowers), "eligible veterans **may** qualify" (only if price <=
  appraisal), "**usually** means mortgage insurance" (conventional loans under 20%).
- Put one fine-print line on screen (`FINE_PRINT = "Eligibility and terms vary by
  lender, credit, and loan program."`), small and dim, while the claims are on screen.
- In `CREDITS.md`, log each claim as quote + URL + "hence <hedge word>", plus the claims
  you dropped and why.
- Many claims at once: hand them to one background agent with a strict
  `VERIFIED / REVISE / UNVERIFIED` + verbatim quote + URL format, and record the
  non-factual reels while it runs (brief template: `references/series-engine.md` section 7).

### 5. User-provided assets: use them whole
Put images and SVGs the user supplies for the video (track layouts, logos, floor plans)
in the reel as provided, on a clean card with a gentle push. Do not extract, trace, or
restyle them unless asked. Pulling "the track path" out of CorelDRAW-exported SVGs by
fill class returned the wrong shapes (the longest path was a logo word, another was
half a track). A bbox estimate over relative path commands (`c`, `l`, `m`) is also
meaningless, because it adds offsets as if they were coordinates. Load the SVG with
`<Img src={staticFile("maps/place.svg")} style={{ objectFit: "contain" }} />` and use
its viewBox aspect for the max-box fit.

### 5b. Sound levels (house default)
SFX sit UNDER the voiceover. These `<Audio volume>` levels (voice at 1.0, SFX synthesized
normalized near -1 dBFS) were approved on a Top-3 reel; use them as the ceiling on
every video, and going slightly lower is fine:

| Sound | volume |
|---|---|
| Opening/title-card hit | 0.45 |
| Segment wipe whoosh | 0.44 |
| Shot-cut whip | 0.40 |
| Map-pin thud (lands on the spoken name) | 0.40 |
| Riser into the final segment | 0.28 |
| Closing hit | 0.36 |

Any new SFX type: start around 0.35-0.40 and never louder than the title hit. The first
version (whoosh 0.55, pin 0.9) masked the voice. Verify with a stereo-decoded peak
(`ffmpeg ... -ac 2 -f f32le`); a mono downmix check overstates peaks.

### 5c. Length (house rule)
Every reel is 30s max. Short single-point reels run 7-15s. Classify the reel before
scripting, budget about 2.6 spoken words/s at natural pace plus 1.5-2s of end card,
and fit by cutting script words. Do not speed up the cloned voice with `atempo`.

### 6. QA with still sheets
Render check stills at the key moments (title, each cut, each pin landing, a
caption-heavy frame, the last frame) and tile them into one sheet per pass, so one
image read covers the whole reel. Copy
`~/.claude/skills/remotion-vertical-reel-craft/scripts/sheet.sh` into the project's
`scripts/` and run `scripts/sheet.sh <CompId> <prefix> [frame ...]` (bash arrays; pads
odd counts; one row under 4 frames, else 2 rows). Output: `out/<prefix>_sheet.jpg`.

### 7. Same VO and timing in N styles (style comparison)
To show the user one script in several looks, keep everything but the look shared:
- `src/timeline.json`: the VO build output (omnivoice reference, section 7).
- `src/cues.ts`: `TL = timeline`, word cues `CUE = { three: w("p3", 7), ... }` where
  `w(beat, i) = TL.beats[beat].words[i].s`, the B-roll `SHOTS` list (`{at, clip, from}`
  with `at` tied to cues or beat starts), `BRAND`, `FINE_PRINT`, easings.
- `src/common.tsx`: `useClock()` (`f(sec)`, `sp(sec, cfg, lead=2)`, `out`, `ramp`),
  `Footage mode="cross" | "whip"`, `Captions look={...}` (font, size, top, color, active
  color or `activeBg` pill, stroke), `Soundtrack sfx={[...]}`, `Grain`, `Vignette`, `Tint`.
- `src/styles/<Look>.tsx`: one component per look that composes the shared parts with its
  own palette, fonts, and cards. Register each look as its own Composition:

```tsx
const common = { durationInFrames: Math.round(timeline.total * 30), fps: 30, width: 1080, height: 1920 } as const;
<Composition id="Reel01Luxury" component={Luxury} {...common} />
<Composition id="Reel01Motorsport" component={Motorsport} {...common} />
<Composition id="Reel01Notes" component={Notes} {...common} />
```

Re-recording a take retimes all looks at once. Sheet each look with the same frame
list so they compare side by side.

### 8. A series of N reels (batch engine)
For 10+ reels, make every reel data: one dict per reel (spoken lines + generic beats
hero/list/vs/quote/cta whose times are cue strings like `"c:word#2+0.3"`), a resumable
TTS script, a build script that turns takes into `src/data/rNN.json` (auto dead-air cut,
Whisper cleanup, cue resolution, shot picking from a tagged clean-B-roll catalog), style
templates that render the beat types, a Root that registers one Composition per data
file, and render/QA scripts (`--crf 22` keeps 20-30s reels under the 19MB iMessage
limit). Layout, code, and the Whisper/VoiceStudio gotchas: `references/series-engine.md`.
Top traps: run one TTS queue only (VoiceStudio serializes; a 3rd client gets 429); a
clone can prepend "Yeah." (flag heard words not in the script); Whisper drops a lone
first word and splits "$600" + ",000"; match numeric cues exactly ("40" hit "4000").

## Gotchas
- The last renderable frame is `durationInFrames - 1`. `--frame 893` on an 893-frame
  composition throws `RangeError: Cannot use frame 893`.
- Quick Look previews (`qlmanage -t`) crop non-square SVGs to a square. To see the
  whole drawing, pad the viewBox to a square first or render it in Remotion.
- Probe for the rotation tag, not just width and height: a "3840x2160" iPhone clip
  with `-90` is portrait.
- Verify before inserting the footage: ask which clips were shot where, and do not
  label a clip with a place from its filename or look alone.
- A darkening gradient added on top for "cinematic grade" is the most common reason
  captions look dim in check frames. Look at the scrim order first.
- `<Sequence from={n}>` resets `useCurrentFrame()` to 0 at `n`. A component that
  compares the frame to absolute cue times from `timeline.json` fires late or never
  inside one. Mount it with a frame-range conditional instead:
  `{frame >= f(TL.beats.va.from) - 1 && <Stat ... />}`.
- Whip cuts: the incoming shot slides in over 6 frames, so the outgoing shot's
  Sequence must run ~7 frames past the cut (`end = f(next.at) + 7`; +1 for dissolves).
  Otherwise the black background shows through during the whip.
- Caption pill highlight (`activeBg`): give every token the same padding and shrink the
  flex gap. Padding only the active word (with a negative margin to compensate) made the
  pill crowd the next word and shifted words as it moved.
- Run frame loops from a bash script, not zsh: `frames="20 45"; for fr in $frames` runs
  once with the whole string and fails with `RangeError: Frame NaN is not finite`.
- ffmpeg `hstack` needs at least 2 inputs; a row of one fails with
  `Value 1.000000 for parameter 'inputs' out of range ... Result too large`.
