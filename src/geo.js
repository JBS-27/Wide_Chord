import * as THREE from "three";

function naca(x, t) {
  const xc = Math.min(Math.max(x, 1e-4), 1);
  return (
    5 *
    t *
    (0.2969 * Math.sqrt(xc) -
      0.126 * xc -
      0.3516 * xc * xc +
      0.2843 * xc ** 3 -
      0.1036 * xc ** 4)
  );
}

/**
 * Span along +Y, root at the origin. Twist 0 feathers the chord along the axis;
 * larger twist sets the chord more across the flow, which is what a slow root needs.
 */
export function createBladeGeometry({
  span = 1,
  rootChord = 0.2,
  tipChord = 0.12,
  rootTwist = 0.4,
  tipTwist = 0.1,
  rootThick = 0.1,
  tipThick = 0.06,
  camber = 0.04,
  sweep = 0,
  lean = 0,
  leadingMetal = false,
}) {
  const spanSteps = 8;
  const chordSteps = 14;
  const positions = [];
  const colors = [];
  const upper = [];
  const lower = [];

  for (let i = 0; i <= spanSteps; i++) {
    const v = i / spanSteps;
    const chord = THREE.MathUtils.lerp(rootChord, tipChord, v);
    const thick = THREE.MathUtils.lerp(rootThick, tipThick, v);
    const twist = THREE.MathUtils.lerp(rootTwist, tipTwist, v);
    const ct = Math.cos(twist);
    const st = Math.sin(twist);
    for (let j = 0; j <= chordSteps; j++) {
      const u = j / chordSteps;
      const xc = 0.5 * (1 - Math.cos(Math.PI * u));
      const yt = Math.max(naca(xc, thick), 0.012 * (1.02 - xc));
      const yc = camber * Math.sin(Math.PI * xc);
      const axial = (xc - 0.32) * chord + sweep * v * span;
      const leanT = lean * v * span;
      const upperT = yt * chord + yc * chord + leanT;
      const lowerT = -yt * chord + yc * chord + leanT;
      const y = v * span;
      upper.push(axial * ct - upperT * st, y, axial * st + upperT * ct, xc);
      lower.push(axial * ct - lowerT * st, y, axial * st + lowerT * ct, xc);
    }
  }

  const push = (list) => {
    for (let k = 0; k < list.length; k += 4) {
      positions.push(list[k], list[k + 1], list[k + 2]);
      if (!leadingMetal) continue;
      const metal = THREE.MathUtils.smoothstep(0.18, 0.05, list[k + 3]);
      colors.push(0.13 + metal * 0.62, 0.14 + metal * 0.64, 0.15 + metal * 0.6);
    }
  };
  push(upper);
  push(lower);

  const row = chordSteps + 1;
  const uid = (i, j) => i * row + j;
  const lid = (i, j) => upper.length / 4 + i * row + j;
  const indices = [];
  for (let i = 0; i < spanSteps; i++) {
    for (let j = 0; j < chordSteps; j++) {
      const a = uid(i, j);
      const b = uid(i, j + 1);
      const c = uid(i + 1, j);
      const d = uid(i + 1, j + 1);
      indices.push(a, b, c, b, d, c);
      const e = lid(i, j);
      const f = lid(i, j + 1);
      const g = lid(i + 1, j);
      const h = lid(i + 1, j + 1);
      indices.push(e, g, f, f, g, h);
    }
  }
  for (let j = 0; j < chordSteps; j++) {
    indices.push(uid(0, j), lid(0, j), uid(0, j + 1));
    indices.push(uid(0, j + 1), lid(0, j), lid(0, j + 1));
    const i = spanSteps;
    indices.push(uid(i, j), uid(i, j + 1), lid(i, j));
    indices.push(uid(i, j + 1), lid(i, j + 1), lid(i, j));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (leadingMetal) geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export function latheAlongX(profile, segments = 56) {
  const pts = profile.map(([x, r]) => new THREE.Vector2(Math.max(r, 0.002), x));
  const geo = new THREE.LatheGeometry(pts, segments);
  geo.rotateZ(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export function cylinderX(radiusTop, radiusBottom, length, radial = 28, open = false) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, radial, 1, open);
  geo.rotateZ(Math.PI / 2);
  return geo;
}

export function profileBetween(fn, x0, x1, steps, pad = 0) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const x = THREE.MathUtils.lerp(x0, x1, i / steps);
    pts.push([x, Math.max(0.012, fn(x) + pad)]);
  }
  return pts;
}
