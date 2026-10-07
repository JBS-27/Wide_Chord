import * as THREE from "three";
import { ENGINE_Y } from "./spec.js";
import { concreteTexture, gratingTexture } from "./materials.js";

function makeTechnician() {
  const group = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: 0x2c3330, roughness: 0.86, metalness: 0.04 });
  const helm = new THREE.MeshStandardMaterial({ color: 0x1a1e22, roughness: 0.4, metalness: 0.35 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.15, metalness: 0.6 });
  const cuff = new THREE.MeshStandardMaterial({ color: 0xc47b1a, roughness: 0.45, metalness: 0.25 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.42, 4, 8), cloth);
  torso.position.y = 1.05;
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.18), cloth);
  hips.position.y = 0.72;
  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.42, 3, 6), cloth);
  legL.position.set(-0.09, 0.38, 0);
  const legR = legL.clone();
  legR.position.x = 0.09;
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.34, 3, 6), cloth);
  armL.position.set(-0.24, 1.05, 0);
  armL.rotation.z = 0.18;
  const armR = armL.clone();
  armR.position.x = 0.24;
  armR.rotation.z = -0.18;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), helm);
  head.scale.y = 1.05;
  head.position.y = 1.58;
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 0.04), visor);
  slit.position.set(0, 1.57, 0.09);
  const cupGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.04, 10);
  const cupL = new THREE.Mesh(cupGeo, cuff);
  cupL.rotation.z = Math.PI / 2;
  cupL.position.set(-0.11, 1.6, 0);
  const cupR = cupL.clone();
  cupR.position.x = 0.11;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.02), cuff);
  band.position.set(0, 1.6, 0);

  group.add(torso, hips, legL, legR, armL, armR, head, slit, cupL, cupR, band);
  group.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return group;
}

export function createCell() {
  const group = new THREE.Group();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 28),
    new THREE.MeshStandardMaterial({
      map: concreteTexture(),
      color: 0x6a6864,
      roughness: 0.94,
      metalness: 0.02,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const steel = new THREE.MeshStandardMaterial({ color: 0x23282d, roughness: 0.55, metalness: 0.62 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x12161a, roughness: 0.9, metalness: 0.08 });

  const far = new THREE.Mesh(new THREE.PlaneGeometry(22, 7.2), wallMat);
  far.position.set(3, 3.5, -5.2);
  group.add(far);

  const left = new THREE.Mesh(new THREE.PlaneGeometry(16, 7.2), wallMat);
  left.position.set(-6.2, 3.5, 1.5);
  left.rotation.y = Math.PI / 2;
  group.add(left);

  const right = new THREE.Mesh(new THREE.PlaneGeometry(16, 7.2), wallMat);
  right.position.set(12.2, 3.5, 1.5);
  right.rotation.y = -Math.PI / 2;
  group.add(right);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(22, 16), wallMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(3, 6.7, 1.2);
  group.add(ceiling);

  for (let i = 0; i < 14; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 5.4, 0.16), steel);
    slat.position.set(-2.4 + i * 0.85, 3.1, -4.95);
    group.add(slat);
  }

  const grateMat = new THREE.MeshStandardMaterial({
    map: gratingTexture(),
    color: 0xffffff,
    metalness: 0.55,
    roughness: 0.4,
    transparent: true,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
  });
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.1), grateMat);
  walk.rotation.x = -Math.PI / 2;
  walk.position.set(2.4, 0.04, 4.15);
  walk.receiveShadow = true;
  group.add(walk);

  const railMat = new THREE.MeshStandardMaterial({ color: 0x6d747c, metalness: 0.8, roughness: 0.35 });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(12, 0.04, 0.04), railMat);
  rail.position.set(2.4, 0.92, 3.15);
  group.add(rail);
  for (let i = 0; i < 8; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.92, 0.04), railMat);
    post.position.set(-3.2 + i * 1.6, 0.46, 3.15);
    group.add(post);
  }

  function pylon(x) {
    const top = ENGINE_Y - 1.72;
    const g = new THREE.Group();
    for (const z of [-0.42, 0.42]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, top, 0.14), steel);
      post.position.set(0, top / 2, z);
      post.castShadow = true;
      g.add(post);
    }
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 1.1), steel);
    saddle.position.y = top;
    g.add(saddle);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 1.3), steel);
    foot.position.y = 0.03;
    g.add(foot);
    g.position.x = x;
    return g;
  }
  group.add(pylon(1.15), pylon(4.85));

  const beam = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 0.1), steel);
  beam.position.set(3, 0.08, 0.55);
  group.add(beam);

  const stripe = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.12),
    new THREE.MeshBasicMaterial({ color: 0xc4552a }),
  );
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.set(-1.7, 0.015, 0.85);
  group.add(stripe);

  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0 });
  const housing = new THREE.MeshStandardMaterial({ color: 0x2a2e32, metalness: 0.7, roughness: 0.4 });
  const lamps = [];
  for (const [x, z] of [
    [-0.4, 2.4],
    [3.2, 2.2],
    [6.0, 2.5],
  ]) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.28), housing);
    const tube = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.08), lampMat);
    box.position.set(x, 6.45, z);
    tube.position.set(x, 6.39, z);
    group.add(box, tube);
    lamps.push(tube);
  }

  const detuner = new THREE.Mesh(
    new THREE.CylinderGeometry(2.15, 2.35, 2.4, 28, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x1a1e22,
      metalness: 0.4,
      roughness: 0.7,
      side: THREE.DoubleSide,
    }),
  );
  detuner.rotation.z = Math.PI / 2;
  detuner.position.set(8.6, ENGINE_Y, 0);
  group.add(detuner);

  const technician = makeTechnician();
  technician.position.set(-1.85, 0, 0.35);
  technician.rotation.y = Math.PI / 2;
  group.add(technician);

  const hemi = new THREE.HemisphereLight(0xb7c4d2, 0x2a211c, 0.28);
  const key = new THREE.DirectionalLight(0xf2f4f8, 0.85);
  key.position.set(6, 11, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 40;
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 12;
  key.shadow.camera.bottom = -12;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.04;

  const workA = new THREE.SpotLight(0xffb15e, 180, 22, 0.7, 0.65, 1);
  workA.position.set(-0.4, 6.3, 2.4);
  workA.target.position.set(0.2, ENGINE_Y, 0);
  const workB = new THREE.SpotLight(0xd5e4ff, 140, 24, 0.75, 0.7, 1);
  workB.position.set(4.5, 6.3, 3.2);
  workB.target.position.set(3.2, ENGINE_Y, 0);
  const hot = new THREE.PointLight(0xff5a32, 0, 7, 2);
  hot.position.set(3.9, ENGINE_Y + 0.2, 0.4);
  const fill = new THREE.PointLight(0x9eb0c4, 8, 14, 2);
  fill.position.set(2.4, ENGINE_Y, 1.6);

  group.add(hemi, key, workA, workA.target, workB, workB.target, hot, fill);

  return {
    group,
    technician,
    lamps,
    lights: { hemi, key, workA, workB, hot, fill },
    walls: [far, left, right, ceiling],
  };
}
