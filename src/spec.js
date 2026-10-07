/** Lyra 110 — fictional three-spool high-bypass turbofan. One gas path, shared by metal and air. */

export const ENGINE_Y = 2.65;
export const FAN_TIP = 1.55;
export const FAN_HUB = 0.46;

export function piece(samples, x) {
  if (x <= samples[0][0]) return samples[0][1];
  for (let i = 1; i < samples.length; i++) {
    if (x <= samples[i][0]) {
      const [x0, y0] = samples[i - 1];
      const [x1, y1] = samples[i];
      const t = (x - x0) / (x1 - x0 || 1);
      return y0 + (y1 - y0) * t;
    }
  }
  return samples[samples.length - 1][1];
}

export const CORE_HUB = [
  [-1.4, 0.0],
  [0.0, FAN_HUB],
  [0.9, 0.42],
  [2.1, 0.4],
  [3.3, 0.36],
  [3.8, 0.38],
  [4.3, 0.4],
  [5.2, 0.43],
  [6.25, 0.4],
];

export const CORE_TIP = [
  [-1.4, 0.7],
  [0.2, 0.68],
  [0.9, 0.82],
  [2.1, 0.7],
  [3.3, 0.5],
  [3.7, 0.64],
  [4.3, 0.74],
  [5.2, 0.98],
  [6.35, 0.78],
];

export const BYPASS_HUB = [
  [0.42, 0.08],
  [0.62, 0.48],
  [0.85, 0.7],
  [1.6, 0.78],
  [3.2, 0.86],
  [5.2, 0.98],
  [6.35, 1.05],
];

export const BYPASS_TIP = [
  [-1.45, 1.7],
  [-0.2, FAN_TIP],
  [0.3, FAN_TIP],
  [5.3, 1.5],
  [6.15, 1.32],
  [6.55, 1.16],
];

export const CORE_P = [
  [-1.3, 1],
  [0.1, 1.45],
  [1.6, 6],
  [3.25, 50],
  [3.75, 47],
  [4.45, 16],
  [5.6, 4.5],
  [6.45, 1.7],
];

export const CORE_T = [
  [-1.3, 0.12],
  [0.25, 0.2],
  [3.2, 0.58],
  [3.42, 0.6],
  [3.55, 1],
  [4.0, 0.92],
  [4.6, 0.7],
  [6.4, 0.4],
];

export const BYPASS_P = [
  [-1.3, 1],
  [0.2, 1.55],
  [6.4, 1.32],
];

export const BYPASS_T = [
  [-1.3, 0.16],
  [6.4, 0.22],
];

export function coreHub(x) {
  return piece(CORE_HUB, x);
}
export function coreTip(x) {
  return piece(CORE_TIP, x);
}
export function bypassHub(x) {
  return piece(BYPASS_HUB, x);
}
export function bypassTip(x) {
  return piece(BYPASS_TIP, x);
}

export function spinnerRadius(x) {
  const nose = -0.82;
  const base = 0.06;
  const u = (x - nose) / (base - nose);
  if (u <= 0 || u >= 1) return 0;
  return FAN_HUB * Math.sin(u * Math.PI * 0.5);
}

export function streamRadii(kind, x) {
  if (kind === "bypass") {
    if (x < 0.48) {
      return { inner: 0.7, outer: Math.max(0.92, bypassTip(x) - 0.05) };
    }
    const inner = bypassHub(x) + 0.035;
    const outer = Math.max(inner + 0.1, bypassTip(x) - 0.06);
    return { inner, outer };
  }
  if (x < 0.48) {
    return { inner: Math.max(0.08, spinnerRadius(x) + 0.045), outer: 0.62 };
  }
  const inner = Math.max(coreHub(x) + 0.025, spinnerRadius(x) + 0.04);
  const outer = Math.max(inner + 0.05, coreTip(x) - 0.025);
  return { inner, outer };
}

export function pressureHeight(p) {
  return (Math.log(Math.max(p, 1)) / Math.log(50)) * 0.98;
}

/** Stations an engine engineer would actually say out loud. x is along the shaft. */
export const STATIONS = [
  { id: "2", x: 0.05, name: "Fan face" },
  { id: "13", x: 0.75, name: "Bypass" },
  { id: "25", x: 2.02, name: "IPC exit" },
  { id: "3", x: 3.28, name: "HPC exit · T3" },
  { id: "4", x: 3.72, name: "Combustor exit · T4" },
  { id: "45", x: 4.32, name: "HPT exit" },
  { id: "5", x: 5.85, name: "LPT exit" },
  { id: "18", x: 6.4, name: "Nozzles" },
];

/** T3 follows the compressor. T4 follows the fuel. They are not the same number. */
export function cycleState({ n3, throttle, lit, fuel }) {
  const pr = 1 + Math.pow(Math.max(n3, 0), 1.12) * 49;
  const t3 = 288 * (1 + (Math.pow(pr, 0.286) - 1) / 0.88) - 273;
  const wf = lit ? 0.18 + fuel * 1.55 : 0;
  const t4 = lit ? t3 + 280 + fuel * 980 : t3;
  const tLiner = lit ? t3 * 0.45 + 160 + fuel * 120 : t3;
  const bypass = lit ? 0.68 + throttle * 0.16 : 0;
  const cooling = lit ? 5.5 + fuel * 7 : 0;
  const thrust = lit ? Math.pow(Math.max(n3, 0), 1.35) * (180 + throttle * 310) : 0;
  const vsv = 48 - Math.max(n3, 0) * 42;
  return {
    t3: Math.round(t3),
    t4: Math.round(t4),
    tLiner: Math.round(tLiner),
    wf: Math.round(wf * 100) / 100,
    bypass: Math.round(bypass * 100),
    cooling: Math.round(cooling * 10) / 10,
    thrust: Math.round(thrust),
    vsv: Math.round(vsv),
  };
}

export function tempColor(t, target) {
  const cold = [0.55, 0.66, 0.74];
  const warm = [0.92, 0.62, 0.32];
  const hot = [1, 0.9, 0.78];
  const u = Math.min(Math.max(t, 0), 1);
  const a = u < 0.55 ? cold : warm;
  const b = u < 0.55 ? warm : hot;
  const f = u < 0.55 ? u / 0.55 : (u - 0.55) / 0.45;
  target.setRGB(
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  );
  return target;
}
