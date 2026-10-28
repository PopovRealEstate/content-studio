# Syncing a TTS / cloned-voice line to on-screen motion

Worked example: a 4.3s VoiceStudio cloned-voice line ("I am <name>,
welcome to the channel") dropped into an existing 5s Remotion logo sting, with the
last four words springing in on screen as they are spoken.

## 1. Inspect the raw clip before trusting any timestamp

Cloned-voice output can open with **~1.4s of low room tone (about -42 to -47 dB)**
before speech, most likely inherited from the reference recording. Two tools lie
about it:

- `ffmpeg -af silencedetect=n=-45dB:d=0.12` reported silence only for 0 to 0.13s,
  because the room tone hovered right at the threshold. It missed the lead-in.
- Whisper word timestamps ran **early**: "I" at 1.18s against a real onset of 1.50s
  (0.32s), and "welcome" at 2.80s against 3.20s (0.40s). Whisper tends to start a
  word inside the pause before it, so the error grows after pauses.

Measure onsets from a 50ms RMS loudness envelope instead, and use Whisper only to
confirm which words were said:

```python
import numpy as np, wave
w = wave.open("public/vo/line.wav")            # VoiceStudio wav: 24 kHz mono int16
sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
hop = int(sr * 0.05)
for i in range(0, len(x) - hop, hop):
    db = 20 * np.log10(np.sqrt(np.mean(x[i:i + hop] ** 2)) + 1e-9)
    print(f"{i / sr:4.2f} {db:6.1f} " + "#" * max(0, int((db + 50) / 2)))
```

Speech shows as a jump of 20+ dB (here -45 to -20 dB at 1.50s). Word onsets are the
jumps after each dip; the gap before "welcome" was a clear dip to about -44 dB.

## 2. Trim the lead-in and soften the edges

Cut to ~0.1s before the first onset, fade both ends so the cut does not click, and
resample to the video's audio rate:

```bash
ffmpeg -v error -y -i line.wav \
  -af "atrim=start=1.40,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.06,afade=t=out:st=2.72:d=0.08" \
  -ar 48000 line-trimmed.wav
```

`asetpts=PTS-STARTPTS` resets timestamps after `atrim`; without it the output keeps
the original offset. Every onset from step 1 now shifts by the trim start.

## 3. Place the words from measured onsets

Store the VO start and per-word times in the theme, computed as
`voStart + (rawOnset - trimStart)`:

```ts
vo: {
  start: 0.75,               // composition time the trimmed file starts
  end: 3.5,                  // speech end
  words: [{ text: "Welcome", at: 2.55 }, { text: "to", at: 2.75 },
          { text: "the", at: 2.93 }, { text: "channel.", at: 3.0 }],
},
```

Spring each word in **2 frames before** its spoken onset. A visual landing slightly
early reads as synced; a late one reads as broken:

```tsx
const items = words.map((w) => ({ text: w.text, from: Math.round(w.at * fps) - 2 }));
// per item: spring({ frame: frame - from, fps, config: theme.spring.snappy })
```

Also move anything that competes with the voice (here a glint/shimmer and the exit)
to after the speech ends, and lower SFX that land under a word.

## 4. Duck the music bed with a volume callback

```tsx
const at = (sec: number) => Math.max(0, Math.round(sec * fps));
const padVolume = (f: number) =>
  interpolate(f,
    [at(vo.start - 0.2), at(vo.start), at(vo.end), at(vo.end + 0.4)],
    [0.22, 0.08, 0.08, 0.2],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

<Audio src={staticFile("sfx/pad.wav")} volume={padVolume} />
<Sequence from={at(vo.start)}><Audio src={staticFile("vo/line-trimmed.wav")} volume={1} /></Sequence>
```

The frame passed to a `volume` callback is relative to the `<Audio>`'s enclosing
`<Sequence>` (Remotion's `useFrameForVolumeProp` uses `useCurrentFrame()` plus the
parent's negative offset). Keep the ducked bed at the top level so its frames are
composition-absolute, or subtract the Sequence's `from` yourself.

## 5. Keep the original; add the variant as a second Composition

```tsx
<Composition id="LogoSting" component={LogoSting} durationInFrames={150} ... />
<Composition id="LogoStingVO" component={LogoSting} defaultProps={{ vo: true }}
  durationInFrames={Math.ceil((vo.exit + 0.8) * FPS)} ... />
```

Thread `vo` through props (`vo ? theme.vo.words : undefined`) so the original cut
renders byte-for-byte as before.

## 6. Verify the final render, not the parts

Stills prove the picture; they do not prove the audio mix. After rendering:

```bash
ffmpeg -v error -y -i final.mp4 -vn -ac 1 -ar 16000 final_audio.wav   # then Whisper it
ffmpeg -hide_banner -i final.mp4 -vn -af volumedetect -f null - 2>&1 | grep -E "max_volume|mean_volume"
```

Check that Whisper hears every word of the line in the mix (music did not mask it),
that the word order and rough timing match the plan (remembering Whisper's early
bias), and that `max_volume` stays below 0 dB (here -3.1 dB max, -21.7 dB mean).

## 7. Multi-segment reels (countdown / top-N / tour): one take per segment

Worked example: a 30s-cap "Top 3 Racetracks" reel, a title line plus one line per
track, with captions and a map pin that must land on each track name.

**Record one TTS take per segment** (`title`, `t3`, `t2`, `t1`), not one long take.
Each segment then trims, speeds up, and shifts on its own, and a bad take is
re-recorded alone. Write numbers the way they should be spoken ("F.I.A.", "three
point one mile", "twenty-two-hundred-foot").

**Measure each take** with mlx-whisper (`word_timestamps=True`) plus a **20ms** RMS
envelope. Speech onset = first hop above **-32 dB**, offset = last hop above it.
Save both to `analysis.json`. Whisper stretched a take's first word over the leading
silence ("The" 0.00-1.30s against a real onset of 1.24s) and pulled every post-pause
word's start back to the previous word's end.

**Snap each word start forward** to the first loud hop inside Whisper's own
`[start, end]`, then clamp to the take onset:

```python
def refine(words, env, hop, onset):          # env: dB per hop (10-20ms)
    out = []
    for w in words:
        s, e = w["s"], w["e"]
        i0, i1 = int(s / hop), max(int(e / hop), int(s / hop) + 1)
        loud = np.where(env[i0:i1] > -32)[0]
        if len(loud): s = (i0 + loud[0]) * hop
        out.append({**w, "s": max(s, onset)})
    return out
```

**Cut dead air inside a take before trimming.** The cloned voice sometimes leaves about
1s of near-silence (-45 to -49 dB) between sentences in one take ("house?" ended at
4.30s, "Stop" began at 5.40s). Whisper hides it as a word gap, or by stretching a word
across it ("plan" 4.24-5.10s). Flag any gap or single word longer than ~0.5s, print the
50ms envelope (section 1) over that range, and cut the silent span, leaving ~0.3s
of pause. Cut with numpy using a 10ms crossfade, then pass **every** take time (onset,
offset, word starts/ends) through `remap()` so trims and captions stay aligned.
Envelope snapping (`refine`) still runs on the uncut take:

```python
CUTS = {"hook": [(4.45, 5.15)], "pmi": [(4.45, 4.75)]}   # take-time spans to remove
def remap(name, x):                                      # take time -> time in the cut take
    shift = 0.0
    for a, b in CUTS.get(name, []):
        if x >= b: shift += b - a
        elif x > a: return a - shift                     # inside a cut: clamp to its start
    return x - shift
# apply_cuts: keep = [x[:a*sr], x[b*sr:], ...]; join with a 10ms linear crossfade; write <name>_cut.wav
trim0 = remap(name, onset - 0.05); trim1 = remap(name, offset + 0.12)
m = lambda x: t + (remap(name, x) - trim0)                # take time -> reel time
```

**Fit the cap by cutting script, at natural pace.** House rule: 30s max,
short single-point reels 7-15s, and no voice speed-up; see the reel-craft skill, section
5c. The earlier racetrack reel used `atempo=1.2` to squeeze four takes (about 32s of
speech) to 29.77s. Use that only if he asks for it. Trim each take to
`[onset - 0.05, offset + 0.12]`, and fade both ends without knowing the output length
by reversing:

```bash
ffmpeg -v error -y -i t3_cut.wav -af "atrim=start=$T0:end=$T1,asetpts=PTS-STARTPTS,\
afade=t=in:st=0:d=0.03,areverse,afade=t=in:st=0:d=0.06,areverse" -ar 48000 t3_fx.wav
```

(Only if tempo is approved: insert `atempo=1.2,` after `asetpts`, pitch is kept.)

**Map every take time to reel time** with `t_reel = voStart + (remap(t) - trim0) / tempo`
(tempo 1 at natural pace), where `voStart` accumulates `dur + GAP` per take
(`dur = (trim1 - trim0) / tempo`; GAP 0.22s worked). Reference build:
the `build_timeline.py` pattern in the reel-series engine.

**Emit one `src/timeline.json`** that Remotion imports directly
(`import timeline from "./timeline.json"`): `vo[] {file, start, dur}`,
`captions[] {s, e, tokens[{text, s, e}]}`, `segments[] {id, start, end, pin, voEnd}`,
`titleEnd`, `endCard`, `total`. Set `durationInFrames = Math.round(total * fps)`, so
re-recording a take and re-running the script retimes the whole video. Start each
segment's picture about 0.18s before its voice, and hold each caption chunk until the
next one starts (max 0.35s past its last word).

**Write caption chunks by hand; take timing from Whisper tokens.** Whisper's text is
wrong for display: "Crescent" for a place name like Cresson, "3" + ".1" as two tokens, "2200" + "foot".
Define chunks as `(display text, first word idx, last word idx)` so one caption token
can span several Whisper words:

```python
CHUNKS = {"t1": [[("A", 8, 8), ("3.1-MILE", 9, 11)], [("ROAD", 12, 12), ("COURSE", 13, 13)]],
          "t2": [[("WITH", 14, 14), ("A", 15, 15), ("2,200-FOOT", 16, 17)]]}
NAME_WORD = {"t3": 2, "t2": 2, "t1": 3}     # pin time = refined start of this word
```

Print every chunk with its reel times after each build and read the list: a chunk
starting inside a pause means the snap missed.

**Land graphics on the word.** Start a pin's drop animation about 4 frames before the
name word's time and mount its map inset about 6 frames before, so the pin *lands* as
the name is heard (single words: 2 frames early, section 3). If a title card already
shows the title text, suppress burned-in captions until `titleEnd`.
