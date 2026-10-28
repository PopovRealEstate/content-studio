import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

export const BgMesh: React.FC = () => {
  const frame = useCurrentFrame();
  const d1 = Math.sin(frame / 55) * 50;
  const d2 = Math.cos(frame / 70) * 40;
  return (
    <AbsoluteFill style={{ background: theme.colors.bg }}>
      <div
        style={{
          position: "absolute", width: 1400, height: 1400, borderRadius: "50%",
          top: -700, left: 260 + d1, filter: "blur(60px)",
          background: `radial-gradient(circle, ${theme.colors.primary}1c, transparent 60%)`,
        }}
      />
      <div
        style={{
          position: "absolute", width: 1100, height: 1100, borderRadius: "50%",
          bottom: -620, right: -260 - d2, filter: "blur(80px)",
          background: `radial-gradient(circle, ${theme.colors.accent}26, transparent 64%)`,
        }}
      />
      {/* Faint horizon line: a showroom floor edge */}
      <div
        style={{
          position: "absolute", left: 0, right: 0, top: 900, height: 1,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent)",
          transform: `translateX(${interpolate(frame, [0, 150], [0, -30])}px)`,
        }}
      />
    </AbsoluteFill>
  );
};

export const Grade: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <AbsoluteFill style={{ backgroundColor: theme.colors.primary, mixBlendMode: "soft-light", opacity: 0.2 }} />
    <AbsoluteFill
      style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.18), transparent 30%, transparent 70%, rgba(0,0,0,0.28))" }}
    />
  </AbsoluteFill>
);

export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none", backgroundImage: noise, backgroundSize: "220px",
        backgroundPosition: `${(frame * 7) % 220}px ${(frame * 13) % 220}px`,
        opacity: 0.07, mixBlendMode: "overlay",
      }}
    />
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{ pointerEvents: "none", background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)" }}
  />
);
