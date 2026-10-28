// Style A: Dark cinematic luxury (default look; edit the palette constants to restyle). #0c0c0d, gold #d2ad41, Barlow Semi Condensed, slow springs.
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { loadFont as loadDisplay } from "@remotion/google-fonts/BarlowSemiCondensed";
import { loadFont as loadLabel } from "@remotion/google-fonts/Barlow";
import {
  Beat, BRAND, Captions, clamp, enter, fit, Footage, Grain, ReelData, Rich, Sfx, Soundtrack, thin, Tint, useBeatWindow, useClock,
  useFineWindow, Vignette,
} from "../engine";

const display = loadDisplay("normal", { weights: ["300", "500", "600"], subsets: ["latin"] });
const label = loadLabel("normal", { weights: ["500", "600"], subsets: ["latin"] });

const L = {
  bg: "#0c0c0d", gold: "#d2ad41", white: "#ffffff", soft: "rgba(255,255,255,0.84)", dim: "rgba(255,255,255,0.6)",
  glass: "rgba(12,12,13,0.6)", hair: "rgba(210,173,65,0.5)", display: display.fontFamily, label: label.fontFamily,
  smooth: { damping: 20, stiffness: 90, mass: 1 }, snappy: { damping: 16, stiffness: 150, mass: 0.7 },
};
const gold = { color: L.gold };
const kicker: React.CSSProperties = { fontFamily: L.label, fontWeight: 600, fontSize: 30, letterSpacing: "0.32em", color: L.gold, textTransform: "uppercase", textAlign: "center" };
const shadow = "0 8px 30px rgba(0,0,0,0.6)";
const ZONE: React.CSSProperties = { position: "absolute", top: 350, left: 60, right: 60, height: 850, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 34 };

/** Wraps a beat: mounted only around its window, fades/lifts out before the next beat. */
const BeatFrame: React.FC<{ b: Beat; last: boolean; children: React.ReactNode }> = ({ b, last, children }) => {
  const { out } = useClock();
  const on = useBeatWindow(b);
  if (!on) return null;
  const exit = last ? 1 : out(b.t1 + 0.05, 0.3);
  return <AbsoluteFill style={{ opacity: exit, transform: `translateY(${(1 - exit) * -40}px)` }}>{children}</AbsoluteFill>;
};

const Hero: React.FC<{ b: Beat }> = ({ b }) => {
  const { sp, frame } = useClock();
  const k = sp(b.kickerAt ?? b.t0, L.smooth, 0);
  const g = sp(b.bigAt ?? b.t0, L.smooth);
  const s = sp(b.subAt ?? 1e9, L.smooth);
  const size = fit(b.big ?? "", 940, 0.46, 260, 84);
  return (
    <div style={ZONE}>
      {b.kicker && <div style={{ ...kicker, ...enter(k, 16, 0.96) }}>{b.kicker}</div>}
      <div style={{ fontFamily: L.display, fontWeight: 300, fontSize: size, lineHeight: 1.02, color: L.white, textAlign: "center", textShadow: shadow, ...enter(g, 40, 1.1, 14), translate: `0 ${Math.sin(frame / 22) * 3}px` }}>
        <Rich text={b.big ?? ""} accent={gold} />
      </div>
      {b.sub && <div style={{ fontFamily: L.display, fontWeight: 500, fontSize: fit(b.sub, 900, 0.45, 60, 40), color: L.soft, textAlign: "center", textShadow: shadow, ...enter(s, 24, 0.97, 6) }}>{b.sub}</div>}
    </div>
  );
};

const Glass: React.FC<{ p: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ p, children, style }) => (
  <div style={{ width: "100%", borderRadius: 30, background: L.glass, backdropFilter: "blur(14px)", border: `1.5px solid ${L.hair}`, boxShadow: "0 30px 70px rgba(0,0,0,0.45)", ...enter(p, 50, 0.95), ...style }}>
    {children}
  </div>
);

const Vs: React.FC<{ b: Beat }> = ({ b }) => {
  const { sp } = useClock();
  const k = sp(b.t0 + 0.1, L.smooth, 0);
  const sides = [b.left!, b.right!];
  return (
    <div style={ZONE}>
      {b.kicker && <div style={{ ...kicker, ...enter(k, 16, 0.96) }}>{b.kicker}</div>}
      {sides.map((sd, i) => {
        const p = sp(sd.at, L.smooth);
        return (
          <Glass key={i} p={p} style={{ padding: "40px 50px", textAlign: "center" }}>
            <div style={{ fontFamily: L.display, fontWeight: 500, fontSize: fit(sd.title, 860, 0.46, 96, 56), color: i ? L.gold : L.white, lineHeight: 1.05 }}>{sd.title}</div>
            {sd.body && <div style={{ marginTop: 14, fontFamily: L.label, fontWeight: 500, fontSize: 40, color: L.soft }}>{sd.body}</div>}
          </Glass>
        );
      })}
    </div>
  );
};

const Mark: React.FC<{ mode?: string; i: number; p: number }> = ({ mode, i, p }) => {
  const box: React.CSSProperties = { width: 74, height: 74, flex: "0 0 74px", borderRadius: "50%", border: `1.5px solid ${L.gold}`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${interpolate(p, [0, 1], [0.6, 1])})` };
  if (mode === "number" || mode === "stack") return <div style={{ ...box, fontFamily: L.display, fontWeight: 300, fontSize: 46, color: L.gold }}>{i + 1}</div>;
  const path = mode === "x" ? "M24 24 L50 50 M50 24 L24 50" : "M22 38 L33 49 L53 27";
  return (
    <div style={box}>
      <svg viewBox="0 0 74 74" width={74} height={74}><path d={path} fill="none" stroke={L.gold} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} /></svg>
    </div>
  );
};

const List: React.FC<{ b: Beat }> = ({ b }) => {
  const { sp } = useClock();
  const k = sp(b.t0 + 0.1, L.smooth, 0);
  const card = sp(b.t0 + 0.05, L.smooth, 0);
  const items = b.items ?? [];
  const size = items.length > 4 ? 50 : 58;
  return (
    <div style={ZONE}>
      {b.kicker && <div style={{ ...kicker, ...enter(k, 16, 0.96) }}>{b.kicker}</div>}
      <Glass p={card} style={{ padding: "34px 48px", display: "flex", flexDirection: "column", gap: items.length > 4 ? 22 : 30 }}>
        {items.map((it, i) => {
          const p = sp(it.at, L.snappy);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 30, ...enter(p, 20, 0.97), opacity: interpolate(p, [0, 0.4], [0.12, 1], clamp) }}>
              <Mark mode={b.mode} i={i} p={p} />
              <div style={{ fontFamily: L.display, fontWeight: 500, fontSize: size, color: L.white, lineHeight: 1.08 }}>{it.text}</div>
            </div>
          );
        })}
      </Glass>
    </div>
  );
};

const Quote: React.FC<{ b: Beat }> = ({ b }) => {
  const { sp } = useClock();
  return (
    <div style={ZONE}>
      {(b.pairs ?? []).map((q, i) => {
        const p = sp(q.at, L.smooth);
        return (
          <div key={i} style={{ textAlign: "center", ...enter(p, 30, 0.96, 8) }}>
            <div style={kicker}>{q.label}</div>
            <div style={{ marginTop: 12, fontFamily: L.display, fontWeight: 300, fontSize: fit(q.text, 940, 0.46, 110, 60), lineHeight: 1.05, color: L.white, textShadow: shadow }}>
              <Rich text={q.text} accent={gold} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Cta: React.FC<{ b: Beat }> = ({ b }) => {
  const { sp, ramp } = useClock();
  const h = sp(b.headAt ?? b.t0, L.smooth);
  const a = sp(b.actionAt ?? 1e9, L.snappy);
  const s = sp(b.subAt ?? b.t0, L.smooth, 0);
  const line = ramp((b.brandAt ?? b.t0) - 0.1, 0.6);
  const b1 = sp(b.brandAt ?? b.t0, L.smooth, 0);
  const b2 = sp((b.brandAt ?? b.t0) + 0.15, L.smooth, 0);
  const b3 = sp((b.brandAt ?? b.t0) + 0.3, L.smooth, 0);
  const headIsAction = !b.action;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 330, left: 60, right: 60, textAlign: "center" }}>
        <div style={{ fontFamily: L.display, fontWeight: headIsAction ? 600 : 300, fontSize: fit(b.head ?? "", 940, 0.46, 128, 80), color: headIsAction ? L.gold : L.white, textShadow: shadow, ...enter(h, 36, 1.06, 12) }}>{b.head}</div>
        {b.action && <div style={{ marginTop: 6, fontFamily: L.display, fontWeight: 600, fontSize: 116, color: L.gold, textShadow: shadow, ...enter(a, 30, 1.1, 10) }}>{b.action}</div>}
        {b.sub && <div style={{ marginTop: 14, fontFamily: L.display, fontWeight: 500, fontSize: fit(b.sub, 900, 0.44, 54, 38), color: L.soft, textShadow: shadow, ...enter(s, 20, 0.97) }}>{b.sub}</div>}
      </div>
      <div style={{ position: "absolute", top: 820, left: "50%", width: 420 * line, height: 2, background: L.gold, transform: "translateX(-50%)" }} />
      <div style={{ position: "absolute", top: 870, width: "100%", textAlign: "center" }}>
        <div style={{ fontFamily: L.display, fontWeight: 600, fontSize: 58, letterSpacing: "0.2em", color: L.white, ...enter(b1, 20, 0.96) }}>{BRAND.name}</div>
        <div style={{ marginTop: 16, fontFamily: L.display, fontWeight: 500, fontSize: 68, letterSpacing: "0.04em", color: L.white, ...enter(b2, 20, 0.96) }}>{BRAND.phone}</div>
        <div style={{ marginTop: 16, ...kicker, fontSize: 30, color: L.dim, ...enter(b3, 20, 0.96) }}>{BRAND.broker}</div>
      </div>
    </AbsoluteFill>
  );
};

const FinePrint: React.FC<{ data: ReelData }> = ({ data }) => {
  const { ramp, out, t } = useClock();
  const w = useFineWindow(data);
  if (!data.fine || t < w.from - 0.1 || t > w.to + 0.1) return null;
  return (
    <div style={{ position: "absolute", top: 1235, left: 70, right: 70, textAlign: "center", fontFamily: L.label, fontWeight: 500, fontSize: 26, color: L.dim, opacity: Math.min(ramp(w.from, 0.5), out(w.to, 0.3)) }}>
      {data.fine}
    </div>
  );
};

const sfxFor = (d: ReelData): Sfx[] => {
  const s: Sfx[] = [];
  d.beats.forEach((b, i) => {
    if (i === 0) s.push({ file: "hit", at: (b.bigAt ?? b.items?.[0]?.at ?? b.left?.at ?? b.pairs?.[0]?.at ?? 0.3) - 0.05, vol: 0.4 });
    else s.push({ file: "whoosh", at: b.t0 - 0.2, vol: 0.3 });
    b.items?.forEach((it) => s.push({ file: "pin", at: it.at - 0.04, vol: 0.26 }));
    if (b.type === "vs") [b.left!, b.right!].forEach((sd) => s.push({ file: "pin", at: sd.at - 0.04, vol: 0.28 }));
    if (b.type === "cta") s.push({ file: "hit", at: (b.brandAt ?? b.t0) - 0.15, vol: 0.32 });
  });
  return thin(s);
};

export const Luxury: React.FC<{ data: ReelData }> = ({ data }) => {
  const { ramp } = useClock();
  const endDim = ramp(data.speechEnd, 0.8);
  const n = data.beats.length;
  return (
    <AbsoluteFill style={{ background: L.bg }}>
      <Footage shots={data.shots} total={data.total} mode="cross" push={0.08} filter="brightness(0.8) saturate(0.92)" />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(12,12,13,0.7) 0%, rgba(12,12,13,0.32) 20%, rgba(12,12,13,0.32) 60%, rgba(12,12,13,0.8) 80%, rgba(12,12,13,0.92) 100%)" }} />
      <AbsoluteFill style={{ background: `rgba(12,12,13,${0.35 * endDim})` }} />
      {data.beats.map((b, i) => (
        <BeatFrame key={i} b={b} last={i === n - 1}>
          {b.type === "hero" && <Hero b={b} />}
          {b.type === "vs" && <Vs b={b} />}
          {b.type === "list" && <List b={b} />}
          {b.type === "quote" && <Quote b={b} />}
          {b.type === "cta" && <Cta b={b} />}
        </BeatFrame>
      ))}
      <FinePrint data={data} />
      <Captions caps={data.captions} look={{ top: 1320, font: L.display, weight: 600, size: 64, tracking: "0.04em", color: L.white, active: L.gold, shadow: "0 4px 18px rgba(0,0,0,0.85)", gap: "6px 18px" }} />
      <Tint color={L.gold} opacity={0.06} />
      <Grain opacity={0.07} />
      <Vignette strength={0.5} />
      <Soundtrack data={data} sfx={sfxFor(data)} />
    </AbsoluteFill>
  );
};
