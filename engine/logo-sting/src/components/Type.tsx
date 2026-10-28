import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, theme } from "../theme";

// Letter-by-letter masked rise with a blur-to-sharp settle.
export const Wordmark: React.FC<{ size: number }> = ({ size }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(theme.t.wordmark * fps);
  return (
    <div style={{ display: "flex", overflow: "hidden", padding: "6px 0" }}>
      {theme.brand.wordmark.split("").map((ch, i) => {
        const p = spring({ frame: frame - start - i * 1.4, fps, config: theme.spring.snappy });
        return (
          <span
            key={i}
            style={{
              display: "inline-block", whiteSpace: "pre", fontFamily: theme.fonts.display, fontWeight: 700,
              fontSize: size, lineHeight: 1, letterSpacing: "0.06em", color: theme.colors.text,
              opacity: interpolate(p, [0, 0.5], [0, 1], clamp),
              transform: `translateY(${interpolate(p, [0, 1], [size * 0.9, 0])}px)`,
              filter: `blur(${interpolate(p, [0, 1], [6, 0])}px)`,
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
};

// Thin rule that grows from center; a spark of light runs along it at glint time.
export const Rule: React.FC<{ width: number; glintAt?: number }> = ({ width, glintAt = theme.t.glint }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(theme.t.rule * fps);
  const glintStart = Math.round(glintAt * fps) + 6;
  const grow = interpolate(frame, [start, start + Math.round(0.6 * fps)], [0, 1], { ...clamp, easing: theme.ease.out });
  const run = interpolate(frame, [glintStart, glintStart + Math.round(0.55 * fps)], [0, 1], { ...clamp, easing: theme.ease.inOut });
  const runOpacity = interpolate(run, [0, 0.15, 0.85, 1], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "relative", width, height: 1 }}>
      <div
        style={{
          position: "absolute", inset: 0, transform: `scaleX(${grow})`,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4) 20%, rgba(255,255,255,0.4) 80%, transparent)",
        }}
      />
      <div
        style={{
          position: "absolute", top: -2, height: 5, width: 90, left: run * (width - 90), borderRadius: 4,
          background: "radial-gradient(ellipse at center, #ffffff, rgba(255,255,255,0) 70%)", opacity: runOpacity,
        }}
      />
    </div>
  );
};

export const Sublabel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - Math.round(theme.t.sublabel * fps), fps, config: theme.spring.smooth });
  return (
    <div
      style={{
        fontFamily: theme.fonts.label, fontWeight: 600, fontSize: 22, whiteSpace: "pre",
        color: theme.colors.textDim, opacity: p,
        letterSpacing: `${interpolate(p, [0, 1], [0.6, 0.34])}em`,
        transform: `translateY(${interpolate(p, [0, 1], [18, 0])}px)`,
      }}
    >
      {theme.brand.sublabel}
    </div>
  );
};

// Default: the brand slogan, staggered 4 frames per word. With `words`, each word
// springs in 2 frames before its spoken onset (a visual landing slightly early reads
// as synced; late reads broken).
export const Slogan: React.FC<{ words?: readonly { text: string; at: number }[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(theme.t.slogan * fps);
  const items = words
    ? words.map((w) => ({ text: w.text, from: Math.round(w.at * fps) - 2 }))
    : theme.brand.slogan.split(" ").map((text, i) => ({ text, from: start + i * 4 }));
  return (
    <div style={{ display: "flex", gap: 13 }}>
      {items.map(({ text: word, from }, i) => {
        const p = spring({ frame: frame - from, fps, config: theme.spring.snappy });
        return (
          <span
            key={i}
            style={{
              display: "inline-block", fontFamily: theme.fonts.body, fontWeight: 400, fontSize: 40,
              color: theme.colors.textSoft, opacity: p,
              transform: `translateY(${interpolate(p, [0, 1], [26, 0])}px) scale(${interpolate(p, [0, 1], [0.96, 1])})`,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
