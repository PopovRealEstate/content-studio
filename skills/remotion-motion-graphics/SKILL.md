---
name: remotion-motion-graphics
description: Create and edit professional motion graphics videos with Remotion (React-based video). Use this skill EVERY time the user wants to create a video, edit a video, animate something, build an intro/outro/logo animation, make a Reel/Short/promo/launch video, add text animations or captions to footage, composite images and B-roll into a video, or mentions Remotion, motion graphics, video rendering, or "make this video look better/less generic". Also trigger when editing an existing Remotion project or when the user complains their video looks basic, generic, or amateur — this skill contains the exact fixes. Always read this skill BEFORE writing any Remotion code.
metadata:
  provenance: self-improving-skills

---
# Remotion Motion Graphics

Remotion renders React components frame-by-frame into video. Code quality is not the
bottleneck — **motion design craft is**. Untrained generation produces linear easing,
opacity-only fades, simultaneous entrances, flat colors, and no texture. That is the
"generic AI video" look. This skill exists to prevent it.

## Output location
- **Finished videos save to the Desktop by default**: render the final mp4 to
  `~/Desktop/<descriptive-name>.mp4`, not just `out/`. If the user names another
  location, use that instead.
- Never overwrite an unrelated file already on the Desktop: if the name is taken by
  something this job didn't create, add a suffix (`-v2`, or a date).
- The Remotion project (source, node_modules, frame-check PNGs) does NOT go on the
  Desktop: build it in `~/remotion-projects/<name>/` unless told otherwise. Keep
  `check_*.png` frames in the project's `out/`.
- **Optional delivery to the owner's phone** (only after the verify step passes, and only
  if `~/content-studio/docs/DELIVERY-AND-IMAGES.md` has been set up):
  `python3 ~/content-studio/scripts/delivery/send_video.py ~/Desktop/<name>.mp4 "<short caption>"`.
  Under 20MB it goes as an iMessage attachment; over that it uploads to Google Drive
  (private link); if Drive fails it falls back to a compressed phone copy. Send only to
  the owner: never send a video to anyone else without their explicit approval.
- Always send through `send_video.py`, never by POSTing a Desktop path to the notify
  service yourself. The service runs under launchd without macOS Desktop access (TCC),
  so reading `~/Desktop/...` hangs until timeout. The script stages a copy first.
- When done, tell the user the full Desktop path of the video and which delivery route
  actually succeeded (attachment, Drive link, or neither); never assume.

## Step 0: Design brief (every new video, before any code)
Ask a few clarifying questions on every new video so the design is sharper and the
style exact. There is NO fixed question list: read the prompt, find what it leaves
open or ambiguous that would most change the design, and ask 2-4 questions about
exactly that. Skip if the prompt leaves nothing important open, or for a
re-render/tweak of an existing project.
- **Format is fixed, never ask:** every video is a vertical Reel, 1080x1920 @ 30fps.
  Keep critical text in the middle ~75% (platform UI covers top and bottom).
- **Questions come from the prompt.** Never ask what was already said. Examples of
  prompt-driven gaps: "property video" with no photos named -> which photos;
  "make it hype" -> which kind of hype (beat-cut vs. slow luxury reveal);
  a quote with no CTA -> what the viewer should do next; a voiceover idea -> cloned
  voice or music only.
- **Style gets pinned exactly.** When the look is open, one question offers 2-4
  named directions fitted to THIS prompt, each with an exact spec (palette hex,
  font, motion, pace) and an ASCII `preview` frame. Default colors and fonts come
  from `~/content-studio/brand/BRAND.md`.
- **Previews carry no invented claims.** Mockup copy in a `preview` is read as
  the plan: a placeholder like "the FASTEST in town" alarms people. Use the
  real title/names from the prompt or neutral labels (`<place name>`), never a
  superlative, stat, or fact you have not verified.
- **Interactive session:** one `AskUserQuestion` call, concrete options, recommended
  first. After answers, state the exact style spec in one short block (palette,
  fonts, motion vocabulary, pacing, sound) and build. No second approval round
  unless an answer conflicts or is ambiguous.
- **Headless run (`claude -p`, no AskUserQuestion):** do NOT build yet. Create
  `~/remotion-projects/<slug>/BRIEF.md` with the request and your prompt-specific
  questions (numbered, lettered options, recommended first), then make your final
  reply ONLY those questions in plain text. When a later task carries the answers,
  read the newest `BRIEF.md`, append the answers, and build.

## Step 0b: Gather assets (the owner's media + web images for what they name)
- **Their own media:** the folder named in `BRAND.md` (default `~/Desktop/Media`;
  iPhone .MOV/.MP4 clips, .HEIC photos). Use it when the prompt points at their
  footage or photos; `ffprobe` clips first. HEIC won't render in Chrome: convert with
  `sips -s format jpeg in.HEIC --out x.jpg`. Copy what you use into the project's
  `public/` (never edit or move originals).
- **Web images for things they mention** (a place, venue, brand, car, landmark):
  search the web, prefer the subject's OFFICIAL site, then press/Wikimedia; highest
  resolution; skip Pinterest, stock watermarks, logos of unrelated things. (A local
  SearXNG at `http://127.0.0.1:8888/search?q=<query>&categories=images&format=json`
  also works if you run one.) Download with `curl -L -A "Mozilla/5.0"`, verify with
  `file`, LOOK at it before using, save to `public/web/`, and log each source URL in
  the project's `CREDITS.md`.
- **Assets the owner provides are used as provided** (maps, layouts, logos): show them
  whole on a clean card; do not extract, trace, or restyle unless asked. Only for busy
  WEB images (site plans, maps) consider tracing the key shape, and offer it rather
  than assume.
- iPhone clip prep, 9:16 layout zones, map pins, fact research, still-sheet QA:
  `~/.claude/skills/remotion-vertical-reel-craft/SKILL.md` (a separate skill, so it
  survives re-copying this one).
- **Rights:** official/business images are fine for the owner's own promo use; if an
  image is clearly a third-party photographer's or stock, say so in the style block
  and prefer an alternative (official image, Wikimedia, their own media, or a traced/
  generated graphic).

## Non-negotiable rules (apply to EVERY composition)

1. **NEVER use linear interpolation.** Every `interpolate()` gets an easing curve;
   every entrance prefers `spring()`. Always `extrapolateLeft/Right: "clamp"`.
2. **Entrances animate 2–3 properties together** (opacity + translateY + scale).
   A lone fade is forbidden.
3. **Stagger everything.** Lists, words, rays, cards: 3–6 frame offsets. Nothing
   enters simultaneously.
4. **Exits exist and are faster than entrances** (~10 frames vs ~20).
5. **Five-layer stack in every scene**, bottom to top: background mesh → assets →
   graphics/type → color grade → grain + vignette. Never a flat solid background.
6. **Every still image gets Ken Burns** (slow scale 1→1.08 + pan). Every video asset
   uses `<OffthreadVideo>`, never `<Video>`.
7. **Idle elements breathe**: anything on screen >2s gets sin-wave micro-motion.
8. **All timing derives from `fps`** via `useVideoConfig()`. No magic frame numbers.
9. **One theme object** at the top of the project (colors, easings, spring presets,
   fonts). Never inline a hex color or easing in a component.
10. **Render, extract frames, LOOK at them, fix, re-render.** Never deliver an
    unverified render. This loop is mandatory — see Verification below.

## Workflow

### Step 1 — Scope
Determine: duration, fps (30 default; 60 only for heavy fast motion), dimensions
(1080×1920 Reels/Shorts, 1920×1080 landscape), what assets exist (images, footage,
audio, logos), and whether this is a new composition or an edit to an existing project.
If editing an existing project: read `src/` fully first, find the theme (or create one),
and refactor violations of the rules above before adding features.

### Step 2 — Setup
New project:
```bash
npm install remotion @remotion/cli react react-dom
# optional: @remotion/transitions @remotion/motion-blur @remotion/google-fonts
```
Copy `assets/theme.ts` from this skill into `src/theme.ts` and adjust the palette to
the user's brand. Structure: `src/index.ts` (registerRoot) → `src/Root.tsx`
(Composition, duration/fps/size) → `src/scenes/*.tsx` → `src/components/*.tsx`.
User assets go in `public/`, loaded via `staticFile()`.

### Step 3 — Build
Read `references/motion-patterns.md` for the reusable component implementations
(BgMesh, Grade, Grain, Vignette, KenBurns, WordReveal, Stagger, Counter, Spark,
transitions, parallax). Compose scenes from those patterns. For pacing, rhythm,
typography, color palettes, and sound design rules, read
`references/design-rules.md`.

Scene rhythm: HIT → hold (15–20 still frames) → build → HIT. Something must move
in the first 15 frames. Never >90 frames without a new visual element.

### Step 4 — Render
```bash
npx remotion render src/index.ts <CompId> ~/Desktop/<descriptive-name>.mp4 --codec h264 --crf 17
```
(Final output goes to the Desktop per the override above; intermediate test renders
can go to `out/`.)
Remotion needs a Chromium binary. If its auto-download fails (sandboxes, offline CI),
find one and pass it explicitly:
```bash
which chromium chromium-browser google-chrome 2>/dev/null
ls /opt/pw-browsers 2>/dev/null   # Playwright installs live here
npx remotion render ... --browser-executable=<path>
```
If full Chrome errors with "Old Headless mode has been removed", use a
`headless_shell` binary instead (Playwright ships one as
`chromium_headless_shell-*/chrome-linux/headless_shell`).

### Step 5 — VERIFY (mandatory, never skip)
Extract frames at key moments and visually inspect each one. The portable
method — works on machines with no system ffmpeg, renders the exact frame:
```bash
for f in 15 45 90 150; do
  npx remotion still src/index.ts <CompId> out/check_$f.png --frame $f --overwrite
done
```
If system ffmpeg IS available, extracting from the finished mp4 also verifies
the encode itself (`-ss` seeking is more portable than `select=` filters, whose
quoting breaks in some shells and in Remotion's bundled ffmpeg):
```bash
ffmpeg -v error -ss 1.5 -i out/video.mp4 -frames:v 1 check_1.png
```
Look for, and fix, in order of frequency:
- **Spacing bugs**: `gap`/`margin` in `em` resolves against the PARENT font-size
  (often 16px), not the text size — use px values in flex containers around big type.
- Text overflowing or touching frame edges (keep critical content in middle 75%
  vertically for 9:16 — platform UI covers top/bottom).
- Elements visible before their entrance or after their exit (missing clamp).
- Color/contrast failures: hero color on >1 element per frame, dim text unreadable
  over the grade.
- Layer order mistakes (grain/vignette must be on top, grade above content).
Fix → re-render → re-extract → re-inspect. Only deliver after a clean pass.
Then run the final checklist at the bottom of `references/design-rules.md`.

### Editing the user's existing footage
To enhance an existing mp4 (captions, grade, intro/outro) rather than build from
scratch: put the file in `public/`, render it as the asset layer with
`<OffthreadVideo src={staticFile("clip.mp4")} />`, set composition duration from the
clip length, and stack graphics/grade/grain above it. Get the clip's duration and fps
with `ffprobe` before setting up the composition. For word-synced captions over
speech, see the captions section of `references/motion-patterns.md`.

## Reference files
- `references/motion-patterns.md` — copy-paste component library: backgrounds,
  grade/grain/vignette, Ken Burns, text reveals, counters, transitions, parallax,
  audio sync, captions. Read before writing components.
- `references/design-rules.md` — palettes, typography rules, scene architecture,
  sound design, pre-delivery checklist. Read before designing scenes and before
  final delivery.
- `assets/theme.ts` — the theme template to copy into every project.
- Adding a TTS or cloned-voice voiceover and syncing words on screen: see the
  omnivoice skill's `references/voiceover-sync-to-picture.md` (Whisper word times
  run early on TTS; measure onsets from loudness, duck the bed, verify the mix;
  section 7 covers multi-segment countdown reels and a `timeline.json`).

## Common failure modes to actively avoid
- **Emoji as icons.** Emoji render as full-color platform glyphs (green ✳️,
  blue 🌐) that ignore your palette and silently break the one-hero-color rule,
  and they sit on whatever background you gave them (orange mascot on orange
  tile = invisible). Draw glyphs with CSS/SVG in theme colors, or verify every
  emoji against the extracted frames.
- **No SFX assets is not a reason to ship silent.** Synthesize a minimal kit as
  16-bit WAVs from a Node script (noise-burst whoosh, pitch-drop pop, sine-thump
  kick/bass, detuned-sine pad) into `public/sfx/` — see `examples/scripts/` in
  the repo. Zero downloads, fully deterministic.
- Generating one giant component instead of themed, reusable pieces.
- `durationInFrames` mismatch between Composition and scene content (dead air).
- Forgetting `--overwrite` on re-renders, then inspecting the stale file.
- **`npx tsc --noEmit` in a project set up per Step 2 is not a typecheck.** That
  setup installs no `typescript`, so npx downloads the unrelated npm package
  `tsc@2.0.4`, which prints "This is not the tsc command you are looking for" and
  checks nothing. Use `npx -p typescript tsc --noEmit` (it also needs a
  `tsconfig.json` with `"jsx": "react-jsx"`, which Step 2 does not create). The
  `npx remotion still` bundle catches syntax and import errors, not type errors.
- Fonts: never rely on system defaults for hero text; load a display font via
  `@remotion/google-fonts` or `@font-face` + `staticFile`.
- Trying to "describe" the result to the user instead of rendering and verifying it.
