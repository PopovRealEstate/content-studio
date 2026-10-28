// Shared engine for the 30-reel series: data types, timing helpers, footage, captions, sound, texture.
// Each reel's src/data/rNN.json comes from scripts/build.py (all times are reel seconds).
import React from "react";
import {
  AbsoluteFill, Audio, Easing, interpolate, OffthreadVideo, Sequence, spring, SpringConfig, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";

// ---- data ---------------------------------------------------------------------------------
export type Item = { text: string; at: number };
export type Side = { title: string; body: string; at: number };
export type Pair = { label: string; text: string; at: number };
export type Beat = {
  type: "hero" | "list" | "vs" | "quote" | "cta"; t0: number; t1: number;
  kicker?: string; big?: string; sub?: string; kickerAt?: number; bigAt?: number; subAt?: number;
  mode?: "number" | "check" | "x" | "stack"; items?: Item[]; left?: Side; right?: Side; pairs?: Pair[];
  head?: string; action?: string; headAt?: number; actionAt?: number; brandAt?: number;
};
export type Shot = { at: number; clip: string; from: number; flip: boolean; rate: number };
type Tok = { text: string; s: number; e: number };
export type Cap = { s: number; e: number; tokens: Tok[] };
export type ReelData = {
  id: number; slug: string; style: string; note: string; fine: string; total: number; speechEnd: number;
  vo: { file: string; start: number }[]; captions: Cap[]; beats: Beat[]; shots: Shot[];
};

// EDIT ME: shown on the closing card of every Reel. Keep in sync with ~/content-studio/brand/BRAND.md.
export const BRAND = { name: "YOUR BRAND NAME", phone: "(000) 000-0000", broker: "YOUR TAGLINE OR COMPANY" };

export const ease = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.83, 0, 0.17, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
};
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ---- timing helpers -------------------------------------------------------------------------
export const useClock = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = (sec: number) => Math.round(sec * fps);
  /** spring starting `lead` frames before `sec` (graphics land slightly early to read as synced) */
  const sp = (sec: number, config: Partial<SpringConfig>, lead = 2) => spring({ frame: frame - f(sec) + lead, fps, config });
  /** 1 -> 0 over `dur` s ending at `sec` (exits faster than entrances) */
  const out = (sec: number, dur = 0.3) => interpolate(frame, [f(sec) - Math.round(dur * fps), f(sec)], [1, 0], { ...clamp, easing: ease.in });
  /** 0 -> 1 over `dur` s from `sec` */
  const ramp = (sec: number, dur: number, easing = ease.out) => interpolate(frame, [f(sec), f(sec) + Math.max(1, Math.round(dur * fps))], [0, 1], { ...clamp, easing });
  return { frame, fps, t: frame / fps, f, sp, out, ramp };
};

/** Standard entrance: opacity + translateY + scale (+ optional blur). */
export const enter = (p: number, dy = 30, s0 = 0.92, blur = 0): React.CSSProperties => ({
  opacity: interpolate(p, [0, 0.45], [0, 1], clamp),
  transform: `translateY(${interpolate(p, [0, 1], [dy, 0])}px) scale(${interpolate(p, [0, 1], [s0, 1])})`,
  filter: blur ? `blur(${interpolate(p, [0, 1], [blur, 0], clamp)}px)` : undefined,
});

/** Render "*accent*" and "\n" markup. */
export const Rich: React.FC<{ text: string; accent: React.CSSProperties }> = ({ text, accent }) => (
  <>
    {text.split("\n").map((line, li) => (
      <React.Fragment key={li}>
        {li > 0 && <br />}
        {line.split(/(\*[^*]+\*)/).map((part, i) =>
          part.startsWith("*") && part.endsWith("*") ? <span key={i} style={accent}>{part.slice(1, -1)}</span> : <React.Fragment key={i}>{part}</React.Fragment>,
        )}
      </React.Fragment>
    ))}
  </>
);
export const plain = (s: string) => s.replace(/\*/g, "");

/** Font size so the longest line fits `width` px, given an average glyph width ratio for the font. */
export const fit = (text: string, width: number, ratio: number, max: number, min = 40) => {
  const longest = Math.max(...plain(text).split("\n").map((l) => l.length), 1);
  return Math.max(min, Math.min(max, Math.floor(width / (longest * ratio))));
};

/** Beat currently on screen (with a short overlap so exits can play). */
export const useBeatWindow = (b: Beat, pre = 0.15, post = 0.12) => {
  const { t } = useClock();
  return t >= b.t0 - pre && t < b.t1 + post;
};

// ---- footage ------------------------------------------------------------------------------
type FootageProps = { shots: Shot[]; total: number; mode: "cross" | "whip"; push?: number; filter?: string; scale?: number };

/** Plays the shot list back to back. cross = 8-frame dissolve; whip = incoming slides in with motion blur. */
export const Footage: React.FC<FootageProps> = ({ shots, total, mode, push = 0.08, filter, scale = 1 }) => {
  const { fps } = useVideoConfig();
  const f = (s: number) => Math.round(s * fps);
  const TF = mode === "cross" ? 8 : 0;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {shots.map((s, i) => {
        const start = Math.max(0, f(s.at) - (i ? TF : 0));
        // outgoing shot stays under the incoming one until the whip/dissolve has covered the frame
        const end = i + 1 < shots.length ? f(shots[i + 1].at) + (mode === "whip" ? 7 : 1) : f(total) + 1;
        return (
          <Sequence key={i} from={start} durationInFrames={Math.max(1, end - start)} layout="none">
            <ShotView shot={s} len={end - start} mode={i ? mode : "cross"} tf={i ? TF : 0} push={push} filter={filter} scale={scale} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const ShotView: React.FC<{ shot: Shot; len: number; mode: "cross" | "whip"; tf: number; push: number; filter?: string; scale: number }> = ({
  shot, len, mode, tf, push, filter, scale,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const kb = interpolate(frame, [0, len], [1, 1 + push], { ...clamp, easing: ease.inOut });
  const drift = interpolate(frame, [0, len], [0, -18], clamp);
  let opacity = 1, tx = 0, mblur = 0;
  if (mode === "cross" && tf) opacity = interpolate(frame, [0, tf], [0, 1], { ...clamp, easing: ease.out });
  if (mode === "whip") {
    const p = interpolate(frame, [0, 6], [0, 1], { ...clamp, easing: ease.out });
    tx = interpolate(p, [0, 1], [1080, 0]);
    mblur = interpolate(p, [0, 0.7, 1], [28, 10, 0]);
  }
  return (
    <AbsoluteFill style={{ opacity, transform: `translateX(${tx}px)` }}>
      <AbsoluteFill
        style={{
          transform: `scale(${kb * scale}) translateY(${drift}px) scaleX(${shot.flip ? -1 : 1})`,
          filter: [filter, mblur ? `blur(${mblur}px)` : ""].filter(Boolean).join(" ") || undefined,
        }}
      >
        <OffthreadVideo
          src={staticFile(`clips/${shot.clip}.mp4`)} trimBefore={Math.round(shot.from * fps)} playbackRate={shot.rate} muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---- captions -----------------------------------------------------------------------------
export type CaptionLook = {
  top: number; font: string; weight: number; size: number; italic?: boolean; tracking?: string; color: string;
  active: string; activeBg?: string; stroke?: string; shadow?: string; gap?: string;
};

/** Burned-in word captions; the spoken word takes the accent (color, or a pill behind it). */
export const Captions: React.FC<{ caps: Cap[]; look: CaptionLook }> = ({ caps, look }) => {
  const { frame, fps, t } = useClock();
  const cap = caps.find((c) => t >= c.s - 2 / fps && t < c.e);
  if (!cap) return null;
  const p = spring({ frame: frame - Math.round(cap.s * fps) + 2, fps, config: { damping: 15, stiffness: 190, mass: 0.6 } });
  const activeIdx = cap.tokens.reduce((acc, k, i) => (t >= k.s - 0.03 ? i : acc), 0);
  return (
    <div
      style={{
        position: "absolute", top: look.top, left: 60, right: 60, display: "flex", flexWrap: "wrap", justifyContent: "center",
        gap: look.gap ?? "6px 20px", fontFamily: look.font, fontWeight: look.weight, fontStyle: look.italic ? "italic" : "normal",
        fontSize: look.size, lineHeight: 1.08, letterSpacing: look.tracking, textTransform: "uppercase",
        opacity: interpolate(p, [0, 0.4], [0, 1], clamp),
        transform: `translateY(${interpolate(p, [0, 1], [18, 0])}px) scale(${interpolate(p, [0, 1], [0.94, 1])})`,
      }}
    >
      {cap.tokens.map((k, i) => {
        const on = i === activeIdx;
        return (
          <span
            key={i}
            style={{
              color: on ? look.active : look.color,
              background: on && look.activeBg ? look.activeBg : "transparent",
              // pill looks pad every token so words never shift when the pill moves
              borderRadius: look.activeBg ? 12 : 0, padding: look.activeBg ? "0 10px" : 0,
              WebkitTextStroke: look.stroke, paintOrder: "stroke fill", textShadow: on && look.activeBg ? "none" : look.shadow,
            }}
          >
            {k.text}
          </span>
        );
      })}
    </div>
  );
};

// ---- audio --------------------------------------------------------------------------------
export type Sfx = { file: string; at: number; vol: number };

/** Voice at 1.0; SFX at or under the house ceiling (title hit 0.45, whoosh 0.44, whip/pin 0.40, end hit 0.36). */
export const Soundtrack: React.FC<{ data: ReelData; sfx: Sfx[] }> = ({ data, sfx }) => {
  const { fps } = useVideoConfig();
  const f = (s: number) => Math.max(0, Math.round(s * fps));
  return (
    <>
      {data.vo.map((v) => (
        <Sequence key={v.file} from={f(v.start)} layout="none">
          <Audio src={staticFile(v.file)} volume={1} />
        </Sequence>
      ))}
      {sfx.filter((s) => s.at < data.total - 0.2).map((s, i) => (
        <Sequence key={i} from={f(s.at)} layout="none">
          <Audio src={staticFile(`sfx/${s.file}.wav`)} volume={s.vol} />
        </Sequence>
      ))}
    </>
  );
};

/** Drop SFX that land within `gap` s of a louder one already scheduled (keeps the mix from stacking). */
export const thin = (sfx: Sfx[], gap = 0.18) => {
  const out: Sfx[] = [];
  for (const s of [...sfx].sort((a, b) => b.vol - a.vol)) {
    if (!out.some((o) => Math.abs(o.at - s.at) < gap)) out.push(s);
  }
  return out.sort((a, b) => a.at - b.at);
};

// ---- texture ------------------------------------------------------------------------------
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.07 }) => {
  const frame = useCurrentFrame();
  const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none", backgroundImage: noise, backgroundSize: "220px",
        backgroundPosition: `${(frame * 7) % 220}px ${(frame * 13) % 220}px`, opacity, mixBlendMode: "overlay",
      }}
    />
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.5 }) => (
  <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,${strength}) 100%)` }} />
);

export const Tint: React.FC<{ color: string; opacity: number }> = ({ color, opacity }) => (
  <AbsoluteFill style={{ pointerEvents: "none", backgroundColor: color, mixBlendMode: "soft-light", opacity }} />
);

/** Fine print: shown from the second beat until the CTA, only if the reel has one. */
export const useFineWindow = (data: ReelData) => {
  const cta = data.beats[data.beats.length - 1];
  const from = data.beats.length > 1 ? data.beats[1].t0 : 0.5;
  return { from, to: cta.t0 };
};
