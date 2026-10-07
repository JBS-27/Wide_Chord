import * as THREE from "three";
import { FAN_HUB, FAN_TIP, STATIONS, bypassTip, coreHub, coreTip } from "./spec.js";
import { createBladeGeometry, cylinderX, latheAlongX } from "./geo.js";
import { createMaterials, makeNameplateTexture } from "./materials.js";

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

function tubeAlongX(outer, inner, length) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: length,
    bevelEnabled: false,
    curveSegments: 18,
    steps: 1,
  });
  geo.translate(0, 0, -length / 2);
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export function createEngine(clipPlane) {
  const mats = createMaterials(clipPlane);
  const group = new THREE.Group();
  group.name = "Lyra110";

  const spools = {
    lp: new THREE.Group(),
    ip: new THREE.Group(),
    hp: new THREE.Group(),
  };
  spools.lp.name = "lp";
  spools.ip.name = "ip";
  spools.hp.name = "hp";
  group.add(spools.lp, spools.ip, spools.hp);

  const cases = [];
  const ghosts = [];
  const vsvs = [];
  const dummy = new THREE.Object3D();
  const qSpin = new THREE.Quaternion();
  const qPitch = new THREE.Quaternion();
  const q = new THREE.Quaternion();

  function tag(mesh, data) {
    mesh.userData = { engine: true, ...data };
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function layoutRow(mesh, spec, pitch) {
    for (let i = 0; i < spec.count; i++) {
      const a = (i / spec.count) * Math.PI * 2;
      qSpin.setFromAxisAngle(AXIS_X, a);
      qPitch.setFromAxisAngle(AXIS_Y, pitch);
      q.copy(qSpin).multiply(qPitch);
      dummy.position.set(spec.x, Math.cos(a) * spec.hub, Math.sin(a) * spec.hub);
      dummy.quaternion.copy(q);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }

  function addRow(spec) {
    const geo = createBladeGeometry(spec.blade);
    const mesh = new THREE.InstancedMesh(geo, spec.material, spec.count);
    tag(mesh, spec.data);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    layoutRow(mesh, spec, spec.pitch || 0);
    spec.parent.add(mesh);
    if (spec.vsv) vsvs.push({ mesh, spec, base: spec.pitch || 0 });
    return mesh;
  }

  function addAnnulus(parent, x, inner, outer, mat, data) {
    if (outer - inner < 0.02) return;
    const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 28), mat);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = x;
    tag(ring, data);
    parent.add(ring);
  }

  const shaftMats = {};
  function addShaft(parent, x0, x1, outer, inner, mat, data) {
    const length = x1 - x0;
    const geo = inner > 0 ? tubeAlongX(outer, inner, length) : cylinderX(outer, outer, length, 20);
    const own = mat.clone();
    own.emissive = new THREE.Color(data.spool === "hp" ? 0xff5a32 : 0x8ec8ff);
    own.emissiveIntensity = 0;
    shaftMats[data.spool] = own;
    const mesh = new THREE.Mesh(geo, own);
    mesh.position.x = (x0 + x1) / 2;
    tag(mesh, data);
    parent.add(mesh);
  }

  addShaft(spools.lp, -0.05, 5.85, 0.07, 0, mats.steel, {
    mod: "shafts",
    spool: "lp",
    verb: "TIE",
    line: "The long inner clock. It ties the fan to the low-pressure turbine — LP shaft.",
    num: "N1",
  });
  addShaft(spools.ip, 0.88, 4.72, 0.145, 0.1, mats.steel, {
    mod: "shafts",
    spool: "ip",
    verb: "TIE",
    line: "A tube around the inner shaft. It ties the intermediate compressor to its turbine — IP shaft.",
    num: "N2",
  });
  addShaft(spools.hp, 2.15, 4.32, 0.21, 0.16, mats.nickel, {
    mod: "shafts",
    spool: "hp",
    verb: "TIE",
    line: "The short, fast clock. Gas pushes the turbine; this shaft turns the compressor — HP shaft.",
    num: "N3",
  });

  const fanSpec = {
    parent: spools.lp,
    x: 0.04,
    hub: FAN_HUB,
    count: 22,
    pitch: 0,
    material: mats.fan,
    blade: {
      span: FAN_TIP - FAN_HUB,
      rootChord: 0.48,
      tipChord: 0.22,
      rootTwist: 0.58,
      tipTwist: 0.04,
      rootThick: 0.09,
      tipThick: 0.028,
      camber: 0.028,
      sweep: 0.26,
      lean: 0.05,
      leadingMetal: true,
    },
    data: {
      mod: "fan",
      spool: "lp",
      verb: "PUSH",
      line: "Twisted because the tip is far faster than the root — fan blade.",
      num: "22 BLADES",
    },
  };
  addRow(fanSpec);
  addAnnulus(spools.lp, 0.02, 0.1, FAN_HUB, mats.titanium, {
    mod: "fan",
    spool: "lp",
    verb: "HOLD",
    line: "The disk the fan blades stand on.",
    num: "FAN",
  });

  const spinner = new THREE.Mesh(
    latheAlongX(
      Array.from({ length: 18 }, (_, i) => {
        const u = i / 17;
        return [-0.84 + u * 0.9, Math.max(0.004, FAN_HUB * Math.sin(u * Math.PI * 0.5))];
      }),
      28,
    ),
    mats.titanium,
  );
  tag(spinner, {
    mod: "fan",
    spool: "lp",
    verb: "FAIR",
    line: "Smooths the air onto the hub — spinner.",
    num: "LP",
  });
  spools.lp.add(spinner);

  function gasRow({ parent, x, spool, kind, material, count, chordScale, twist, camber, thick, sweep, vsv, data }) {
    const hub = coreHub(x) + (kind === "stator" ? 0.01 : 0);
    const tip = coreTip(x) - 0.014;
    const span = tip - hub;
    if (span < 0.045) return;
    const chord = Math.min(0.15, Math.max(0.04, span * chordScale));
    addRow({
      parent,
      x,
      hub,
      count,
      pitch: kind === "stator" ? 0.12 : 0,
      vsv,
      material,
      blade: {
        span,
        rootChord: chord,
        tipChord: chord * 0.72,
        rootTwist: twist[0],
        tipTwist: twist[1],
        rootThick: thick,
        tipThick: thick * 0.7,
        camber,
        sweep,
      },
      data: { spool, ...data },
    });
    if (kind === "rotor") {
      const hole = spool === "hp" ? 0.23 : spool === "ip" ? 0.16 : 0.09;
      addAnnulus(parent, x, hole, hub - 0.005, material, {
        mod: data.mod,
        spool,
        verb: data.verb,
        line: data.line,
        num: data.num,
      });
    }
  }

  const ranges = [
    { name: "IPC", spool: "ip", parent: spools.ip, x0: 0.98, x1: 2.02, n: 6, vsv: 2 },
    { name: "HPC", spool: "hp", parent: spools.hp, x0: 2.28, x1: 3.28, n: 8, vsv: 3 },
  ];
  for (const range of ranges) {
    for (let i = 0; i < range.n; i++) {
      const x = range.x0 + ((i + 0.2) * (range.x1 - range.x0)) / range.n;
      gasRow({
        parent: range.parent,
        x,
        spool: range.spool,
        kind: "rotor",
        material: range.name === "HPC" && i >= 4 ? mats.nickel : mats.titanium,
        count: 30 + i * 2,
        chordScale: 0.62,
        twist: [0.48, 0.2],
        camber: 0.05,
        thick: 0.11,
        sweep: 0.02,
        data: {
          mod: range.name.toLowerCase(),
          verb: "SQUEEZE",
          line:
            range.name === "HPC" && i >= 4
              ? "Nickel from this stage aft. The air is already hot, and no fuel has burned."
              : range.name === "HPC"
                ? "Titanium here. Each rotor is a small push. This model shows the rows; a machine of this class has on the order of fifty."
                : "A small push on the core stream — intermediate compressor.",
          num: `${range.name} ${i + 1}`,
        },
      });
      const xs = x + (range.x1 - range.x0) / range.n * 0.48;
      const variable = i < range.vsv;
      gasRow({
        parent: group,
        x: xs,
        spool: "static",
        kind: "stator",
        material: mats.titanium,
        count: 34 + i,
        chordScale: 0.5,
        twist: [0.28, 0.1],
        camber: 0.04,
        thick: 0.1,
        sweep: 0,
        vsv: variable,
        data: {
          mod: range.name.toLowerCase(),
          verb: variable ? "MATCH" : "STRAIGHTEN",
          line: variable
            ? "Closes at low speed so the air meets the blade at a survivable angle — variable stator."
            : "Straightens the air and raises its pressure — stator.",
          num: variable ? "VSV" : `${range.name} STATOR`,
        },
      });
    }
  }

  const ogvX = 0.7;
  addRow({
    parent: group,
    x: ogvX,
    hub: 0.72,
    count: 34,
    pitch: 0.08,
    material: mats.titanium,
    blade: {
      span: FAN_TIP - 0.08 - 0.72,
      rootChord: 0.16,
      tipChord: 0.12,
      rootTwist: 0.22,
      tipTwist: 0.04,
      rootThick: 0.08,
      tipThick: 0.05,
      camber: 0.035,
      sweep: 0.04,
    },
    data: {
      mod: "ogv",
      spool: "static",
      verb: "STRAIGHTEN",
      line: "Takes the swirl out of the bypass so the push is axial — outlet guide vane.",
      num: "OGV",
    },
  });

  const vanes = [
    { x: 3.84, mod: "hpt", mat: mats.hot, num: "NGV", line: "The hottest metal in the engine. It turns the gas onto the rotor — HP nozzle guide vane." },
    { x: 4.42, mod: "ipt", mat: mats.warm, num: "NGV", line: "Turns the gas onto the intermediate turbine — nozzle guide vane." },
    { x: 4.82, mod: "lpt", mat: mats.nickel, num: "NGV", line: "Turns the gas onto the fan's turbine — nozzle guide vane." },
  ];
  for (const vane of vanes) {
    gasRow({
      parent: group,
      x: vane.x,
      spool: "static",
      kind: "stator",
      material: vane.mat,
      count: 42,
      chordScale: 0.62,
      twist: [0.42, 0.14],
      camber: 0.06,
      thick: 0.16,
      sweep: 0,
      data: { mod: vane.mod, verb: "TURN", line: vane.line, num: vane.num },
    });
  }

  const turbines = [
    { spool: "hp", parent: spools.hp, x: 3.98, n: "HPT 1", mat: mats.hot, line: "Extracts just enough work to drive the compressor that did the squeezing — high-pressure turbine." },
    { spool: "hp", parent: spools.hp, x: 4.2, n: "HPT 2", mat: mats.hot, line: "The second stage finishes paying the compressor — high-pressure turbine." },
    { spool: "ip", parent: spools.ip, x: 4.55, n: "IPT", mat: mats.warm, line: "Drives the intermediate compressor — intermediate turbine." },
  ];
  for (const row of turbines) {
    gasRow({
      parent: row.parent,
      x: row.x,
      spool: row.spool,
      kind: "rotor",
      material: row.mat,
      count: row.spool === "hp" ? 52 : 46,
      chordScale: 0.7,
      twist: [0.4, 0.16],
      camber: 0.07,
      thick: 0.15,
      sweep: 0.03,
      data: { mod: row.spool === "hp" ? "hpt" : "ipt", verb: "EXTRACT", line: row.line, num: row.n },
    });
  }
  for (let i = 0; i < 5; i++) {
    const x = 4.95 + i * 0.22;
    gasRow({
      parent: spools.lp,
      x,
      spool: "lp",
      kind: "rotor",
      material: mats.warm,
      count: 58 + i * 4,
      chordScale: 0.55,
      twist: [0.36, 0.12],
      camber: 0.06,
      thick: 0.12,
      sweep: 0.02,
      data: {
        mod: "lpt",
        verb: "DRIVE",
        line: "Turns the fan through the long inner shaft — low-pressure turbine.",
        num: `LPT ${i + 1}`,
      },
    });
    const shroud = new THREE.Mesh(
      new THREE.TorusGeometry(Math.max(0.2, coreTip(x) - 0.02), 0.011, 6, 28),
      mats.nickel,
    );
    shroud.rotation.y = Math.PI / 2;
    shroud.position.x = x;
    tag(shroud, {
      mod: "lpt",
      spool: "lp",
      verb: "SHROUD",
      line: "The LP blades carry a shroud. The HP blades are open at the tip.",
      num: "LPT",
    });
    spools.lp.add(shroud);
  }

  // Cooling holes on one HPT blade, spinning with the HP spool.
  {
    const x = 3.98;
    const hub = coreHub(x);
    const span = coreTip(x) - 0.014 - hub;
    const angle = -0.9;
    const count = 18;
    const holeMat = new THREE.MeshBasicMaterial({ color: 0xd5e8f4 });
    holeMat.clippingPlanes = [clipPlane];
    const holes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0032, 5, 4), holeMat, count);
    qSpin.setFromAxisAngle(AXIS_X, angle);
    for (let i = 0; i < count; i++) {
      const along = 0.18 + (i % 6) / 5 * 0.7;
      const row = Math.floor(i / 6);
      const local = new THREE.Vector3(0.004 + row * 0.008, span * along, 0.009);
      local.applyQuaternion(qSpin);
      dummy.position.set(x + local.x, Math.cos(angle) * hub + local.y, Math.sin(angle) * hub + local.z);
      dummy.quaternion.identity();
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      holes.setMatrixAt(i, dummy.matrix);
    }
    holes.instanceMatrix.needsUpdate = true;
    tag(holes, {
      mod: "hpt",
      spool: "hp",
      verb: "SURVIVE",
      line: "Holes in the metal, fed by compressor air. About a tenth of the core flow is spent keeping this blade alive.",
      num: "HPT",
    });
    spools.hp.add(holes);
  }

  function addShell(profile, mat, data) {
    const geo = latheAlongX(profile, 72);
    const mesh = new THREE.Mesh(geo, mat);
    tag(mesh, { spool: "static", case: true, ...data });
    group.add(mesh);
    cases.push(mesh);
    const ghost = new THREE.Mesh(geo, mats.ghost);
    ghost.scale.set(1.003, 1.012, 1.012);
    ghost.userData.ghost = true;
    ghost.raycast = () => {};
    ghost.castShadow = false;
    ghost.visible = false;
    group.add(ghost);
    ghosts.push(ghost);
    const inner = new THREE.Mesh(
      latheAlongX(profile.map(([x, r]) => [x, Math.max(0.02, r * 0.972)]), 56),
      mats.inner,
    );
    inner.userData = { engine: true, spool: "static", case: true, noPick: true, ...data };
    inner.raycast = () => {};
    inner.castShadow = false;
    group.add(inner);
  }

  const duct = [
    [-1.52, 2.12],
    [-1.2, 1.9],
    [-0.78, 1.74],
  ];
  for (let x = -0.35; x <= 6.5; x += 0.32) duct.push([x, bypassTip(x) + 0.075]);
  addShell(duct, mats.carbon, {
    mod: "case",
    verb: "CONTAIN",
    line: "The cold river runs inside this duct — fan case and bypass.",
    num: "NACELLE",
  });

  const core = [
    [0.4, 0.02],
    [0.58, 0.32],
    [0.78, 0.66],
  ];
  for (let x = 0.95; x <= 6.42; x += 0.28) core.push([x, coreTip(x) + 0.02]);
  addShell(core, mats.nickel, {
    mod: "split",
    verb: "DIVIDE",
    line: "Splits the river. Outside stays cold. Inside goes to the fire — splitter and core cowl.",
    num: "CORE",
  });

  const linerProfile = [];
  for (let i = 0; i <= 10; i++) {
    const x = THREE.MathUtils.lerp(3.4, 3.9, i / 10);
    linerProfile.push([x, coreTip(x) + 0.03]);
  }
  const liner = new THREE.Mesh(latheAlongX(linerProfile, 40), mats.liner);
  tag(liner, {
    mod: "burn",
    spool: "static",
    case: true,
    verb: "BURN",
    line: "A continuous ring. Most of the air here cools the liner and shapes the gas — annular combustor.",
    num: "20 NOZZLES",
  });
  group.add(liner);
  cases.push(liner);

  const flame = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.07, 12, 48), mats.flame);
  flame.rotation.y = Math.PI / 2;
  flame.position.x = 3.66;
  flame.userData = {
    engine: true,
    mod: "burn",
    spool: "static",
    verb: "BURN",
    line: "The only fire in the engine. It is a ring, not a pulse — combustor.",
    num: "TIT",
  };
  flame.renderOrder = 3;
  group.add(flame);
  const primary = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.032, 10, 36),
    new THREE.MeshBasicMaterial({
      color: 0xfff4dc,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  primary.rotation.y = Math.PI / 2;
  primary.position.x = 3.66;
  primary.userData = {
    engine: true,
    mod: "burn",
    spool: "static",
    verb: "GAS",
    line: "Gas in the primary zone. The liner around it stays far cooler than this.",
    num: "T GAS",
  };
  primary.renderOrder = 4;
  group.add(primary);

  const dilution = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.04, 6),
    mats.inner,
    36,
  );
  for (let i = 0; i < 36; i++) {
    const a = (i / 18) * Math.PI * 2;
    const row = i < 18 ? 0 : 1;
    const r = coreTip(3.62) + 0.03;
    qSpin.setFromAxisAngle(AXIS_X, a);
    dummy.position.set(3.55 + row * 0.16, Math.cos(a) * r, Math.sin(a) * r);
    dummy.quaternion.copy(qSpin);
    dummy.updateMatrix();
    dilution.setMatrixAt(i, dummy.matrix);
  }
  dilution.instanceMatrix.needsUpdate = true;
  tag(dilution, {
    mod: "burn",
    spool: "static",
    verb: "DILUTE",
    line: "Most of the air entering this module does not burn. These holes cool the liner and shape the gas.",
    num: "DILUTION",
  });
  group.add(dilution);

  const manifold = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.012, 8, 32), mats.fuel);
  manifold.rotation.y = Math.PI / 2;
  manifold.position.x = 3.4;
  tag(manifold, {
    mod: "burn",
    spool: "static",
    verb: "FEED",
    line: "Fuel arrives here, already used as a coolant on its way — manifold.",
    num: "FUEL",
  });
  group.add(manifold);

  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.07, 7), mats.fuel);
    nozzle.position.set(3.4, Math.cos(a) * 0.5, Math.sin(a) * 0.5);
    qSpin.setFromAxisAngle(AXIS_X, a);
    const qSwirl = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.7, 0, -Math.PI / 2));
    nozzle.quaternion.copy(qSpin).multiply(qSwirl);
    tag(nozzle, {
      mod: "burn",
      spool: "static",
      verb: "SPRAY",
      line: "The nozzle swirls the spray so the flame stays in the primary zone — fuel injector.",
      num: `${i + 1}`,
    });
    group.add(nozzle);
  }

  const aux = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 0.46), mats.stand);
  box.position.set(2.55, -1.98, 0);
  tag(box, {
    mod: "gear",
    spool: "static",
    audio: "oil",
    verb: "FEED",
    line: "Fuel, oil, electrics, hydraulics. Without this the gas path is a sculpture — accessory gearbox.",
    num: "AUX",
  });
  const gen = new THREE.Mesh(cylinderX(0.14, 0.14, 0.36, 16), mats.steel);
  gen.rotation.y = Math.PI / 2;
  gen.position.set(2.55, -1.98, 0.38);
  tag(gen, {
    mod: "gear",
    spool: "static",
    audio: "oil",
    verb: "FEED",
    line: "Driven by the high-pressure spool — generator.",
    num: "GEN",
  });
  const drive = new THREE.Mesh(cylinderX(0.035, 0.035, 1.45, 10), mats.steel);
  drive.rotation.z = Math.PI / 2;
  drive.position.set(2.55, -1.15, 0);
  tag(drive, {
    mod: "gear",
    spool: "static",
    verb: "DRIVE",
    line: "A radial shaft off the high-pressure spool — gearbox drive.",
    num: "HP",
  });
  aux.add(box, gen, drive);
  group.add(aux);

  const fuelLine = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(2.7, -1.75, 0.16),
        new THREE.Vector3(3.15, -1.15, 0.36),
        new THREE.Vector3(3.4, -0.2, 0.5),
      ]),
      24,
      0.012,
      6,
      false,
    ),
    mats.fuel,
  );
  tag(fuelLine, {
    mod: "gear",
    spool: "static",
    verb: "FEED",
    line: "One saturated line. Fuel, on its way to the ring — fuel pipe.",
    num: "FUEL",
  });
  group.add(fuelLine);

  function addBearing(x, radius, role) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.018, 8, 18), mats.steel);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = x;
    tag(ring, {
      mod: "shafts",
      spool: "static",
      verb: role === "thrust" ? "THRUST" : "HOLD",
      line:
        role === "thrust"
          ? "This one carries the axial load. The oil film is the only thing between the races."
          : "This one only holds the shaft up. The thrust is carried at the other bearing.",
      num: role === "thrust" ? "THRUST" : "RADIAL",
    });
    const film = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.01, 6, 14), mats.oil);
    film.rotation.y = Math.PI / 2;
    film.position.x = x;
    tag(film, {
      mod: "shafts",
      spool: "static",
      audio: "oil",
      verb: "WET",
      line: "A film of oil, and nothing else, keeps the shaft from welding itself to the case.",
      num: "OIL",
    });
    group.add(ring, film);
  }
  addBearing(0.16, 0.105, "thrust");
  addBearing(2.32, 0.245, "radial");
  addBearing(4.12, 0.245, "thrust");
  addBearing(5.62, 0.11, "radial");

  for (let i = 0; i < 5; i++) {
    const fin = new THREE.Mesh(new THREE.TorusGeometry(0.232, 0.004, 4, 18), mats.nickel);
    fin.rotation.y = Math.PI / 2;
    fin.position.x = 4.3 + i * 0.016;
    tag(fin, {
      mod: "hpt",
      spool: "hp",
      verb: "SEAL",
      line: "Knives on the shaft, a static land outside them. The gas does not get a straight leak path.",
      num: "LABYRINTH",
    });
    spools.hp.add(fin);
  }

  const scavenge = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(4.12, -0.28, 0.1),
        new THREE.Vector3(3.4, -1.1, 0.2),
        new THREE.Vector3(2.7, -1.7, 0.12),
      ]),
      20,
      0.012,
      6,
      false,
    ),
    mats.oil,
  );
  tag(scavenge, {
    mod: "gear",
    spool: "static",
    audio: "oil",
    verb: "RETURN",
    line: "Oil leaves the bearing and goes back to the tank. It is a circuit, not a decoration.",
    num: "SCAVENGE",
  });
  group.add(scavenge);

  const loadCell = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.16), mats.steel);
  loadCell.position.set(1.15, -2.15, 0.62);
  tag(loadCell, {
    mod: "case",
    spool: "static",
    verb: "LOAD",
    line: "Thrust comes down the link into this cell. The bellmouth ahead of the fan is a test inlet, not the one on the wing.",
    num: "kN",
  });
  const thrustLink = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.85, 0.07), mats.steel);
  thrustLink.position.set(1.15, -1.55, 0.62);
  tag(thrustLink, {
    mod: "case",
    spool: "static",
    verb: "LOAD",
    line: "The stand carries the push. Nothing here is the pylon on the airplane.",
    num: "LINK",
  });
  group.add(loadCell, thrustLink);

  const stationMarks = [];
  for (const station of STATIONS) {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#14181c";
    ctx.fillRect(0, 0, 160, 64);
    ctx.strokeStyle = "#8c867c";
    ctx.strokeRect(3, 3, 154, 58);
    ctx.fillStyle = "#e7e2d8";
    ctx.font = "600 28px sans-serif";
    ctx.fillText(station.id, 12, 42);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.09),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    plate.position.set(station.x, -1.85, 2.35);
    tag(plate, {
      mod: "case",
      spool: "static",
      verb: "STN",
      line: `${station.name}. The same mark is on the pressure trace.`,
      num: station.id,
      stationId: station.id,
    });
    stationMarks.push(plate);
    group.add(plate);
  }

  const lip = new THREE.Mesh(new THREE.TorusGeometry(1.78, 0.045, 10, 48), mats.titanium);
  lip.rotation.y = Math.PI / 2;
  lip.position.x = -0.7;
  tag(lip, {
    mod: "fan",
    spool: "static",
    case: true,
    verb: "ADMIT",
    line: "The lip that keeps the river attached — inlet highlight.",
    num: "STN 1",
  });
  group.add(lip);
  cases.push(lip);

  for (const x of [1.15, 2.7, 4.7]) {
    const flange = new THREE.Mesh(
      new THREE.TorusGeometry(bypassTip(x) + 0.1, 0.028, 8, 36),
      mats.titanium,
    );
    flange.rotation.y = Math.PI / 2;
    flange.position.x = x;
    tag(flange, {
      mod: "case",
      spool: "static",
      case: true,
      verb: "JOIN",
      line: "A bolted joint between case sections — flange.",
      num: "FLANGE",
    });
    group.add(flange);
    cases.push(flange);
  }

  const boltGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6);
  const bolts = new THREE.InstancedMesh(boltGeo, mats.steel, 28);
  const boltR = bypassTip(2.7) + 0.1;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    qSpin.setFromAxisAngle(AXIS_X, a);
    dummy.position.set(2.7, Math.cos(a) * boltR, Math.sin(a) * boltR);
    dummy.quaternion.copy(qSpin);
    dummy.updateMatrix();
    bolts.setMatrixAt(i, dummy.matrix);
  }
  bolts.instanceMatrix.needsUpdate = true;
  tag(bolts, {
    mod: "case",
    spool: "static",
    case: true,
    verb: "JOIN",
    line: "The fastening you should be able to read up close — bolt circle.",
    num: "28",
  });
  group.add(bolts);

  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.2),
    new THREE.MeshPhysicalMaterial({
      map: makeNameplateTexture(),
      metalness: 0.4,
      roughness: 0.45,
      clippingPlanes: [clipPlane],
    }),
  );
  plate.position.set(0.2, 1.15, bypassTip(0.2) + 0.12);
  plate.lookAt(0.2, 1.15, 8);
  tag(plate, {
    mod: "case",
    spool: "static",
    case: true,
    verb: "NAME",
    line: "Lyra 110. Three spools, bypass ratio 10, overall pressure ratio 50.",
    num: "LYRA",
  });
  group.add(plate);

  const cone = new THREE.Mesh(
    latheAlongX(
      [
        [5.9, 0.4],
        [6.25, 0.22],
        [6.6, 0.03],
      ],
      24,
    ),
    mats.nickel,
  );
  tag(cone, {
    mod: "nozzle",
    spool: "static",
    verb: "FAIR",
    line: "Closes the hub so the core exhaust leaves as a clean annulus — tail cone.",
    num: "CORE",
  });
  group.add(cone);

  const tabGeo = new THREE.BoxGeometry(0.2, 0.09, 0.028);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = bypassTip(6.32);
    const tab = new THREE.Mesh(tabGeo, mats.carbon);
    qSpin.setFromAxisAngle(AXIS_X, a);
    const toe = new THREE.Quaternion().setFromAxisAngle(AXIS_Z, i % 2 === 0 ? 0.4 : -0.4);
    tab.position.set(6.42, Math.cos(a) * r, Math.sin(a) * r);
    tab.quaternion.copy(qSpin).multiply(toe);
    tag(tab, {
      mod: "nozzle",
      spool: "static",
      verb: "MIX",
      line: "Mixes the cold jet with the outside air so the engine is quieter — chevron.",
      num: "NOISE",
    });
    group.add(tab);
  }

  const bleedMat = mats.bleed.clone();
  const bleedJet = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 10), bleedMat);
  bleedJet.position.set(2.55, 0.15, bypassTip(2.55) + 0.42);
  bleedJet.rotation.x = Math.PI / 2;
  bleedJet.userData = {
    engine: true,
    mod: "bleed",
    spool: "static",
    verb: "BLEED",
    line: "Handling bleed, mid compressor, overboard. Open for start and low speed. Shut once the core can swallow its air.",
    num: "HANDLING",
  };
  group.add(bleedJet);

  const customerMat = mats.bleed.clone();
  customerMat.color.set(0xc5d4e4);
  const customer = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.55, 8), customerMat);
  customer.rotation.x = Math.PI / 2;
  customer.position.set(3.2, 0.55, bypassTip(3.2) + 0.5);
  customer.userData = {
    engine: true,
    mod: "bleed",
    spool: "static",
    verb: "SUPPLY",
    line: "Customer bleed. Cabin and wing. A different port from the handling valve.",
    num: "CUSTOMER",
  };
  group.add(customer);

  const tipShockGeo = new THREE.BoxGeometry(0.05, 0.1, 0.008);
  const tipShocks = new THREE.InstancedMesh(tipShockGeo, mats.shock, 22);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    qSpin.setFromAxisAngle(AXIS_X, a);
    dummy.position.set(0.14, Math.cos(a) * (FAN_TIP - 0.08), Math.sin(a) * (FAN_TIP - 0.08));
    dummy.quaternion.copy(qSpin);
    dummy.updateMatrix();
    tipShocks.setMatrixAt(i, dummy.matrix);
  }
  tipShocks.instanceMatrix.needsUpdate = true;
  tipShocks.userData.engine = false;
  spools.lp.add(tipShocks);

  for (const [x, z] of [
    [0.35, 1],
    [2.4, 1],
    [4.0, 1],
  ]) {
    const boss = new THREE.Mesh(cylinderX(0.03, 0.04, 0.08, 8), mats.steel);
    const r = bypassTip(x) + 0.1;
    boss.position.set(x, 0.15, Math.sign(z) * r);
    boss.lookAt(x, 0, 0);
    tag(boss, {
      mod: "case",
      spool: "static",
      case: true,
      verb: "SENSE",
      line: "Speed, temperature, or pressure. The control reads the engine through this boss.",
      num: "PROBE",
    });
    group.add(boss);
  }

  function setSection(section) {
    const zCut = THREE.MathUtils.lerp(2.45, -0.02, section);
    clipPlane.normal.set(0, 0, -1);
    clipPlane.constant = zCut;
    mats.ghost.opacity = 0.02 + section * 0.075;
    const show = section > 0.03;
    for (const ghost of ghosts) ghost.visible = show;
    const open = section > 0.4;
    for (const shell of cases) {
      if (shell.userData.noPick) {
        shell.raycast = () => {};
        continue;
      }
      shell.raycast = open ? () => {} : THREE.Mesh.prototype.raycast;
    }
  }

  function update(state) {
    const closed = 1 - THREE.MathUtils.clamp(state.n3, 0, 1);
    for (const row of vsvs) {
      layoutRow(row.mesh, row.spec, row.base + closed * 0.95);
    }
    const hotness = state.lit ? 0.15 + (state.fuel || 0) * 0.85 : 0;
    mats.hot.emissiveIntensity = hotness * 0.28;
    mats.warm.emissiveIntensity = hotness * 0.08;
    mats.liner.emissiveIntensity = hotness * 0.1;
    mats.flame.uniforms.uTime.value = state.time;
    mats.flame.uniforms.uPower.value = state.lit ? 0.22 + (state.fuel || 0) * 0.8 : 0;
    primary.material.opacity = state.lit ? 0.25 + (state.fuel || 0) * 0.65 : 0;
    const spoolOf = { fan: "lp", lpt: "lp", ogv: "lp", ipc: "ip", ipt: "ip", hpc: "hp", hpt: "hp", burn: "hp", bleed: "hp", gear: "hp" };
    const activeSpool = state.solo && state.solo !== "all" ? state.solo : spoolOf[state.module];
    for (const key of ["lp", "ip", "hp"]) {
      if (shaftMats[key]) shaftMats[key].emissiveIntensity = activeSpool === key ? 0.85 : 0;
    }
    mats.shock.opacity = THREE.MathUtils.smoothstep(0.82, 0.96, state.n1) * 0.7;
    const handling = state.phase === "crank" || state.phase === "light" || (state.lit && state.n3 < 0.36);
    bleedJet.scale.set(1, handling ? 1 : 0.001, 1);
    bleedJet.material.opacity = handling ? 0.55 : 0;
    bleedJet.visible = handling;
    const supply = Boolean(state.lit) && state.n3 > 0.48;
    customer.visible = supply;
    customer.material.opacity = supply ? 0.45 : 0;
  }

  setSection(0);
  group.traverse((obj) => {
    if (obj.userData?.engine) obj.userData.homeX = obj.position.x;
  });

  return { group, spools, setSection, update, materials: mats, stationMarks };
}
