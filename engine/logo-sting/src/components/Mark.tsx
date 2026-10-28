import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, theme } from "../theme";

// The site's logo mark: a gold-outlined square holding the two-letter monogram from theme.ts.
export const Mark: React.FC<{ size: number }> = ({ size }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drawStart = Math.round(theme.t.markDraw * fps);
  const lettersStart = Math.round(theme.t.markLetters * fps);
  const glintStart = Math.round(theme.t.glint * fps);

  const stroke = 3;
  const perimeter = 4 * (size - stroke);
  const draw = interpolate(frame, [drawStart, drawStart + Math.round(0.75 * fps)], [0, 1], { ...clamp, easing: theme.ease.out });

  const container = spring({ frame: frame - drawStart, fps, config: theme.spring.smooth });
  const breathe = 1 + Math.sin(frame / 22) * 0.012 * interpolate(frame, [lettersStart + 20, lettersStart + 40], [0, 1], clamp);
  const glowPulse = 0.75 + Math.sin(frame / 18) * 0.25;
  const settled = interpolate(frame, [lettersStart, lettersStart + 15], [0, 1], clamp);

  const glint = interpolate(frame, [glintStart, glintStart + Math.round(0.6 * fps)], [-1.2, 1.2], { ...clamp, easing: theme.ease.inOut });
  const glintOn = frame >= glintStart && frame <= glintStart + Math.round(0.6 * fps);

  return (
    <div
      style={{
        position: "relative", width: size, height: size,
        opacity: container,
        transform: `scale(${interpolate(container, [0, 1], [0.86, 1]) * breathe}) rotate(${interpolate(container, [0, 1], [-6, 0])}deg)`,
        filter: `drop-shadow(0 0 ${28 * settled * glowPulse}px ${theme.colors.glow})`,
      }}
    >
      <svg width={size} height={size} style={{ position: "absolute", inset: 0 }}>
        <rect
          x={stroke / 2} y={stroke / 2} width={size - stroke} height={size - stroke}
          fill="none" stroke={theme.colors.primary} strokeWidth={stroke} strokeOpacity={0.85}
          strokeDasharray={perimeter} strokeDashoffset={perimeter * (1 - draw)}
        />
      </svg>
      <div
        style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {theme.brand.monogram.map((ch, i) => {
          const p = spring({ frame: frame - lettersStart - i * 4, fps, config: theme.spring.bouncy });
          return (
            <span
              key={ch}
              style={{
                display: "inline-block", fontFamily: theme.fonts.display, fontWeight: 700,
                fontSize: size * 0.54, lineHeight: 1, letterSpacing: "-0.01em", color: theme.colors.primary,
                opacity: interpolate(p, [0, 0.4], [0, 1], clamp),
                transform: `translateY(${interpolate(p, [0, 1], [size * 0.35, 0])}px) scale(${interpolate(p, [0, 1], [0.7, 1])})`,
              }}
            >
              {ch}
            </span>
          );
        })}
        {glintOn && (
          <div
            style={{
              position: "absolute", top: -size * 0.5, left: 0, width: size * 0.38, height: size * 2,
              background: "linear-gradient(90deg, transparent, rgba(255,250,235,0.55), transparent)",
              transform: `translateX(${glint * size}px) rotate(24deg)`, mixBlendMode: "screen",
            }}
          />
        )}
      </div>
    </div>
  );
};
