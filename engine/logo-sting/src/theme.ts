// theme.ts: single source of truth. Palette + fonts: edit these to match your brand.
import { Easing } from "remotion";
import { loadFont as loadDisplay } from "@remotion/google-fonts/BarlowSemiCondensed";
import { loadFont as loadLabel } from "@remotion/google-fonts/Barlow";
import { loadFont as loadBody } from "@remotion/google-fonts/Raleway";

const display = loadDisplay("normal", { weights: ["600", "700"], subsets: ["latin"] });
const label = loadLabel("normal", { weights: ["500", "600"], subsets: ["latin"] });
const body = loadBody("normal", { weights: ["400", "500"], subsets: ["latin"] });

export const theme = {
  colors: {
    bg: "#0c0c0d",
    bgAlt: "#121214",
    primary: "#d2ad41", // brand color: THE hero color, used only on the monogram
    primaryDim: "#b8963a",
    accent: "#3a5a8c", // cool headlight-blue, background only
    text: "#ffffff",
    textDim: "rgba(255,255,255,0.55)",
    textSoft: "rgba(255,255,255,0.82)",
    light: "#fff6e0", // warm headlight white
    glow: "rgba(210, 173, 65, 0.45)",
  },
  fonts: {
    display: display.fontFamily,
    label: label.fontFamily,
    body: body.fontFamily,
  },
  ease: {
    out: Easing.bezier(0.16, 1, 0.3, 1),
    inOut: Easing.bezier(0.83, 0, 0.17, 1),
    in: Easing.bezier(0.7, 0, 0.84, 0),
    exit: Easing.bezier(0.45, 0, 0.75, 0.3), // softer ease-in so the exit reads, not snaps
  },
  spring: {
    snappy: { damping: 14, stiffness: 160, mass: 0.6 },
    smooth: { damping: 20, stiffness: 90, mass: 1 },
    bouncy: { damping: 11, stiffness: 170, mass: 0.7 },
  },
  // Timeline in seconds; converted with fps inside components.
  t: {
    lightsOn: 0.1,
    flare: 0.45,
    markDraw: 0.35,
    markLetters: 0.6,
    wordmark: 0.95,
    rule: 1.45,
    sublabel: 1.7,
    slogan: 2.2,
    glint: 3.1,
    exit: 4.45,
  },
  // Voiceover cut (LogoStingVO), optional: record a short line in VoiceStudio,
  // save it as public/vo/line.wav, trimmed so speech starts at +0.10s. Word onsets measured
  // from the loudness envelope (Whisper's word times ran ~0.3s early on this clip).
  vo: {
    start: 0.75, // file start; "I am" lands just after the monogram impact
    end: 3.5, // speech ends (start + 2.75)
    words: [
      { text: "Welcome", at: 2.55 },
      { text: "to", at: 2.75 },
      { text: "the", at: 2.93 },
      { text: "channel.", at: 3.0 },
    ],
    glint: 3.7,
    exit: 4.7,
  },
  brand: {
    monogram: ["A", "B"],
    wordmark: "YOUR BRAND NAME",
    sublabel: "YOUR NAME  ·  YOUR COMPANY",
    slogan: "Your slogan here.",
  },
} as const;

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
