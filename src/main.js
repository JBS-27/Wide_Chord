import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import "./style.css";

import { ENGINE_Y, cycleState } from "./spec.js";
import { createEngine } from "./engine.js";
import { createCell } from "./cell.js";
import { createField } from "./flow.js";
import { createAudio } from "./audio.js";
import { beatAt, posterBeat } from "./beats.js";

const FRAMES = {
  wide: { station: 0, section: 0, throttle: 0, run: false },
  fan: { station: 0.12, section: 0.2, throttle: 0.86, run: true },
  split: { station: 0.26, section: 0.82, throttle: 0.7, run: true },
  core: { station: 0.46, section: 0.88, throttle: 0.8, run: true },
  fire: { station: 0.64, section: 0.84, throttle: 0.92, run: true },
  blade: { station: 0.76, section: 0.92, throttle: 0.88, run: true },
  clocks: { station: 0.86, section: 0.97, throttle: 0.74, run: true },
  hold: { station: 1, section: 0.88, throttle: 0.55, run: true },
};

const LP_MAX = 16;
const IP_MAX = 36;
const HP_MAX = 82;

const canvasHost = document.body;
const verbEl = document.getElementById("verb");
const lineEl = document.getElementById("line");
const numEl = document.getElementById("num");
const hintEl = document.getElementById("hint");
const readoutEl = document.getElementById("readout");
const throttleWord = document.getElementById("throttle-word");
const throttleInput = document.getElementById("throttle");
const stationInput = document.getElementById("station");
const sectionInput = document.getElementById("section");
const rideBtn = document.getElementById("ride");
const soundBtn = document.getElementById("sound");
const moduleHost = document.getElementById("modules");
const callout = document.getElementById("callout");
const explodeInput = document.getElementById("explode");

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86;
renderer.shadowMap.enabled = true;
renderer.localClippingEnabled = true;
renderer.domElement.addEventListener("webglcontextlost", (event) => event.preventDefault());
canvasHost.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07080a);
scene.fog = new THREE.FogExp2(0x07080a, 0.016);

const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.05, 80);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 0.35;
controls.maxDistance = 24;
controls.minPolarAngle = 0.2;
controls.maxPolarAngle = Math.PI * 0.86;
controls.target.set(1.2, ENGINE_Y, 0);

const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 2.45);
const engine = createEngine(clipPlane);
engine.group.position.y = ENGINE_Y;
scene.add(engine.group);

const field = createField(engine.group, clipPlane);
const cell = createCell();
scene.add(cell.group);

scene.environment = makeEnvironment(renderer);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.1, 0.35, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const audio = createAudio();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const desiredPos = new THREE.Vector3();
const desiredLook = new THREE.Vector3();
const ridePos = new THREE.Vector3();
const rideLook = new THREE.Vector3();
const homeTech = new THREE.Vector3(-1.85, 0, 0.35);
const safeTech = new THREE.Vector3(-0.2, 0, 3.4);

const state = {
  commanded: 0,
  throttle: 0,
  section: 0,
  station: 0,
  running: false,
  muted: true,
  solo: "all",
  module: null,
  showAir: true,
  showGraph: true,
  focus: null,
  time: 0,
  n1: 0,
  n2: 0,
  n3: 0,
};

let lp = 0;
let ip = 0;
let hp = 0;
const angle = { lp: 0.2, ip: 0.5, hp: 0.8 };
let driving = true;
let aimOverride = null;
let snap = true;
let ride = null;
let parcel = 0;
let hold = 0;
let cruiseBlend = 0;
let pointerDown = null;
let phase = "off";
let lit = false;
let fuel = 0;
let starter = 0;

const MODULES = [
  { id: "fan", name: "Fan", job: "Twenty-two blades push the river.", t: 0.12 },
  { id: "ogv", name: "Guide vanes", job: "They take the swirl out of the bypass.", t: 0.2 },
  { id: "split", name: "Splitter", job: "Nine parcels stay cold. The tenth enters the core.", t: 0.26 },
  { id: "ipc", name: "IPC", job: "The intermediate compressor, a stack of small pushes.", t: 0.4 },
  { id: "hpc", name: "HPC", job: "Pressure is already a mountain, before any fuel burns.", t: 0.52 },
  { id: "burn", name: "Combustor", job: "One continuous ring of fire. Most of the air here is cooling.", t: 0.64 },
  { id: "hpt", name: "HP turbine", job: "It pays the compressor, and the blade is film-cooled.", t: 0.76 },
  { id: "ipt", name: "IP turbine", job: "This clock drives the intermediate compressor.", t: 0.8 },
  { id: "lpt", name: "LP turbine", job: "This clock turns the fan through the long shaft.", t: 0.86 },
  { id: "shafts", name: "Three shafts", job: "Three tubes, one inside the other, three speeds.", t: 0.86 },
  { id: "nozzle", name: "Nozzles", job: "The quiet majority leaves cold.", t: 0.94 },
  { id: "gear", name: "Gearbox", job: "Fuel, oil, generator, hydraulics. The gas path needs this.", t: 0.5 },
  { id: "bleed", name: "Bleed", job: "Open during start so the compressor does not stall.", t: 0.52 },
];

const EYES = {
  gear: {
    pos: [2.2, ENGINE_Y - 0.85, 3.6],
    look: [2.55, ENGINE_Y - 1.55, 0],
    fov: 30,
  },
  bleed: {
    pos: [2.2, ENGINE_Y - 0.55, 2.9],
    look: [2.55, ENGINE_Y - 0.15, 0.1],
    fov: 28,
  },
};

const soloCopy = {
  lp: {
    verb: "DRIVE",
    line: "Gas pushes the low-pressure turbine. The long shaft turns the fan.",
    num: "LP",
  },
  ip: {
    verb: "DRIVE",
    line: "The intermediate turbine and the intermediate compressor are the same clock.",
    num: "IP",
  },
  hp: {
    verb: "DRIVE",
    line: "Gas pushes the high-pressure turbine. The shaft turns the compressor.",
    num: "HP",
  },
};

function makeEnvironment(gl) {
  const env = new THREE.Scene();
  const add = (color, x, y, z, w, h, rotY = 0) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    env.add(mesh);
  };
  add(0x8a7352, 0, 3.2, -6, 10, 0.35);
  add(0x66788e, 0, 2.2, 6, 8, 0.22, Math.PI);
  add(0x14181c, -8, 1, 0, 4, 6, Math.PI / 2);
  const deck = new THREE.Mesh(
    new THREE.CircleGeometry(14, 12),
    new THREE.MeshBasicMaterial({ color: 0x0c0e10 }),
  );
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = -2;
  env.add(deck);
  const pmrem = new THREE.PMREMGenerator(gl);
  const tex = pmrem.fromScene(env, 0.045).texture;
  pmrem.dispose();
  return tex;
}

function applyFrame(name) {
  const frame = FRAMES[name];
  if (!frame) return;
  state.station = frame.station;
  state.section = frame.section;
  state.commanded = frame.throttle;
  state.running = frame.run;
  if (frame.run) {
    phase = "run";
    lit = true;
    fuel = frame.throttle;
  }
  stationInput.value = String(frame.station * 1000);
  sectionInput.value = String(frame.section * 1000);
  throttleInput.value = String(frame.throttle * 1000);
  const idle = frame.run ? 0.07 : 0;
  const level = idle + frame.throttle * 0.93;
  lp = level * LP_MAX;
  ip = level * IP_MAX;
  hp = level * HP_MAX;
  driving = true;
  snap = true;
}

function appearance() {
  engine.group.traverse((obj) => {
    if (!obj.isMesh && !obj.isInstancedMesh) return;
    if (!obj.userData?.engine || obj.userData.ghost) return;
    let show = true;
    if (state.focus) show = obj === state.focus;
    else if (state.module) {
      const spoolOf = { fan: "lp", lpt: "lp", ogv: "lp", ipc: "ip", ipt: "ip", hpc: "hp", hpt: "hp", burn: "hp", bleed: "hp", gear: "hp" };
      const spool = spoolOf[state.module];
      show = obj.userData.mod === state.module || (spool && obj.userData.spool === spool);
    }
    else if (state.solo !== "all") show = obj.userData.spool === state.solo;
    if (show) {
      if (obj.userData.savedMat) {
        obj.material = obj.userData.savedMat;
        obj.userData.savedMat = null;
      }
    } else if (!obj.userData.savedMat) {
      obj.userData.savedMat = obj.material;
      obj.material = engine.materials.lattice;
    }
  });
}

function copyNow(beat) {
  if (phase === "crank") {
    return {
      verb: "CRANK",
      line: "The starter is on the HP spool. N3 rises first. There is no fuel, and T4 is still T3.",
      num: "STARTER",
    };
  }
  if (phase === "light") {
    return {
      verb: "LIGHT",
      line: "Fuel is on. The ring catches. From here, T4 follows the fuel, not the rpm.",
      num: "WF",
    };
  }
  if (state.focus?.userData?.verb) return state.focus.userData;
  if (state.module) {
    const mod = MODULES.find((item) => item.id === state.module);
    if (mod) return { verb: mod.name.toUpperCase(), line: mod.job, num: mod.id.toUpperCase() };
  }
  if (ride?.dwell) {
    return {
      verb: "HOLD",
      line: "Most of the thrust never sees the fire.",
      num: ride.kind === "core" ? "PARCEL 10 · CORE" : `PARCEL ${String(ride.n).padStart(2, "0")} · BYPASS`,
    };
  }
  if (state.solo !== "all") return soloCopy[state.solo];
  if (beat.verb === "SQUEEZE" && state.running && state.throttle < 0.14) {
    return {
      verb: "MATCH",
      line: "Variable vanes are closed. Bleed is open. That is what keeps the compressor from stalling.",
      num: "BLEED",
    };
  }
  if (beat.verb === "PUSH" && state.n1 > 0.8) {
    return {
      verb: "PUSH",
      line: "A faint shock stands at the tips. The root is still biting; the tip is almost feathered.",
      num: "FAN  3.1 m",
    };
  }
  if (state.station > 0.9 && state.throttle < 0.45 && lit) {
    const live = cycleState({ n3: state.n3, throttle: state.throttle, lit, fuel });
    return {
      verb: "CRUISE",
      line: "Thinner air, lower fuel. The bypass is still the majority, and the core's share is larger than it was at takeoff.",
      num: `BYP ${live.bypass}%`,
    };
  }
  return beat;
}

function renderCopy(block) {
  if (verbEl.textContent !== block.verb) verbEl.textContent = block.verb;
  if (lineEl.textContent !== block.line) lineEl.textContent = block.line;
  if (numEl.textContent !== block.num) numEl.textContent = block.num;
}

function hintText() {
  if (ride) {
    return ride.kind === "core"
      ? "Parcel 10 of 10. This one goes through the fire."
      : `Parcel ${ride.n} of 10. This one stays in the cold river.`;
  }
  if (phase === "off") return "Press START. The starter turns N3. The throttle waits until the fire is lit.";
  if (phase === "crank") return "No fuel yet. Handling bleed is open. The vanes are closed.";
  if (phase === "light") return "Light-up. T4 is leaving T3 because fuel is in, not because rpm rose.";
  if (state.module) return "That system stays solid. Everything else is the lattice.";
  if (state.solo !== "all") return "One clock. The shaft is the sentence between turbine and compressor.";
  return "Click a part, or a system. Ride sends one parcel in ten through the fire.";
}

function throttleLabel(value) {
  if (!state.running) return "IDLE";
  if (value < 0.12) return "IDLE";
  if (value < 0.4) return "CLIMB";
  if (value < 0.85) return "TAKEOFF";
  return "RATED";
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.resolution.set(w, h);
}

function hitFrom(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  engine.group.updateMatrixWorld(true);
  const hits = raycaster.intersectObject(engine.group, true);
  return (
    hits.find(
      (item) =>
        item.object.userData?.engine &&
        !item.object.userData.ghost &&
        !item.object.userData.noPick &&
        item.object.visible,
    ) || null
  );
}

function pick(event) {
  const hit = hitFrom(event);
  state.focus = hit && state.focus !== hit.object ? hit.object : null;
  if (state.focus) state.module = null;
  appearance();
}

function applyExplode(amount) {
  engine.group.traverse((obj) => {
    if (obj.userData?.ghost) {
      obj.visible = amount < 0.06 && state.section > 0.03;
      return;
    }
    if (!obj.userData?.engine || obj.userData.homeX == null) return;
    const mod = obj.userData.mod;
    const spool = obj.userData.spool;
    let shift = 0;
    if (spool === "lp" || mod === "fan" || mod === "lpt" || mod === "ogv") shift = -1;
    else if (spool === "ip" || mod === "ipc" || mod === "ipt") shift = 0;
    else if (spool === "hp" || mod === "hpc" || mod === "hpt" || mod === "burn" || mod === "bleed" || mod === "gear") shift = 1;
    obj.position.x = obj.userData.homeX + shift * amount * 1.2;
    if (mod === "case") obj.visible = amount < 0.06;
  });
}

function paintMap(thermo) {
  const dot = document.getElementById("cmap-dot");
  const note = document.getElementById("cmap-note");
  if (!dot || !note) return;
  const flow = 0.12 + state.n3 * 0.78;
  const pressure = 0.1 + Math.pow(state.n3, 1.12) * 0.8;
  const handling = phase === "crank" || phase === "light" || (lit && state.n3 < 0.36);
  const surge = 0.25 + flow * 0.9;
  const margin = surge - pressure + (handling ? 0.14 : 0) + (thermo.vsv < 18 ? 0.03 : -0.03);
  dot.setAttribute("cx", String(18 + flow * 120));
  dot.setAttribute("cy", String(82 - Math.min(0.92, pressure) * 72));
  dot.setAttribute("fill", margin < 0.07 ? "#ff5a2a" : "#e7e2d8");
  if (phase === "off") note.textContent = "MAP DARK";
  else if (handling) note.textContent = "BLEED HOLDING THE LINE";
  else if (margin < 0.07) note.textContent = "NEAR SURGE";
  else note.textContent = `MARGIN ${Math.max(0, Math.round(margin * 100))}`;
}

function paintChrome() {
  moduleHost.querySelectorAll("button").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.dataset.mod === state.module ? "true" : "false");
  });
  document.querySelectorAll("#spools button").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.dataset.spool === state.solo ? "true" : "false");
  });
  let current = null;
  document.querySelectorAll("#stations button").forEach((btn) => {
    btn.classList.remove("on");
    if (state.station + 1e-3 >= Number(btn.dataset.t)) current = btn;
  });
  current?.classList.add("on");
  const marks = [
    [0.12, "2"],
    [0.26, "13"],
    [0.4, "25"],
    [0.52, "3"],
    [0.64, "4"],
    [0.76, "45"],
    [0.86, "5"],
    [0.94, "18"],
  ];
  let active = "2";
  for (const [t, id] of marks) if (state.station + 0.02 >= t) active = id;
  for (const mark of engine.stationMarks) {
    const on = mark.userData.stationId === active;
    mark.scale.setScalar(on ? 1.4 : 1);
  }
}

throttleInput.addEventListener("input", () => {
  if (phase !== "run") {
    throttleInput.value = "0";
    return;
  }
  state.commanded = Number(throttleInput.value) / 1000;
});
stationInput.addEventListener("input", () => {
  state.station = Number(stationInput.value) / 1000;
  state.module = null;
  state.focus = null;
  aimOverride = null;
  driving = true;
  appearance();
  if (ride) {
    ride = null;
    hold = 0;
    controls.enabled = true;
  }
});
sectionInput.addEventListener("input", () => {
  state.section = Number(sectionInput.value) / 1000;
});

rideBtn.addEventListener("click", () => {
  if (ride) {
    ride = null;
    hold = 0;
    controls.enabled = true;
    return;
  }
  parcel = (parcel % 10) + 1;
  ride = {
    n: parcel,
    kind: parcel === 10 ? "core" : "bypass",
    x: -1.15,
    theta: Math.random() * Math.PI * 2,
    mix: 0.3 + Math.random() * 0.55,
    dwell: false,
  };
  state.running = true;
  phase = "run";
  lit = true;
  if (state.commanded < 0.35) {
    state.commanded = 0.55;
    throttleInput.value = "550";
  }
  fuel = state.commanded;
  controls.enabled = false;
});

for (const mod of MODULES) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.mod = mod.id;
  btn.innerHTML = `<b>${mod.name}</b><span>${mod.job}</span>`;
  moduleHost.appendChild(btn);
}

moduleHost.addEventListener("click", (event) => {
  const btn = event.target.closest("button");
  if (!btn) return;
  const id = btn.dataset.mod;
  if (state.module === id) {
    state.module = null;
    aimOverride = null;
  } else {
    const mod = MODULES.find((item) => item.id === id);
    state.module = id;
    state.focus = null;
    state.solo = "all";
    stationInput.value = String(mod.t * 1000);
    if (Number(sectionInput.value) < 700) sectionInput.value = "880";
    aimOverride = EYES[id] || null;
    driving = true;
    if (ride) {
      ride = null;
      hold = 0;
      controls.enabled = true;
    }
    if (id === "bleed") {
      state.running = true;
      state.commanded = 0.06;
      throttleInput.value = "60";
    }
  }
  appearance();
});

document.getElementById("spools").addEventListener("click", (event) => {
  const btn = event.target.closest("button");
  if (!btn) return;
  state.solo = btn.dataset.spool;
  state.module = null;
  state.focus = null;
  aimOverride = null;
  if (state.solo !== "all" && Number(sectionInput.value) < 700) sectionInput.value = "900";
  driving = true;
  appearance();
});

document.getElementById("power").addEventListener("click", (event) => {
  const btn = event.target.closest("button");
  if (!btn) return;
  const preset = {
    start: { throttle: 0, station: 0.52, section: 900, module: "bleed" },
    takeoff: { throttle: 0.96, station: 0.12, section: 620, module: "fan" },
    cruise: { throttle: 0.28, station: 0.94, section: 760, module: null },
  }[btn.dataset.power];
  state.focus = null;
  state.solo = "all";
  state.module = preset.module;
  stationInput.value = String(preset.station * 1000);
  sectionInput.value = String(preset.section);
  if (btn.dataset.power === "start") {
    phase = "crank";
    lit = false;
    fuel = 0;
    starter = 0;
    state.running = true;
    state.commanded = 0;
    throttleInput.value = "0";
  } else {
    phase = "run";
    lit = true;
    fuel = preset.throttle;
    state.running = true;
    state.commanded = preset.throttle;
    throttleInput.value = String(preset.throttle * 1000);
  }
  const level = 0.07 + preset.throttle * 0.93;
  lp = level * LP_MAX;
  ip = level * IP_MAX;
  hp = level * HP_MAX;
  aimOverride = EYES[preset.module] || null;
  driving = true;
  appearance();
});

document.getElementById("layers").addEventListener("click", (event) => {
  const btn = event.target.closest("button");
  if (!btn) return;
  if (btn.dataset.layer === "air") {
    state.showAir = !state.showAir;
    btn.setAttribute("aria-pressed", state.showAir ? "true" : "false");
  } else if (btn.dataset.layer === "graph") {
    state.showGraph = !state.showGraph;
    btn.setAttribute("aria-pressed", state.showGraph ? "true" : "false");
  } else if (btn.dataset.layer === "cut") {
    sectionInput.value = Number(sectionInput.value) > 450 ? "0" : "880";
  }
});

document.getElementById("stations").addEventListener("click", (event) => {
  event.preventDefault();
  const btn = event.target.closest("button");
  if (!btn) return;
  stationInput.value = String(Number(btn.dataset.t) * 1000);
  if (Number(sectionInput.value) < 500) sectionInput.value = "850";
  stationInput.dispatchEvent(new Event("input"));
});

renderer.domElement.addEventListener("pointermove", (event) => {
  const hit = hitFrom(event);
  if (!hit) {
    callout.hidden = true;
    renderer.domElement.classList.remove("picking");
    return;
  }
  const data = hit.object.userData;
  renderer.domElement.classList.add("picking");
  callout.hidden = false;
  callout.textContent = `${data.verb || "PART"} · ${data.num || data.mod || ""}`;
  callout.style.left = `${Math.min(event.clientX + 14, window.innerWidth - 180)}px`;
  callout.style.top = `${event.clientY + 16}px`;
});

soundBtn.addEventListener("click", async () => {
  state.muted = !state.muted;
  soundBtn.setAttribute("aria-pressed", state.muted ? "false" : "true");
  soundBtn.textContent = state.muted ? "SOUND" : "SOUND · ON";
  await audio.resume();
});

window.addEventListener("pointerdown", () => audio.resume(), { once: true });

renderer.domElement.addEventListener("pointerdown", (event) => {
  pointerDown = [event.clientX, event.clientY];
  renderer.domElement.classList.add("dragging");
});
window.addEventListener("pointerup", (event) => {
  renderer.domElement.classList.remove("dragging");
  if (!pointerDown) return;
  const dx = event.clientX - pointerDown[0];
  const dy = event.clientY - pointerDown[1];
  pointerDown = null;
  if (dx * dx + dy * dy > 16) {
    driving = false;
    return;
  }
  if (event.target === renderer.domElement) pick(event);
});
controls.addEventListener("start", () => {
  driving = false;
});

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    const delta = event.key === "ArrowUp" ? 40 : -40;
    throttleInput.value = String(Math.min(1000, Math.max(0, Number(throttleInput.value) + delta)));
    throttleInput.dispatchEvent(new Event("input"));
  }
  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    const delta = event.key === "ArrowRight" ? 30 : -30;
    stationInput.value = String(Math.min(1000, Math.max(0, Number(stationInput.value) + delta)));
    stationInput.dispatchEvent(new Event("input"));
  }
  if (event.key === "[" || event.key === "]") {
    const delta = event.key === "]" ? 40 : -40;
    sectionInput.value = String(Math.min(1000, Math.max(0, Number(sectionInput.value) + delta)));
    sectionInput.dispatchEvent(new Event("input"));
  }
});

window.addEventListener("resize", resize);
window.addEventListener("error", (event) => {
  const pre = document.createElement("pre");
  pre.className = "err";
  pre.textContent = event.message;
  document.body.appendChild(pre);
});

applyFrame(new URLSearchParams(location.search).get("frame") || "");

const timer = new THREE.Timer();
const shotMode = new URLSearchParams(location.search).has("shot");
let frames = 0;

function frame() {
  if (!shotMode || frames < 6) requestAnimationFrame(frame);
  frames += 1;
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  state.time += dt;
  state.throttle += (state.commanded - state.throttle) * (1 - Math.exp(-1.4 * dt));
  state.section = Number(sectionInput.value) / 1000;
  state.station = Number(stationInput.value) / 1000;

  const follow = (current, target, rate) => current + (target - current) * (1 - Math.exp(-rate * dt));
  if (phase === "crank") {
    starter = Math.min(1, starter + dt * 0.28);
    hp = follow(hp, starter * 0.24 * HP_MAX, 1.6);
    ip = follow(ip, starter * 0.04 * IP_MAX, 0.35);
    lp = follow(lp, starter * 0.015 * LP_MAX, 0.25);
    fuel = 0;
    lit = false;
    if (starter >= 1) phase = "light";
  } else if (phase === "light") {
    fuel = Math.min(0.2, fuel + dt * 0.12);
    if (fuel > 0.08) lit = true;
    hp = follow(hp, 0.32 * HP_MAX, 1.4);
    ip = follow(ip, 0.18 * IP_MAX, 0.7);
    lp = follow(lp, 0.1 * LP_MAX, 0.4);
    if (fuel >= 0.2) {
      phase = "run";
      state.commanded = 0.08;
    }
  } else if (phase === "run") {
    const level = 0.1 + state.commanded * 0.9;
    fuel += (state.commanded - fuel) * (1 - Math.exp(-1.1 * dt));
    hp = follow(hp, level * HP_MAX, 2.4);
    ip = follow(ip, level * IP_MAX, 1.15);
    lp = follow(lp, level * LP_MAX, 0.55);
    lit = true;
  } else {
    fuel = 0;
    lit = false;
    starter = 0;
    hp = follow(hp, 0, 1.4);
    ip = follow(ip, 0, 1.2);
    lp = follow(lp, 0, 1);
  }
  state.n1 = lp / LP_MAX;
  state.n2 = ip / IP_MAX;
  state.n3 = hp / HP_MAX;
  state.phase = phase;
  state.lit = lit;
  state.fuel = fuel;

  if (ride && hold <= 0) {
    const prev = ride.x;
    ride.x += dt * (ride.kind === "bypass" ? 0.74 : 0.5);
    if (prev < 0.62 && ride.x >= 0.62) {
      hold = 2.15;
      ride.dwell = true;
    }
    if (ride.x > 6.6) {
      ride = null;
      hold = 0;
      controls.enabled = true;
    }
  }
  if (hold > 0) {
    hold -= dt;
    if (hold <= 0 && ride) ride.dwell = false;
  }

  const frozen = state.station > 0.988 || hold > 0;
  const motion = frozen ? 0 : dt;
  if (state.running) {
    angle.lp += lp * motion;
    angle.ip += ip * motion;
    angle.hp += hp * motion;
  }
  engine.spools.lp.rotation.x = angle.lp;
  engine.spools.ip.rotation.x = angle.ip;
  engine.spools.hp.rotation.x = angle.hp;
  engine.setSection(state.section);
  engine.update({ ...state, time: state.time });
  applyExplode(Number(explodeInput.value) / 1000);
  field.points.visible = state.showAir;
  for (const chart of field.charts) chart.visible = state.showGraph;
  field.update(frozen ? 0 : dt, state.throttle, state.running && !frozen && state.showAir);

  const cruiseTarget = state.station > 0.9 && state.commanded < 0.42 && state.running ? 1 : 0;
  cruiseBlend += (cruiseTarget - cruiseBlend) * (1 - Math.exp(-1.5 * dt));
  scene.fog.density = THREE.MathUtils.lerp(0.016, 0.006, cruiseBlend);
  scene.background.setRGB(
    THREE.MathUtils.lerp(0.027, 0.012, cruiseBlend),
    THREE.MathUtils.lerp(0.031, 0.02, cruiseBlend),
    THREE.MathUtils.lerp(0.039, 0.07, cruiseBlend),
  );
  scene.fog.color.copy(scene.background);
  cell.lights.workA.intensity = THREE.MathUtils.lerp(55, 16, state.throttle) * (1 - cruiseBlend * 0.75);
  cell.lights.workB.intensity = THREE.MathUtils.lerp(36, 12, state.throttle) * (1 - cruiseBlend * 0.65);
  cell.lights.hot.intensity = state.running ? THREE.MathUtils.lerp(1.2, 16, state.throttle) : 0;
  cell.lights.hemi.intensity = THREE.MathUtils.lerp(0.55, 0.28, cruiseBlend);
  for (const lamp of cell.lamps) {
    lamp.material.color.set(cruiseBlend > 0.5 ? 0xc5d4ea : 0xffe2b0);
  }

  const techTarget = state.running && state.throttle > 0.05 ? safeTech : homeTech;
  cell.technician.position.lerp(techTarget, 1 - Math.exp(-1.5 * dt));
  const face = state.running && state.throttle > 0.05 ? Math.PI : Math.PI / 2;
  cell.technician.rotation.y += (face - cell.technician.rotation.y) * (1 - Math.exp(-2 * dt));

  const { a, b, u } = beatAt(state.station);
  const camU = snap ? 1 : 1 - Math.exp(-3 * dt);
  if (ride) {
    field.sampleLocal(ride.kind, THREE.MathUtils.clamp(ride.x, -1.2, 6.4), ride.theta, ride.mix, ridePos);
    engine.group.localToWorld(ridePos);
    rideLook.set(ride.x + 1.1, ridePos.y - ENGINE_Y, ridePos.z * 0.2);
    engine.group.localToWorld(rideLook);
    camera.position.copy(ridePos);
    camera.position.y += 0.05;
    camera.position.z += ride.kind === "bypass" ? 0.16 : 0.08;
    camera.lookAt(rideLook);
    camera.fov = 42;
    camera.updateProjectionMatrix();
  } else if (driving) {
    const poseA = aimOverride || a;
    const poseB = aimOverride || b;
    const poseU = aimOverride ? 0 : u;
    desiredPos.set(
      THREE.MathUtils.lerp(poseA.pos[0], poseB.pos[0], poseU),
      THREE.MathUtils.lerp(poseA.pos[1], poseB.pos[1], poseU),
      THREE.MathUtils.lerp(poseA.pos[2], poseB.pos[2], poseU),
    );
    desiredLook.set(
      THREE.MathUtils.lerp(poseA.look[0], poseB.look[0], poseU),
      THREE.MathUtils.lerp(poseA.look[1], poseB.look[1], poseU),
      THREE.MathUtils.lerp(poseA.look[2], poseB.look[2], poseU),
    );
    camera.position.lerp(desiredPos, camU);
    controls.target.lerp(desiredLook, camU);
    camera.fov = THREE.MathUtils.lerp(camera.fov, THREE.MathUtils.lerp(poseA.fov, poseB.fov, poseU), camU);
    camera.updateProjectionMatrix();
    controls.enabled = true;
    controls.update();
  } else {
    controls.update();
  }
  snap = false;

  paintChrome();
  const block = copyNow(posterBeat(state.station));
  renderCopy(block);
  hintEl.textContent = hintText();
  const thermo = cycleState({ n3: state.n3, throttle: state.throttle, lit, fuel });
  paintMap(thermo);
  readoutEl.textContent = `N1 ${pad(state.n1)} · N2 ${pad(state.n2)} · N3 ${pad(state.n3)} · VSV ${lit || phase !== "off" ? thermo.vsv : "——"}°`;
  const thermoEl = document.getElementById("thermo");
  thermoEl.textContent = lit
    ? `T3 ${thermo.t3}° · T4 ${thermo.t4}° · LINER ${thermo.tLiner}° · WF ${thermo.wf.toFixed(2)} · BYP ${thermo.bypass}% · FN ${thermo.thrust} kN`
    : "T3 —— · T4 —— · WF 0 · BYP —— · COOL —— · FN 0";
  throttleWord.textContent = phase === "crank" ? "CRANK" : phase === "light" ? "LIGHT" : throttleLabel(state.commanded);
  document.body.classList.toggle("live", state.running && state.n1 > 0.05);
  rideBtn.textContent = ride
    ? `RIDING · ${String(ride.n).padStart(2, "0")} ${ride.kind === "core" ? "CORE" : "BYPASS"}`
    : "RIDE THE AIR";
  rideBtn.setAttribute("aria-pressed", ride ? "true" : "false");

  audio.update({
    muted: state.muted,
    n1: state.n1,
    n3: state.n3,
    throttle: state.throttle,
    oil: state.focus?.userData?.audio === "oil",
    running: state.running,
  });

  composer.render();
}

function pad(value) {
  return String(Math.round(Math.min(1, Math.max(0, value)) * 100)).padStart(3, "0");
}

resize();
frame();
