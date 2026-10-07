import { ENGINE_Y } from "./spec.js";

const y = ENGINE_Y;

export const BEATS = [
  {
    t: 0,
    pos: [-3.4, y + 0.45, 8.4],
    look: [0.6, y - 0.1, 0],
    fov: 34,
    verb: "ADMIT",
    line: "A test-cell bellmouth. This is not the inlet that flies on the wing.",
    num: "STN 2",
  },
  {
    t: 0.12,
    pos: [-1.35, y + 0.35, 4.4],
    look: [0.15, y, 0],
    fov: 30,
    verb: "PUSH",
    line: "Twenty-two blades, twisted because the tip is far faster than the root.",
    num: "FAN  3.1 m",
  },
  {
    t: 0.26,
    pos: [0.85, y - 0.35, 3.3],
    look: [0.7, y, 0],
    fov: 26,
    verb: "DIVIDE",
    line: "Nine parcels take the cold path. The tenth enters the core.",
    num: "BPR 10",
  },
  {
    t: 0.4,
    pos: [1.7, y - 0.45, 2.5],
    look: [1.6, y, 0],
    fov: 24,
    verb: "SQUEEZE",
    line: "Each rotor is a small push. This model shows the rows. A machine of this class has on the order of fifty.",
    num: "OPR 50",
  },
  {
    t: 0.52,
    pos: [2.85, y - 0.55, 2.15],
    look: [2.9, y, 0],
    fov: 22,
    verb: "SQUEEZE",
    line: "By the last compressor stage the air is already hot, and no fuel has burned.",
    num: "~600 °C",
  },
  {
    t: 0.64,
    pos: [3.35, y - 0.15, 2.8],
    look: [3.7, y, 0],
    fov: 26,
    verb: "BURN",
    line: "A continuous ring. Most core air is here to cool the metal and shape the gas.",
    num: "20 NOZZLES",
  },
  {
    t: 0.76,
    pos: [4.05, y - 0.2, 2.35],
    look: [4.05, y, -0.05],
    fov: 24,
    verb: "SURVIVE",
    line: "The blade lives in gas hotter than its metal. Compressor air is the reason.",
    num: "FILM COOLING",
  },
  {
    t: 0.86,
    pos: [4.4, y - 0.85, 2.5],
    look: [3.8, y, 0],
    fov: 24,
    verb: "DRIVE",
    line: "Three tubes, one inside the other. The low-pressure turbine turns the fan.",
    num: "N1  N2  N3",
  },
  {
    t: 0.94,
    pos: [6.3, y + 0.4, 4.3],
    look: [5.6, y - 0.1, 0],
    fov: 30,
    verb: "THRUST",
    line: "At takeoff the bypass is most of the thrust. Pull back for cruise and the core's share rises.",
    num: "FN",
  },
  {
    t: 1,
    pos: [0.62, y + 0.05, 1.15],
    look: [3.8, y, 0.15],
    fov: 46,
    verb: "HOLD",
    line: "Most of the thrust never sees the fire.",
    num: "SPLIT",
  },
];

export function beatAt(t) {
  const clamped = Math.min(Math.max(t, 0), 1);
  for (let i = 0; i < BEATS.length - 1; i++) {
    const a = BEATS[i];
    const b = BEATS[i + 1];
    if (clamped >= a.t && clamped <= b.t) {
      const u = (clamped - a.t) / (b.t - a.t || 1);
      return { a, b, u };
    }
  }
  const last = BEATS[BEATS.length - 1];
  return { a: last, b: last, u: 0 };
}

export function posterBeat(t) {
  let current = BEATS[0];
  for (const beat of BEATS) {
    if (t + 1e-4 >= beat.t) current = beat;
  }
  return current;
}
