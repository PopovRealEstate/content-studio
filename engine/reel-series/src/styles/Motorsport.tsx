// Style B: Motorsport livery. #0a0a0a, red #e10600, Barlow Condensed Italic 800, stripe wipes between beats,
// whip cuts + speed lines between shots, slams on every number, timing-tower lists.
import React from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadCond } from "@remotion/google-fonts/BarlowCondensed";
import { loadFont as loadBarlow } from "@remotion/google-fonts/Barlow";
import {
  Beat, BRAND, Captions, clamp, ease, enter, fit, Footage, Grain, ReelData, Rich, Sfx, Soundtrack, thin, Tint, useBeatWindow, useClock,
  useFineWindow, Vignette,
} from "../engine";

const cond = loadCond("italic", { weights: ["700", "800"], subsets: ["latin"] });
const label = loadBarlow("normal", { weights: ["600", "700"], subsets: ["latin"] });

const M = {
  bg: "#0a0a0a", red: "#e10600", white: "#ffffff", dim: "rgba(255,255,255,0.72)", display: cond.fontFamily, label: label.fontFamily,
  slam: { damping: 13, stiffness: 220, mass: 0.6 }, snappy: { damping: 14, stiffness: 160, mass: 0.6 },
};
const red = { color: M.red };
const big = (size: number, color = M.white): React.CSSProperties => ({
  fontFamily: M.display, fontStyle: "italic", fontWeight: 800, fontSize: size, lineHeight: 0.92, color, textAlign: "center",
  WebkitTextStroke: `${Math.max(3, size / 90)}px #000`, paintOrder: "stroke fill", textShadow: "0 10px 30px rgba(0,0,0,0.6)", textTransform: "uppercase",
});
const slam = (p: number): React.CSSProperties => ({
  opacity: interpolate(p, [0, 0.3], [0, 1], clamp),
  transform: `scale(${interpolate(p, [0, 1], [1.5, 1])}) translateY(${interpolate(p, [0, 1], [-30, 0])}px)`,
  filter: `blur(${interpolate(p, [0, 1], [10, 0], clamp)}px)`,
});
const ZONE: React.CSSProperties = { position: "absolute", top: 320, left: 50, right: 50, height: 900, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30 };

const Chip: React.FC<{ p: number; children: React.ReactNode; bg?: string; size?: number }> = ({ p, children, bg = M.red, size = 54 }) => (
  <div style={{ display: "inline-block", clipPath: `inset(-20px ${(1 - Math.min(1, p)) * 100}% -20px -20px)` }}>
    <div style={{ background: bg, padding: "8px 26px", transform: "skewX(-12deg)", boxShadow: "0 10px 26px rgba(0,0,0,0.45)" }}>
      <div style={{ transform: "skewX(12deg)", fontFamily: M.display, fontStyle: "italic", fontWeight: 800, fontSize: size, color: M.white, textTransform: "uppercase", whiteSpace: "nowrap" }}>{children}</div>
    </div>
  </div>
);

/** Black slab with a red leading edge, slides in from the left (or right). */
const Slab: React.FC<{ p: number; size?: number; children: React.ReactNode; fromRight?: boolean; edge?: string; bg?: string }> = ({ p, size = 88, children, fromRight, edge = M.red, bg = "#000" }) => (
  <div style={{ display: "flex", alignItems: "stretch", transform: `translateX(${interpolate(p, [0, 1], [fromRight ? 1300 : -1300, 0])}px) skewX(-12deg)`, boxShadow: "0 16px 40px rgba(0,0,0,0.55)", maxWidth: 1000 }}>
    <div style={{ width: 22, background: edge }} />
    <div style={{ background: bg, padding: "10px 38px 14px" }}>
      <div style={{ transform: "skewX(12deg)", ...big(size), WebkitTextStroke: "0px" }}>{children}</div>
    </div>
  </div>
);

const BeatFrame: React.FC<{ b: Beat; last: boolean; children: React.ReactNode }> = ({ b, last, children }) => {
  const { out } = useClock();
  if (!useBeatWindow(b, 0.1, 0.06)) return null;
  const exit = last ? 1 : out(b.t1 + 0.02, 0.18);
  return <AbsoluteFill style={{ opacity: exit }}>{children}</AbsoluteFill>;
};

const Hero: React.FC<{ b: Beat; first: boolean }> = ({ b, first }) => {
  const { sp, frame, f } = useClock();
  const k = sp(b.kickerAt ?? b.t0, M.snappy, 0);
  const g = sp(b.bigAt ?? b.t0, M.slam);
  const s = sp(b.subAt ?? 1e9, M.snappy);
  const size = fit(b.big ?? "", 960, 0.5, 300, 96);
  const shake = first && frame < f(b.bigAt ?? 0) + 8 ? Math.sin(frame * 3.1) * 6 * interpolate(g, [0.6, 1], [1, 0], clamp) : 0;
  return (
    <div style={ZONE}>
      {b.kicker && <Chip p={k}>{b.kicker}</Chip>}
      <div style={{ ...big(size), ...slam(g), translate: `${shake}px 0` }}><Rich text={b.big ?? ""} accent={red} /></div>
      {b.sub && <Slab p={s} size={fit(b.sub, 880, 0.48, 76, 44)}>{b.sub}</Slab>}
    </div>
  );
};

const Vs: React.FC<{ b: Beat }> = ({ b }) => {
  const { sp } = useClock();
  const k = sp(b.t0 + 0.08, M.snappy, 0);
  return (
    <div style={ZONE}>
      {b.kicker && <Chip p={k}>{b.kicker}</Chip>}
      {[b.left!, b.right!].map((sd, i) => {
        const p = sp(sd.at, M.snappy);
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <Slab p={p} size={fit(sd.title, 820, 0.5, 110, 60)} fromRight={i === 1} edge={i ? M.white : M.red} bg={i ? M.red : "#000"}>{sd.title}</Slab>
            {sd.body && <div style={{ ...big(54), WebkitTextStroke: "2px #000", ...enter(sp(sd.at + 0.15, M.snappy, 0), 14, 0.9) }}>{sd.body}</div>}
          </div>
        );
      })}
    </div>
  );
};

/** Timing-tower list: P1/P2... boxes (or check / X) with names sliding in on their cue. */
const List: React.FC<{ b: Beat }> = ({ b }) => {
  const { sp } = useClock();
  const k = sp(b.t0 + 0.08, M.snappy, 0);
  const items = b.items ?? [];
  const size = fit(items.reduce((a, it) => (it.text.length > a.length ? it.text : a), ""), 1250, 0.48, items.length > 4 ? 62 : 74, 48); // may wrap to 2 lines
  return (
    <div style={{ ...ZONE, alignItems: "stretch", gap: items.length > 4 ? 16 : 22 }}>
      {b.kicker && <div style={{ textAlign: "center" }}><Chip p={k}>{b.kicker}</Chip></div>}
      {items.map((it, i) => {
        const p = sp(it.at, M.snappy);
        const tag = b.mode === "x" ? "✕" : b.mode === "check" ? "✓" : `P${i + 1}`;
        return (
          <div key={i} style={{ display: "flex", alignItems: "stretch", transform: `translateX(${interpolate(p, [0, 1], [-1200, 0])}px) skewX(-10deg)`, boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}>
            <div style={{ width: 130, flex: "0 0 130px", background: b.mode === "x" ? "#000" : M.red, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ transform: "skewX(10deg)", ...big(62, b.mode === "x" ? M.red : M.white), WebkitTextStroke: "0px" }}>{tag}</div>
            </div>
            <div style={{ flex: 1, background: "rgba(0,0,0,0.82)", padding: "14px 30px", display: "flex", alignItems: "center" }}>
              <div style={{ transform: "skewX(10deg)", ...big(size), textAlign: "left", WebkitTextStroke: "0px", textDecoration: b.mode === "x" ? `line-through ${M.red} 6px` : "none" }}>{it.text}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Quote: React.FC<{ b: Beat }> = ({ b }) => {
  const { sp } = useClock();
  return (
    <div style={{ ...ZONE, gap: 60 }}>
      {(b.pairs ?? []).map((q, i) => {
        const p = sp(q.at, M.slam);
        const c = sp(q.at, M.snappy);
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            {q.label && <Chip p={c} bg={i % 2 ? M.red : "#000"}>{q.label}</Chip>}
            <div style={{ ...big(fit(q.text, 960, 0.5, 130, 64)), ...slam(p) }}><Rich text={q.text} accent={red} /></div>
          </div>
        );
      })}
    </div>
  );
};

const Cta: React.FC<{ b: Beat }> = ({ b }) => {
  const { sp } = useClock();
  const h = sp(b.headAt ?? b.t0, M.slam);
  const a = sp(b.actionAt ?? 1e9, M.snappy);
  const s = sp(b.subAt ?? b.t0, M.snappy, 0);
  const b1 = sp(b.brandAt ?? b.t0, M.snappy, 0);
  const b2 = sp((b.brandAt ?? b.t0) + 0.15, M.snappy, 0);
  const b3 = sp((b.brandAt ?? b.t0) + 0.3, M.snappy, 0);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 320, left: 50, right: 50, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <div style={{ ...big(fit(b.head ?? "", 960, 0.5, 150, 90), b.action ? M.white : M.red), ...slam(h) }}>{b.head}</div>
        {b.action && <Slab p={a} size={120}>{b.action.split(" ").slice(0, -1).join(" ")} <span style={red}>{b.action.split(" ").slice(-1)}</span></Slab>}
        {b.sub && <div style={{ ...big(fit(b.sub, 940, 0.48, 60, 40)), WebkitTextStroke: "2px #000", ...enter(s, 16, 0.92) }}>{b.sub}</div>}
      </div>
      <div style={{ position: "absolute", top: 860, width: "100%", textAlign: "center" }}>
        <div style={{ ...big(76), ...enter(b1, 20, 0.9) }}>{BRAND.name}</div>
        <div style={{ margin: "16px auto", width: 260 * b1, height: 8, background: M.red }} />
        <div style={{ ...big(84), ...enter(b2, 20, 0.9) }}>{BRAND.phone}</div>
        <div style={{ marginTop: 16, fontFamily: M.label, fontWeight: 700, fontSize: 32, letterSpacing: "0.3em", color: M.dim, ...enter(b3, 20, 0.9) }}>{BRAND.broker}</div>
      </div>
    </AbsoluteFill>
  );
};

const BgLivery: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: M.bg, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "repeating-linear-gradient(-58deg, rgba(225,6,0,0.07) 0 26px, transparent 26px 160px)", backgroundPosition: `${(frame * 1.2) % 160}px 0` }} />
    </AbsoluteFill>
  );
};

const StripeWipe: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = Math.round(0.5 * fps);
  const bands = [M.red, "#0a0a0a", M.white, M.red];
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {bands.map((c, i) => {
        const p = interpolate(frame, [i * 1.5, dur - (3 - i) * 1.5], [0, 1], { ...clamp, easing: ease.inOut });
        return <div key={i} style={{ position: "absolute", top: -600, left: 0, width: 520 - i * 60, height: 3200, background: c, transform: `translateX(${interpolate(p, [0, 1], [-2400, 2400]) + i * 150}px) rotate(28deg)` }} />;
      })}
    </AbsoluteFill>
  );
};

const SpeedBurst: React.FC = () => {
  const frame = useCurrentFrame();
  const lines = [180, 420, 610, 890, 1130, 1370, 1560];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {lines.map((y, i) => {
        const p = interpolate(frame, [i % 3, 7 + (i % 3)], [0, 1], { ...clamp, easing: ease.out });
        return <div key={i} style={{ position: "absolute", top: y, left: interpolate(p, [0, 1], [1080, -900]), width: 700 + (i % 3) * 120, height: i % 2 ? 4 : 8, background: i % 3 === 0 ? M.red : "rgba(255,255,255,0.85)", opacity: 1 - p * 0.6 }} />;
      })}
    </AbsoluteFill>
  );
};

const FinePrint: React.FC<{ data: ReelData }> = ({ data }) => {
  const { ramp, out, t } = useClock();
  const w = useFineWindow(data);
  if (!data.fine || t < w.from - 0.1 || t > w.to + 0.1) return null;
  return (
    <div style={{ position: "absolute", top: 1236, width: "100%", textAlign: "center", opacity: Math.min(ramp(w.from, 0.4), out(w.to, 0.2)) }}>
      <span style={{ background: "rgba(0,0,0,0.72)", padding: "6px 16px", fontFamily: M.label, fontWeight: 600, fontSize: 25, color: M.dim }}>{data.fine}</span>
    </div>
  );
};

export const Motorsport: React.FC<{ data: ReelData }> = ({ data }) => {
  const { f, ramp } = useClock();
  const endDim = ramp(data.speechEnd, 0.8);
  const n = data.beats.length;
  const wipes = data.beats.slice(1).map((b) => b.t0);
  const whips = data.shots.slice(1).map((s) => s.at).filter((a) => !wipes.some((w) => Math.abs(w - a) < 0.1));
  const sfx: Sfx[] = [];
  data.beats.forEach((b, i) => {
    const firstCue = b.bigAt ?? b.items?.[0]?.at ?? b.left?.at ?? b.pairs?.[0]?.at ?? 0.3;
    if (i === 0) sfx.push({ file: "hit", at: firstCue - 0.05, vol: 0.45 });
    else if (b.type === "hero") sfx.push({ file: "pin", at: (b.bigAt ?? b.t0) - 0.04, vol: 0.36 });
    b.items?.forEach((it) => sfx.push({ file: "pin", at: it.at - 0.04, vol: 0.34 }));
    if (b.type === "vs") [b.left!, b.right!].forEach((sd) => sfx.push({ file: "pin", at: sd.at - 0.04, vol: 0.36 }));
    b.pairs?.forEach((q) => sfx.push({ file: "pin", at: q.at - 0.04, vol: 0.34 }));
    if (b.type === "cta") sfx.push({ file: "hit", at: (b.actionAt ?? b.headAt ?? b.t0) - 0.05, vol: 0.36 });
  });
  wipes.forEach((a) => sfx.push({ file: "whoosh", at: a - 0.27, vol: 0.44 }));
  whips.forEach((a) => sfx.push({ file: "whip", at: a - 0.1, vol: 0.4 }));
  return (
    <AbsoluteFill>
      <BgLivery />
      <Footage shots={data.shots} total={data.total} mode="whip" push={0.1} filter="brightness(0.78) contrast(1.08) saturate(1.05)" />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.25) 30%, rgba(0,0,0,0.22) 52%, rgba(0,0,0,0.58) 70%, rgba(0,0,0,0.82) 100%)" }} />
      <AbsoluteFill style={{ background: `rgba(0,0,0,${0.3 * endDim})` }} />
      {data.beats.map((b, i) => (
        <BeatFrame key={i} b={b} last={i === n - 1}>
          {b.type === "hero" && <Hero b={b} first={i === 0} />}
          {b.type === "vs" && <Vs b={b} />}
          {b.type === "list" && <List b={b} />}
          {b.type === "quote" && <Quote b={b} />}
          {b.type === "cta" && <Cta b={b} />}
        </BeatFrame>
      ))}
      <FinePrint data={data} />
      <Captions caps={data.captions} look={{ top: 1320, font: M.display, weight: 800, size: 86, italic: true, color: M.white, active: M.red, stroke: "3px #000", shadow: "0 6px 18px rgba(0,0,0,0.65)", gap: "4px 20px" }} />
      {whips.map((a, i) => <Sequence key={`w${i}`} from={f(a)} durationInFrames={10} layout="none"><SpeedBurst /></Sequence>)}
      {wipes.map((a, i) => <Sequence key={`s${i}`} from={Math.max(0, f(a) - 8)} durationInFrames={16} layout="none"><StripeWipe /></Sequence>)}
      <Tint color={M.red} opacity={0.08} />
      <Grain opacity={0.08} />
      <Vignette strength={0.5} />
      <Soundtrack data={data} sfx={thin(sfx)} />
    </AbsoluteFill>
  );
};
