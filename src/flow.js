import * as THREE from "three";
import {
  BYPASS_P,
  BYPASS_T,
  CORE_P,
  CORE_T,
  ENGINE_Y,
  STATIONS,
  piece,
  pressureHeight,
  streamRadii,
  tempColor,
} from "./spec.js";

function dotTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const g = canvas.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.85)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function swirlAt(kind, x) {
  if (kind === "bypass") {
    if (x < 0.02) return 0;
    if (x < 0.5) return (x - 0.02) * 0.8;
    return Math.max(0, 0.38 - (x - 0.5) * 1.45);
  }
  return Math.max(0, Math.sin(x * 15)) * 0.1;
}

function curtain(parent, samplesP, samplesT, z, widthHint, bucket) {
  const segs = 88;
  const x0 = -1.3;
  const x1 = 6.55;
  const baseY = 0.14 - ENGINE_Y;
  const positions = [];
  const colors = [];
  const indices = [];
  const crest = [];
  const col = new THREE.Color();
  const shade = new THREE.Color(0x12181e);
  for (let i = 0; i <= segs; i++) {
    const x = THREE.MathUtils.lerp(x0, x1, i / segs);
    const h = pressureHeight(piece(samplesP, x));
    tempColor(piece(samplesT, x), col);
    positions.push(x, baseY, z, x, baseY + h, z);
    colors.push(shade.r, shade.g, shade.b, col.r * 0.9, col.g * 0.9, col.b * 0.9);
    crest.push(x, baseY + h + 0.004, z + widthHint);
    if (i < segs) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  mesh.renderOrder = 1;
  const line = new THREE.Line(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(crest, 3)),
    new THREE.LineBasicMaterial({ color: 0xe7dccb, transparent: true, opacity: 0.85 }),
  );
  line.renderOrder = 2;
  parent.add(mesh, line);
  bucket?.push(mesh, line);
}

export function createField(parent, clipPlane) {
  const bypassN = 3600;
  const coreN = 420;
  const total = bypassN + coreN;
  const particles = [];
  for (let i = 0; i < total; i++) {
    const kind = i < bypassN ? "bypass" : "core";
    particles.push({
      kind,
      x: THREE.MathUtils.lerp(-1.2, 6.4, Math.random()),
      theta: Math.random() * Math.PI * 2,
      mix: Math.random(),
    });
  }

  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.034,
    map: dotTexture(),
    transparent: true,
    vertexColors: true,
    depthWrite: false,
    opacity: 0.72,
    sizeAttenuation: true,
  });
  mat.clippingPlanes = [clipPlane];
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 2;
  parent.add(points);

  const charts = [];
  curtain(parent, CORE_P, CORE_T, 2.15, 0.02, charts);
  curtain(parent, BYPASS_P, BYPASS_T, 2.9, 0.02, charts);
  const baseY = 0.14 - ENGINE_Y;
  const tickPositions = [];
  for (const station of STATIONS) {
    const h = pressureHeight(piece(CORE_P, station.x));
    tickPositions.push(station.x, baseY, 2.18, station.x, baseY + h + 0.02, 2.18);
  }
  const ticks = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(tickPositions, 3)),
    new THREE.LineBasicMaterial({ color: 0xf0e6d4 }),
  );
  parent.add(ticks);
  charts.push(ticks);

  const color = new THREE.Color();

  function writeParticle(index, p) {
    const tube = streamRadii(p.kind, p.x);
    const r = THREE.MathUtils.lerp(tube.inner, tube.outer, p.mix);
    const theta = p.theta + swirlAt(p.kind, p.x);
    positions[index * 3] = p.x;
    positions[index * 3 + 1] = Math.cos(theta) * r;
    positions[index * 3 + 2] = Math.sin(theta) * r;
    const temp = piece(p.kind === "bypass" ? BYPASS_T : CORE_T, p.x);
    tempColor(temp, color);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  for (let i = 0; i < particles.length; i++) writeParticle(i, particles[i]);
  geo.attributes.position.needsUpdate = true;
  geo.attributes.color.needsUpdate = true;

  function sampleLocal(kind, x, theta, mix, target) {
    const tube = streamRadii(kind, x);
    const r = THREE.MathUtils.lerp(tube.inner, tube.outer, mix);
    const th = theta + swirlAt(kind, x);
    target.set(x, Math.cos(th) * r, Math.sin(th) * r);
    return target;
  }

  function update(dt, throttle, running) {
    if (running) {
      const gain = 0.15 + throttle * 1.2;
      for (const p of particles) {
        const speed = p.kind === "bypass" ? 1.05 : 0.58;
        p.x += dt * speed * gain;
        if (p.x > 6.55) {
          p.x = -1.25;
          p.mix = Math.random();
          p.theta = Math.random() * Math.PI * 2;
        }
      }
    }
    for (let i = 0; i < particles.length; i++) writeParticle(i, particles[i]);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  return { update, sampleLocal, points, charts };
}
