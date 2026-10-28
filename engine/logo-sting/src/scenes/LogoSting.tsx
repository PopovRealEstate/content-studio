import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, theme } from "../theme";
import { BgMesh, Grade, Grain, Vignette } from "../components/Layers";
import { Headlights } from "../components/Headlights";
import { Mark } from "../components/Mark";
import { Rule, Slogan, Sublabel, Wordmark } from "../components/Type";

const MARK = 200;
const MARK_TOP = 280;

const Sfx: React.FC<{ vo: boolean; glint: number; exit: number }> = ({ vo, glint, exit }) => {
  const { fps } = useVideoConfig();
  const at = (sec: number) => Math.max(0, Math.round(sec * fps));
  // Duck the pad under the voice: 0.22 -> 0.08 over 0.2s around the VO window.
  const padVolume = (f: number) =>
    vo
      ? interpolate(
          f,
          [at(theme.vo.start - 0.2), at(theme.vo.start), at(theme.vo.end), at(theme.vo.end + 0.4)],
          [0.22, 0.08, 0.08, 0.2],
          { ...clamp, easing: theme.ease.inOut },
        )
      : 0.22;
  return (
    <>
      <Audio src={staticFile("sfx/pad.wav")} volume={padVolume} />
      <Sequence from={at(theme.t.flare - 0.26)}>
        <Audio src={staticFile("sfx/whoosh.wav")} volume={0.55} />
      </Sequence>
      <Sequence from={at(theme.t.markLetters + 0.08)}>
        <Audio src={staticFile("sfx/impact.wav")} volume={0.9} />
      </Sequence>
      <Sequence from={at(theme.t.wordmark - 0.12)}>
        <Audio src={staticFile("sfx/whoosh.wav")} volume={vo ? 0.14 : 0.28} />
      </Sequence>
      <Sequence from={at(glint - 0.05)}>
        <Audio src={staticFile("sfx/shimmer.wav")} volume={0.32} />
      </Sequence>
      <Sequence from={at(exit - 0.2)}>
        <Audio src={staticFile("sfx/whoosh.wav")} volume={0.2} />
      </Sequence>
      {vo && (
        <Sequence from={at(theme.vo.start)}>
          <Audio src={staticFile("vo/line.wav")} volume={1} />
        </Sequence>
      )}
    </>
  );
};

export const LogoSting: React.FC<{ vo?: boolean }> = ({ vo = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const glint = vo ? theme.vo.glint : theme.t.glint;
  const exit = vo ? theme.vo.exit : theme.t.exit;

  const exitStart = Math.round(exit * fps);
  const exitEnd = exitStart + Math.round(0.45 * fps);
  const exitP = interpolate(frame, [exitStart, exitEnd], [0, 1], { ...clamp, easing: theme.ease.exit });

  const idleIn = interpolate(frame, [Math.round(2 * fps), Math.round(2.6 * fps)], [0, 1], clamp);
  const float = Math.sin(frame / 30) * 3 * idleIn;
  const drift = interpolate(frame, [0, exitStart], [0.985, 1.0], { ...clamp, easing: theme.ease.inOut });

  return (
    <AbsoluteFill>
      <BgMesh />
      <AbsoluteFill
        style={{
          opacity: 1 - exitP,
          transform: `translateY(${float - exitP * 26}px) scale(${drift - exitP * 0.03})`,
          filter: `blur(${exitP * 6}px)`,
        }}
      >
        <Headlights cy={MARK_TOP + MARK / 2} spread={250} />
        <div
          style={{
            position: "absolute", top: MARK_TOP, left: 0, right: 0,
            display: "flex", flexDirection: "column", alignItems: "center",
          }}
        >
          <Mark size={MARK} />
          <div style={{ height: 44 }} />
          <Wordmark size={100} />
          <div style={{ height: 26 }} />
          <Rule width={560} glintAt={glint} />
          <div style={{ height: 30 }} />
          <Sublabel />
          <div style={{ height: 34 }} />
          <Slogan words={vo ? theme.vo.words : undefined} />
        </div>
      </AbsoluteFill>
      <Grade />
      <Grain />
      <Vignette />
      <Sfx vo={vo} glint={glint} exit={exit} />
    </AbsoluteFill>
  );
};
