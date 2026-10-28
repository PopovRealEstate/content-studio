import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, theme } from "../theme";

// Two headlights click on in the dark, bloom into an anamorphic flare, then settle
// to a faint residue behind the mark. Positioned on the mark's centerline.
export const Headlights: React.FC<{ cy: number; spread: number }> = ({ cy, spread }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const on = Math.round(theme.t.lightsOn * fps);
  const flare = Math.round(theme.t.flare * fps);

  const pop = spring({ frame: frame - on, fps, config: theme.spring.snappy });
  // Intensity: rises to the flare peak, decays to a low residue.
  const rise = interpolate(frame, [on, flare], [0.35, 1], { ...clamp, easing: theme.ease.out });
  const decay = interpolate(frame, [flare, flare + Math.round(0.9 * fps)], [1, 0.12], { ...clamp, easing: theme.ease.out });
  const intensity = pop * (frame < flare ? rise : decay);
  // Lamps fully go out once the mark has landed; only a faint streak stays as a horizon.
  const lampsOut = interpolate(frame, [flare + Math.round(0.5 * fps), flare + Math.round(1.1 * fps)], [1, 0], { ...clamp, easing: theme.ease.inOut });
  const lamp = intensity * lampsOut;
  const streak = interpolate(frame, [on + 2, flare + 4], [0, 1], { ...clamp, easing: theme.ease.out });
  // The two lamps slide inward toward the mark as they fade.
  const converge = interpolate(frame, [flare, flare + Math.round(0.8 * fps)], [1, 0.55], { ...clamp, easing: theme.ease.inOut });

  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen" }}>
      {[-1, 1].map((side, i) => {
        const x = 960 + side * spread * converge;
        return (
          <React.Fragment key={i}>
            {/* bloom */}
            <div
              style={{
                position: "absolute", left: x - 260, top: cy - 260, width: 520, height: 520, borderRadius: "50%",
                background: `radial-gradient(circle, ${theme.colors.light}cc 0%, ${theme.colors.light}33 18%, transparent 60%)`,
                opacity: lamp, transform: `scale(${interpolate(pop, [0, 1], [0.3, 1])})`,
              }}
            />
            {/* hot core */}
            <div
              style={{
                position: "absolute", left: x - 22, top: cy - 22, width: 44, height: 44, borderRadius: "50%",
                background: "radial-gradient(circle, #ffffff 0%, #ffffffaa 45%, transparent 72%)",
                opacity: Math.min(1, lamp * 1.4), transform: `scale(${interpolate(pop, [0, 1], [0.2, 1])})`,
              }}
            />
          </React.Fragment>
        );
      })}
      {/* anamorphic streak across the frame */}
      <div
        style={{
          position: "absolute", left: 0, width: 1920, top: cy - 3, height: 6,
          background: `linear-gradient(90deg, transparent, #bcd4ff66 20%, #ffffffdd 50%, #bcd4ff66 80%, transparent)`,
          filter: "blur(2px)", opacity: intensity * 0.9, transform: `scaleX(${streak})`,
        }}
      />
      <div
        style={{
          position: "absolute", left: 160, width: 1600, top: cy - 40, height: 80,
          background: "radial-gradient(ellipse at center, #9fbfff33, transparent 70%)",
          opacity: intensity, transform: `scaleX(${streak})`,
        }}
      />
    </AbsoluteFill>
  );
};
