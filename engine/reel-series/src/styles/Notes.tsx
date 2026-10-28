// Style C: Notes-app explainer. Blurred B-roll behind an iPhone-Notes-style card; the note is written as the voice
// speaks (typed title, highlighted key phrases, checklist circles that fill on their cue), scrolling as it grows.
// Paper #fbfaf6, ink #1c1c1e, Notes yellow #e5a900, highlight #ffd60a, Inter.
import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { Beat, BRAND, Captions, clamp, enter, Footage, Grain, plain, ReelData, Sfx, Soundtrack, thin, useClock, Vignette } from "../engine";

const inter = loadInter("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin"] });

const N = {
  paper: "#fbfaf6", ink: "#1c1c1e", gray: "#8e8e93", rule: "rgba(60,60,67,0.14)", yellow: "#e5a900", hl: "rgba(255,214,10,0.62)",
  font: inter.fontFamily, soft: { damping: 18, stiffness: 120, mass: 0.8 }, pop: { damping: 11, stiffness: 200, mass: 0.6 },
};
const CARD = { top: 250, h: 1000, padX: 56, head: 96, foot: 70 };
const TEXT_W = 1080 - 2 * 54 - 2 * CARD.padX; // text column width inside the card

/** Estimated rendered height of a text block (Inter; conservative so blocks never overlap). */
const textH = (s: string, size: number, weight: number, indent = 0, lh = 1.22) => {
  const cw = size * (weight >= 700 ? 0.56 : 0.52);
  const perLine = Math.max(8, Math.floor((TEXT_W - indent) / cw));
  const lines = plain(s).split("\n").reduce((a, l) => a + Math.max(1, Math.ceil(l.length / perLine)), 0);
  return lines * size * lh;
};

const Typed: React.FC<{ text: string; sec: number; cps?: number }> = ({ text, sec, cps = 28 }) => {
  const { t, frame } = useClock();
  const n = Math.max(0, Math.min(text.length, Math.floor((t - sec) * cps)));
  const typing = t >= sec && n < text.length;
  const caretOn = typing || (t >= sec && t < sec + text.length / cps + 0.6 && Math.floor(frame / 8) % 2 === 0);
  return (
    <>
      {text.slice(0, n)}
      {caretOn && <span style={{ display: "inline-block", width: 4, height: "0.95em", background: N.yellow, marginLeft: 3, verticalAlign: "-0.12em" }} />}
    </>
  );
};

/** Marker highlight that swipes in behind text at `sec`. */
const Mark: React.FC<{ sec: number; children: React.ReactNode }> = ({ sec, children }) => {
  const { ramp } = useClock();
  const p = ramp(sec - 0.05, 0.28);
  return (
    <span style={{ backgroundImage: `linear-gradient(${N.hl}, ${N.hl})`, backgroundRepeat: "no-repeat", backgroundSize: `${p * 100}% 78%`, backgroundPosition: "0 70%", padding: "0 4px", margin: "0 -4px", borderRadius: 6, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
      {children}
    </span>
  );
};

/** "*accent*" -> highlighted at `sec`. */
const RichMark: React.FC<{ text: string; sec: number }> = ({ text, sec }) => (
  <>
    {text.split(/(\*[^*]+\*)/).map((part, i) =>
      part.startsWith("*") && part.endsWith("*") ? <Mark key={i} sec={sec}>{part.slice(1, -1)}</Mark> : <React.Fragment key={i}>{part.replace(/\n/g, " ")}</React.Fragment>,
    )}
  </>
);

const Bullet: React.FC<{ mode?: string; i: number; sec: number }> = ({ mode, i, sec }) => {
  const { sp, ramp } = useClock();
  const p = sp(sec, N.pop);
  const draw = ramp(sec + 0.05, 0.22);
  const box: React.CSSProperties = { position: "relative", width: 50, height: 50, flex: "0 0 50px", marginTop: 2 };
  if (mode === "number" || mode === "stack")
    return (
      <div style={{ ...box, borderRadius: 14, background: interpolate(p, [0, 1], [0, 1], clamp) > 0.5 ? N.yellow : "transparent", border: `3px solid ${p > 0.5 ? N.yellow : N.gray}`, color: p > 0.5 ? "#fff" : N.gray, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800, transform: `scale(${interpolate(p, [0, 0.5, 1], [1, 1.15, 1], clamp)})` }}>
        {i + 1}
      </div>
    );
  const path = mode === "x" ? "M16 16 L34 34 M34 16 L16 34" : "M14 26 L22 34 L37 17";
  return (
    <div style={box}>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `3px solid ${N.gray}`, opacity: 1 - Math.min(1, p) }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: mode === "x" ? "#ff453a" : N.yellow, transform: `scale(${p})` }} />
      <svg viewBox="0 0 50 50" style={{ position: "absolute", inset: 0 }}>
        <path d={path} fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
      </svg>
    </div>
  );
};

// ---- note layout: every beat (except the CTA) becomes blocks with an estimated y and an appear time ----
type Block = { at: number; y: number; h: number; node: React.ReactNode };

const layout = (beats: Beat[]): Block[] => {
  const out: Block[] = [];
  let y = 0;
  const add = (at: number, h: number, node: React.ReactNode, gapBefore = 0) => {
    y += gapBefore; out.push({ at, y, h, node }); y += h;
  };
  beats.forEach((b, bi) => {
    const gap = bi === 0 ? 8 : 34;
    if (b.type === "hero") {
      if (b.kicker) { add(b.kickerAt ?? b.t0, 40, <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "0.12em", color: N.gray, textTransform: "uppercase" }}>{b.kicker}</div>, gap); }
      const size = 56;
      add(b.bigAt ?? b.t0, textH(b.big ?? "", size, 800), <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.22, color: N.ink }}><RichMark text={b.big ?? ""} sec={(b.bigAt ?? b.t0) + 0.15} /></div>, b.kicker ? 6 : gap);
      if (b.sub) add(b.subAt ?? b.t0, textH(b.sub, 44, 500), <div style={{ fontSize: 44, fontWeight: 500, lineHeight: 1.22, color: "#3a3a3c" }}>{b.sub}</div>, 10);
    } else if (b.type === "list") {
      if (b.kicker) add(b.t0 + 0.1, 62, <div style={{ fontSize: 46, fontWeight: 800, color: N.ink }}>{b.kicker}</div>, gap);
      (b.items ?? []).forEach((it, i) => {
        const h = Math.max(54, textH(it.text, 46, 500, 72, 1.2));
        add(it.at - 0.15, h, (
          <div style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
            <Bullet mode={b.mode} i={i} sec={it.at + 0.2} />
            <div style={{ fontSize: 46, lineHeight: 1.2, fontWeight: 500, color: N.ink, textDecoration: b.mode === "x" ? "line-through rgba(255,69,58,0.8) 4px" : "none" }}>{it.text}</div>
          </div>
        ), i === 0 && !b.kicker ? gap : 20);
      });
    } else if (b.type === "vs") {
      if (b.kicker) add(b.t0 + 0.1, 40, <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "0.12em", color: N.gray, textTransform: "uppercase" }}>{b.kicker}</div>, gap);
      [b.left!, b.right!].forEach((sd, i) => {
        const txt = `${sd.title}${sd.body ? ": " + sd.body : ""}`;
        add(sd.at, textH(txt, 48, 600), <div style={{ fontSize: 48, fontWeight: 500, lineHeight: 1.22, color: N.ink }}><Mark sec={sd.at + 0.1}><b style={{ fontWeight: 800 }}>{sd.title}</b></Mark>{sd.body ? `: ${sd.body}` : ""}</div>, i === 0 && !b.kicker ? gap : 16);
      });
    } else if (b.type === "quote") {
      (b.pairs ?? []).forEach((q, i) => {
        if (q.label) add(q.at, 40, <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "0.12em", color: N.gray, textTransform: "uppercase" }}>{q.label}</div>, i === 0 ? gap : 20);
        add(q.at, textH(`"${q.text}"`, 52, 800), <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.22, color: N.ink }}>"<RichMark text={q.text} sec={q.at + 0.2} />"</div>, 4);
      });
    }
  });
  return out;
};

const NoteChrome: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "30px 44px 0", color: N.yellow, fontSize: 36, fontWeight: 500 }}>
      <span><span style={{ fontSize: 44, fontWeight: 400, marginRight: 8 }}>‹</span>Notes</span>
      <span style={{ fontWeight: 600 }}>Done</span>
    </div>
    {children}
  </>
);

const NoteOne: React.FC<{ data: ReelData }> = ({ data }) => {
  const { t, ramp } = useClock();
  const body = data.beats.slice(0, -1);
  const blocks = layout(body);
  const titleH = textH(data.note, 70, 800) + 26;
  const viewH = CARD.h - CARD.head - CARD.foot - titleH - 52; // keeps the newest line clear of the fine print
  // scroll so the newest appeared block stays in view (smooth, monotonic)
  const scroll = blocks.reduce((acc, bl) => Math.max(acc, ramp(bl.at - 0.2, 0.45) * Math.max(0, bl.y + bl.h - viewH)), 0);
  return (
    <NoteChrome>
      <div style={{ padding: `14px ${CARD.padX}px 0`, fontSize: 70, fontWeight: 800, lineHeight: 1.18, color: N.ink, letterSpacing: "-0.01em", height: titleH, boxSizing: "border-box" }}>
        <Typed text={data.note} sec={0.15} cps={32} />
      </div>
      <div style={{ position: "absolute", top: CARD.head + titleH, left: CARD.padX, right: CARD.padX, height: viewH + 30, overflow: "hidden", maskImage: "linear-gradient(180deg, transparent 0, #000 22px, #000 100%)" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 22, transform: `translateY(${-scroll}px)` }}>
          {blocks.map((bl, i) => {
            if (t < bl.at - 0.25) return null;
            const p = ramp(bl.at - 0.1, 0.35);
            return <div key={i} style={{ position: "absolute", top: bl.y, left: 0, right: 0, ...enter(p, 16, 0.99) }}>{bl.node}</div>;
          })}
        </div>
      </div>
    </NoteChrome>
  );
};

const NoteCta: React.FC<{ b: Beat }> = ({ b }) => {
  const { sp, t } = useClock();
  const s = sp(b.subAt ?? b.t0, N.soft, 0);
  const sig = sp(b.brandAt ?? b.t0, N.soft, 0);
  return (
    <NoteChrome>
      <div style={{ padding: `18px ${CARD.padX}px 0` }}>
        <div style={{ fontSize: 76, fontWeight: 800, color: N.ink, minHeight: 92 }}><Typed text={b.head ?? ""} sec={(b.headAt ?? b.t0) - 0.05} cps={24} /></div>
        {b.action && t >= (b.actionAt ?? 0) - 0.2 && (
          <div style={{ fontSize: 58, fontWeight: 800, color: N.ink, marginTop: 14, ...enter(sp(b.actionAt ?? 0, N.soft), 16, 0.98) }}><Mark sec={(b.actionAt ?? 0) + 0.05}>{b.action}</Mark></div>
        )}
        {b.sub && <div style={{ fontSize: 48, fontWeight: 500, lineHeight: 1.25, color: "#3a3a3c", marginTop: 18, ...enter(s, 16, 0.98) }}>{b.sub}</div>}
        <div style={{ height: 2, background: N.rule, margin: "40px 0 32px", opacity: sig }} />
        <div style={{ display: "flex", gap: 30, alignItems: "center", ...enter(sig, 20, 0.97) }}>
          <div style={{ width: 132, height: 132, borderRadius: "50%", background: N.yellow, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 132px" }}>
            <svg viewBox="0 0 64 64" width={72} height={72}>
              <path d="M8 30 L32 10 L56 30 M14 26 V54 H50 V26" fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
              <path d="M26 54 V40 H38 V54" fill="none" stroke="#fff" strokeWidth={5} strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 46, fontWeight: 800, color: N.ink }}>{BRAND.name}</div>
            <div style={{ fontSize: 46, fontWeight: 600, color: N.yellow, marginTop: 6 }}>{BRAND.phone}</div>
            <div style={{ fontSize: 32, fontWeight: 500, color: N.gray, marginTop: 6 }}>{BRAND.broker}</div>
          </div>
        </div>
      </div>
    </NoteChrome>
  );
};

const Card: React.FC<{ data: ReelData }> = ({ data }) => {
  const { sp, out, frame, t, f, ramp } = useClock();
  const cta = data.beats[data.beats.length - 1];
  const inP = sp(0.02, N.soft, 0);
  const a = out(cta.t0 + 0.02, 0.25);
  const b = sp(cta.t0, N.soft, 0);
  const fineOn = data.fine && t < cta.t0;
  return (
    <div
      style={{
        position: "absolute", left: 54, right: 54, top: CARD.top, height: CARD.h, borderRadius: 52, background: N.paper, overflow: "hidden",
        boxShadow: "0 40px 90px rgba(0,0,0,0.5), 0 2px 0 rgba(255,255,255,0.6) inset", fontFamily: N.font,
        ...enter(inP, 80, 0.95), translate: `0 ${Math.sin(frame / 26) * 3}px`,
      }}
    >
      {frame < f(cta.t0) + 9 && (
        <div style={{ position: "absolute", inset: 0, opacity: a, transform: `translateX(${(1 - a) * -120}px)` }}>
          <NoteOne data={data} />
          {fineOn && <div style={{ position: "absolute", left: CARD.padX, right: CARD.padX, bottom: 28, fontSize: 25, color: N.gray, background: N.paper, paddingTop: 8, opacity: ramp(data.beats[Math.min(1, data.beats.length - 1)].t0, 0.5) }}>{data.fine}</div>}
        </div>
      )}
      {t >= cta.t0 - 0.1 && (
        <div style={{ position: "absolute", inset: 0, opacity: interpolate(b, [0, 0.5], [0, 1], clamp), transform: `translateX(${interpolate(b, [0, 1], [140, 0])}px)` }}>
          <NoteCta b={cta} />
        </div>
      )}
    </div>
  );
};

const sfxFor = (d: ReelData): Sfx[] => {
  const s: Sfx[] = [{ file: "pin", at: 0.05, vol: 0.28 }];
  d.beats.forEach((b, i) => {
    if (b.type === "hero") s.push({ file: i === 0 ? "hit" : "whip", at: (b.bigAt ?? b.t0) + (i === 0 ? -0.05 : 0.1), vol: i === 0 ? 0.34 : 0.22 });
    b.items?.forEach((it) => s.push({ file: "tick", at: it.at + 0.17, vol: 0.36 }));
    if (b.type === "vs") [b.left!, b.right!].forEach((sd) => s.push({ file: "whip", at: sd.at + 0.05, vol: 0.22 }));
    b.pairs?.forEach((q) => s.push({ file: "tick", at: q.at - 0.03, vol: 0.3 }));
    if (b.type === "cta") { s.push({ file: "whoosh", at: b.t0 - 0.2, vol: 0.3 }); s.push({ file: "hit", at: (b.brandAt ?? b.t0) - 0.1, vol: 0.3 }); }
  });
  return thin(s);
};

export const Notes: React.FC<{ data: ReelData }> = ({ data }) => (
  <AbsoluteFill style={{ background: "#141210", fontFamily: N.font }}>
    <Footage shots={data.shots} total={data.total} mode="cross" push={0.06} scale={1.12} filter="blur(18px) brightness(0.62) saturate(0.9)" />
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(20,16,8,0.35), rgba(20,16,8,0.15) 40%, rgba(10,8,4,0.6) 100%)" }} />
    <Card data={data} />
    <Captions caps={data.captions} look={{ top: 1330, font: N.font, weight: 800, size: 60, color: "#ffffff", active: N.ink, activeBg: "#ffd60a", shadow: "0 4px 16px rgba(0,0,0,0.7)", gap: "6px 4px" }} />
    <Grain opacity={0.05} />
    <Vignette strength={0.4} />
    <Soundtrack data={data} sfx={sfxFor(data)} />
  </AbsoluteFill>
);
