// Synthesizes the SFX kit as 16-bit mono WAVs into public/sfx/. Deterministic, no downloads.
import { writeFileSync, mkdirSync } from "node:fs";

const SR = 44100;
const out = new URL("../public/sfx/", import.meta.url);
mkdirSync(out, { recursive: true });

// Seeded PRNG so renders are reproducible.
let seed = 1337;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296 * 2 - 1;
};

const writeWav = (name, samples) => {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const norm = peak > 0 ? 0.89 / peak : 1;
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, i) => buf.writeInt16LE(Math.round(Math.tanh(s * norm) * 32767), 44 + i * 2));
  writeFileSync(new URL(name, out), buf);
};

const make = (seconds, fn) => Array.from({ length: Math.floor(seconds * SR) }, (_, i) => fn(i / SR, i));

// Whoosh: noise through a swept one-pole lowpass, swelling in then out.
{
  const dur = 0.7;
  let lp = 0;
  writeWav("whoosh.wav", make(dur, (t) => {
    const x = t / dur;
    const cutoff = 300 + 5200 * Math.sin(Math.PI * Math.min(1, x * 1.15));
    const a = 1 - Math.exp(-2 * Math.PI * cutoff / SR);
    lp += a * (rand() - lp);
    const env = Math.pow(Math.sin(Math.PI * Math.pow(x, 0.7)), 2);
    return lp * env;
  }));
}

// Impact: pitch-dropping sine thump plus a short transient click.
{
  const dur = 1.4;
  let phase = 0;
  writeWav("impact.wav", make(dur, (t) => {
    const f = 42 + 110 * Math.exp(-t * 22);
    phase += 2 * Math.PI * f / SR;
    const body = Math.sin(phase) * Math.exp(-t * 3.2);
    const click = rand() * Math.exp(-t * 180) * 0.5;
    return body + click;
  }));
}

// Shimmer: bright partials with staggered onsets, like light catching chrome.
{
  const dur = 1.8;
  const partials = [2093, 2637, 3136, 4186, 5274];
  writeWav("shimmer.wav", make(dur, (t) => {
    let s = 0;
    partials.forEach((f, k) => {
      const on = k * 0.045;
      if (t < on) return;
      const tt = t - on;
      const env = (1 - Math.exp(-tt * 60)) * Math.exp(-tt * 2.6);
      s += Math.sin(2 * Math.PI * f * tt) * env / (k + 1.5);
    });
    return s * (0.85 + 0.15 * Math.sin(2 * Math.PI * 7 * t));
  }));
}

// Pad: detuned low sines, slow attack, fades out by the end of the sting.
{
  const dur = 5;
  const notes = [55, 82.41, 110, 164.81];
  writeWav("pad.wav", make(dur, (t) => {
    let s = 0;
    notes.forEach((f, k) => {
      for (const d of [-0.004, 0.004]) s += Math.sin(2 * Math.PI * f * (1 + d) * t) / (k + 1);
    });
    const env = Math.min(1, t / 1.2) * Math.min(1, (dur - t) / 1.1);
    return s * env;
  }));
}

console.log("sfx written");
