import * as THREE from "three";

function physical(opts, clipPlane) {
  const mat = new THREE.MeshPhysicalMaterial({
    roughness: 0.35,
    metalness: 0.85,
    side: THREE.DoubleSide,
    ...opts,
  });
  mat.clippingPlanes = [clipPlane];
  mat.clipShadows = true;
  return mat;
}

export function createMaterials(clipPlane) {
  const titanium = physical(
    { color: 0xb7c2cb, metalness: 0.82, roughness: 0.38, clearcoat: 0.04, clearcoatRoughness: 0.5 },
    clipPlane,
  );
  const fan = physical(
    {
      color: 0xffffff,
      metalness: 0.28,
      roughness: 0.46,
      clearcoat: 0.12,
      clearcoatRoughness: 0.55,
      vertexColors: true,
    },
    clipPlane,
  );
  const nickel = physical(
    { color: 0xb7ada3, metalness: 0.88, roughness: 0.28 },
    clipPlane,
  );
  const hot = physical(
    {
      color: 0x8a7368,
      metalness: 0.74,
      roughness: 0.34,
      emissive: 0xff3a16,
      emissiveIntensity: 0,
    },
    clipPlane,
  );
  const warm = physical(
    {
      color: 0x9a8b80,
      metalness: 0.8,
      roughness: 0.32,
      emissive: 0x9a3410,
      emissiveIntensity: 0,
    },
    clipPlane,
  );
  const carbon = physical(
    { color: 0x23282e, metalness: 0.14, roughness: 0.62, clearcoat: 0.05, clearcoatRoughness: 0.6 },
    clipPlane,
  );
  const steel = physical(
    { color: 0x8d949c, metalness: 0.9, roughness: 0.3 },
    clipPlane,
  );
  const stand = physical(
    { color: 0x3a4046, metalness: 0.7, roughness: 0.46 },
    clipPlane,
  );
  const fuel = physical(
    { color: 0xe39a28, metalness: 0.45, roughness: 0.32 },
    clipPlane,
  );
  const oil = physical(
    {
      color: 0x0c6a45,
      metalness: 0.08,
      roughness: 0.22,
      transparent: true,
      opacity: 0.78,
    },
    clipPlane,
  );
  const bleed = physical(
    {
      color: 0xd5e2ee,
      metalness: 0,
      roughness: 0.4,
      transparent: true,
      opacity: 0.28,
      emissive: 0xc5d7e6,
      emissiveIntensity: 0.5,
      depthWrite: false,
    },
    clipPlane,
  );
  const liner = physical(
    {
      color: 0x4a4038,
      metalness: 0.42,
      roughness: 0.55,
      emissive: 0xff5a24,
      emissiveIntensity: 0,
    },
    clipPlane,
  );
  const inner = physical(
    { color: 0x101418, metalness: 0.35, roughness: 0.62, side: THREE.BackSide },
    clipPlane,
  );
  const ghost = new THREE.MeshPhysicalMaterial({
    color: 0x8d98a3,
    metalness: 0.05,
    roughness: 0.28,
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const lattice = new THREE.MeshBasicMaterial({
    color: 0x9eb0c2,
    wireframe: true,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  lattice.clippingPlanes = [clipPlane];

  const flame = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    clippingPlanes: [clipPlane],
    uniforms: {
      uTime: { value: 0 },
      uPower: { value: 0 },
    },
    vertexShader: /* glsl */ `
      #include <clipping_planes_pars_vertex>
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        #include <clipping_planes_vertex>
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      #include <clipping_planes_pars_fragment>
      uniform float uTime;
      uniform float uPower;
      varying vec2 vUv;
      void main() {
        #include <clipping_planes_fragment>
        float streak = smoothstep(0.42, 0.0, abs(fract(vUv.x * 9.0 - uTime * 0.28) - 0.5));
        float band = smoothstep(0.08, 0.38, vUv.y) * smoothstep(0.96, 0.55, vUv.y);
        float flick = 0.86 + 0.14 * sin(uTime * 11.0 + vUv.x * 24.0);
        vec3 hot = mix(vec3(1.0, 0.32, 0.05), vec3(1.0, 0.86, 0.62), band);
        float alpha = band * flick * (0.35 + 0.65 * streak) * uPower;
        gl_FragColor = vec4(hot, alpha);
      }
    `,
  });

  const shock = new THREE.MeshBasicMaterial({
    color: 0xd5e6ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  return {
    titanium,
    fan,
    nickel,
    hot,
    warm,
    carbon,
    steel,
    stand,
    fuel,
    oil,
    bleed,
    liner,
    inner,
    ghost,
    lattice,
    flame,
    shock,
  };
}

export function paintNameplate(canvas) {
  const g = canvas.getContext("2d");
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = "#14181c";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.strokeStyle = "#8c867c";
  g.lineWidth = 6;
  g.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  g.fillStyle = "#e7e1d6";
  g.font = '600 72px "Barlow Condensed", "Arial Narrow", sans-serif';
  g.fillText("LYRA 110", 36, 92);
  g.fillStyle = "#b7b1a4";
  g.font = '400 22px "IBM Plex Mono", ui-monospace, monospace';
  g.fillText("THREE SPOOL   BPR 10   OPR 50", 36, 132);
}

export function makeNameplateTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 180;
  paintNameplate(canvas);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  document.fonts?.ready?.then(() => {
    paintNameplate(canvas);
    tex.needsUpdate = true;
  });
  return tex;
}

export function concreteTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const g = canvas.getContext("2d");
  g.fillStyle = "#6a6762";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = 70 + Math.random() * 55;
    g.fillStyle = `rgba(${v},${v - 3},${v - 6},0.18)`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  g.strokeStyle = "rgba(28,26,22,0.45)";
  g.lineWidth = 3;
  for (let i = 0; i <= 512; i += 128) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 512);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i);
    g.lineTo(512, i);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function gratingTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext("2d");
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = "#8b939c";
  for (let i = 0; i < 256; i += 16) {
    g.fillRect(0, i, 256, 3);
    g.fillRect(i, 0, 3, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function linerHolesTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext("2d");
  g.fillStyle = "#5a5048";
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#1a120e";
  for (let y = 10; y < 256; y += 18) {
    for (let x = 8; x < 256; x += 18) {
      g.beginPath();
      g.arc(x, y, 2.2, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
