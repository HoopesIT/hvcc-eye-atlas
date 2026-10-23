import * as THREE from './vendor/three.module.js';

// An original, procedural teaching model. All geometry is built locally.
export function createEyeScene(container, callbacks = {}) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 80);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x061219, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.domElement.className = 'eye-canvas';
  renderer.domElement.setAttribute('aria-label', 'Interactive three-dimensional human eye. Drag to rotate, hold Shift or choose Move eye to reposition, and scroll or pinch to zoom.');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none;';
  container.appendChild(renderer.domElement);

  const model = new THREE.Group();
  scene.add(model);
  const anatomy = new Map();
  const pickables = [];
  const disposableTextures = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const cameraDirection = new THREE.Vector3(-0.45, 0.19, 0.873).normalize();
  const cameraRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), cameraDirection).normalize();
  const cameraUp = new THREE.Vector3().crossVectors(cameraDirection, cameraRight).normalize();
  const cameraTarget = new THREE.Vector3();
  const state = { view: 'cutaway', explode: 0.32, selected: null, labels: true, autoRotate: false, lightPath: false, interactionMode: 'rotate', condition: 'normal', comparing: false };
  const conditionWeights = { keratoconus: 0, astigmatism: 0, cataract: 0, glaucoma: 0 };
  let contourWeight = 0, discDetailWeight = 0;
  let actualExplode = 0.32;
  let rotationX = 0, rotationY = 0, targetX = 0, targetY = 0;
  let zoomActual = 1, zoomTarget = 1;
  let panX = 0, panY = 0, panTargetX = 0, panTargetY = 0, viewportWorldHeight = 4.5;
  let width = 1, height = 1, frame = 0, destroyed = false, startTime = performance.now(), lastTime = startTime;
  let lastLabelTime = 0, dragged = false, pointerDown = null, pinchDistance = 0;
  const pointers = new Map();

  scene.add(new THREE.HemisphereLight(0xcceef6, 0x263543, 2.25));
  const key = new THREE.DirectionalLight(0xfff5e8, 4.1);
  key.position.set(-4, 6, 7); scene.add(key);
  const fill = new THREE.DirectionalLight(0x62bcd1, 1.7);
  fill.position.set(-5, -1, -5); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xe6efff, 3.1);
  rim.position.set(4, 4, -4); scene.add(rim);
  const innerFill = new THREE.PointLight(0xffa17e, 1.8, 8, 2);
  innerFill.position.set(-2.5, 1.2, 3.5); scene.add(innerFill);

  // Small reflection cards provide the wet highlights without external assets.
  const reflectionScene = new THREE.Scene();
  reflectionScene.background = new THREE.Color(0x263b43);
  const cardMat = new THREE.MeshBasicMaterial({ color: 0xd6f8ff, side: THREE.DoubleSide });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(5, 12), cardMat);
  card.position.set(-6, 5, 7); card.lookAt(0, 0, 0); reflectionScene.add(card);
  const card2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 8), new THREE.MeshBasicMaterial({ color: 0x668c9c, side: THREE.DoubleSide }));
  card2.position.set(5, 0, -6); card2.lookAt(0, 0, 0); reflectionScene.add(card2);
  const envGenerator = new THREE.PMREMGenerator(renderer);
  const environment = envGenerator.fromScene(reflectionScene, 0.04);
  scene.environment = environment.texture;
  card.geometry.dispose(); cardMat.dispose(); card2.geometry.dispose(); card2.material.dispose(); envGenerator.dispose();

  function seeded(seed) {
    return () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  }
  function textureFromCanvas(canvas) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    disposableTextures.push(texture);
    return texture;
  }
  function irisTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 1536;
    const ctx = c.getContext('2d'), rnd = seeded(1794), center = 768;
    ctx.fillStyle = '#173f4e'; ctx.fillRect(0, 0, c.width, c.height);
    const wash = ctx.createRadialGradient(center, center, 200, center, center, 745);
    wash.addColorStop(0, '#745e39'); wash.addColorStop(0.18, '#429a9c'); wash.addColorStop(0.5, '#32899c');
    wash.addColorStop(0.84, '#1d6379'); wash.addColorStop(1, '#102a3b');
    ctx.fillStyle = wash; ctx.beginPath(); ctx.arc(center, center, 760, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 2800; i++) {
      const angle = rnd() * Math.PI * 2, from = 225 + rnd() * 155, to = 670 + rnd() * 85;
      const r = rnd(); ctx.strokeStyle = r < 0.24 ? 'rgba(6,30,45,.68)' : r < 0.5 ? 'rgba(138,211,203,.48)' : 'rgba(61,149,167,.7)';
      ctx.lineWidth = .6 + rnd() * 2.3; ctx.beginPath();
      for (let j = 0; j <= 17; j++) {
        const radius = from + (to - from) * j / 17;
        const a = angle + Math.sin(j * .51 + i) * (.004 + rnd() * .008);
        const x = center + Math.cos(a) * radius, y = center + Math.sin(a) * radius;
        j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      } ctx.stroke();
    }
    for (let i = 0; i < 190; i++) {
      const a = i / 190 * Math.PI * 2, r = 305 + rnd() * 28;
      ctx.strokeStyle = `rgba(174,168,99,${.18 + rnd() * .22})`; ctx.lineWidth = 1 + rnd() * 3;
      ctx.beginPath(); ctx.moveTo(center + Math.cos(a) * 228, center + Math.sin(a) * 228);
      ctx.quadraticCurveTo(center + Math.cos(a + .018) * r, center + Math.sin(a + .018) * r, center + Math.cos(a) * (r + 20), center + Math.sin(a) * (r + 20)); ctx.stroke();
    }
    for (const r of [465, 553, 623, 680]) {
      ctx.strokeStyle = 'rgba(5,35,49,.18)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(center, center, r, 0, Math.PI * 2); ctx.stroke();
    }
    return textureFromCanvas(c);
  }
  function tissueTexture(kind) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const ctx = c.getContext('2d'), rnd = seeded(kind === 'sclera' ? 802 : 324);
    ctx.fillStyle = kind === 'sclera' ? '#e5e3d9' : kind === 'retina' ? '#cf775b' : '#542835';
    ctx.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 7500; i++) {
      const bright = rnd() > .5;
      ctx.fillStyle = kind === 'sclera' ? (bright ? 'rgba(255,255,247,.11)' : 'rgba(143,125,113,.045)') : (bright ? 'rgba(255,190,127,.10)' : 'rgba(76,15,27,.065)');
      ctx.beginPath(); ctx.arc(rnd() * 1024, rnd() * 512, .5 + rnd() * 4, 0, Math.PI * 2); ctx.fill();
    }
    if (kind === 'sclera') {
      for (let i = 0; i < 36; i++) {
        const x = rnd() * 1024, y = rnd() * 512;
        ctx.strokeStyle = 'rgba(161,68,66,.22)'; ctx.lineWidth = .45 + rnd() * .8;
        let px = x, py = y; ctx.beginPath(); ctx.moveTo(px, py);
        for (let s = 0; s < 9; s++) { px += (rnd() - .45) * 23; py += (rnd() - .5) * 19; ctx.lineTo(px, py); }
        ctx.stroke();
      }
    }
    const texture = textureFromCanvas(c); texture.wrapS = THREE.RepeatWrapping; return texture;
  }
  function makePart(id) {
    const group = new THREE.Group(); group.userData.part = id; model.add(group); anatomy.set(id, group); return group;
  }
  function addMesh(group, geometry, material, pickable = true) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.part = group.userData.part;
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach(m => { if (m.emissive) { m.userData.baseEmissive = m.emissive.clone(); m.userData.baseIntensity = m.emissiveIntensity; } });
    group.add(mesh); if (pickable) pickables.push(mesh); return mesh;
  }
  function torus(group, radius, tube, material, x = 0) {
    const m = addMesh(group, new THREE.TorusGeometry(radius, tube, 10, 144), material);
    m.rotation.y = Math.PI / 2; m.position.x = x; return m;
  }
  function shellGeometry(radius, maxPhi, segments = 112, rows = 64) {
    const positions = [], normals = [], uv = [], indices = [];
    for (let j = 0; j <= rows; j++) {
      const p = j / rows * maxPhi;
      for (let i = 0; i <= segments; i++) {
        const a = i / segments * Math.PI * 2;
        const x = Math.cos(p), y = Math.sin(p) * Math.cos(a), z = Math.sin(p) * Math.sin(a);
        positions.push(radius * x, radius * y, radius * z); normals.push(x, y, z); uv.push(i / segments, p / Math.PI);
      }
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < segments; i++) {
      const a = j * (segments + 1) + i, b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); return g;
  }
  function bandGeometry(radius, minPhi, maxPhi, segments = 112, rows = 32) {
    const pos = [], norm = [], uv = [], idx = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= segments; i++) {
      const p = minPhi + (maxPhi - minPhi) * j / rows, a = i / segments * Math.PI * 2;
      const x = Math.cos(p), y = Math.sin(p) * Math.cos(a), z = Math.sin(p) * Math.sin(a);
      pos.push(radius * x, radius * y, radius * z); norm.push(x, y, z); uv.push(i / segments, p / Math.PI);
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < segments; i++) { const a = j * (segments + 1) + i, b = a + segments + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
  }
  const sclera = makePart('sclera');
  const scleraMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: tissueTexture('sclera'), roughness: .53, clearcoat: .18, clearcoatRoughness: .35, side: THREE.DoubleSide });
  const scleraPhi = 1.55;
  addMesh(sclera, shellGeometry(1.46, scleraPhi), scleraMat);
  const scleraRim = torus(sclera, Math.sin(scleraPhi) * 1.46, .028, new THREE.MeshStandardMaterial({ color: 0xe7dfcc, roughness: .6 }), Math.cos(scleraPhi) * 1.46);
  const anteriorSclera = addMesh(sclera, bandGeometry(1.46, scleraPhi - .006, 2.49), scleraMat);
  anteriorSclera.visible = false;
  const limbus = torus(sclera, Math.sin(2.49) * 1.46, .027, new THREE.MeshStandardMaterial({ color: 0x9eada9, roughness: .45 }), Math.cos(2.49) * 1.46);
  limbus.visible = false;

  const choroid = makePart('choroid');
  const choroidPhi = 1.68;
  addMesh(choroid, shellGeometry(1.365, choroidPhi), new THREE.MeshStandardMaterial({ color: 0xb36d78, map: tissueTexture('choroid'), roughness: .65, side: THREE.DoubleSide }));
  torus(choroid, Math.sin(choroidPhi) * 1.365, .022, new THREE.MeshStandardMaterial({ color: 0x7d3e4e, roughness: .5 }), Math.cos(choroidPhi) * 1.365);
  const retina = makePart('retina');
  const retinaPhi = 1.79;
  // Leave a small opening for the optic nerve head so its cup is a real recess.
  const discRadius = .115, discPhi = Math.asin(discRadius / 1.29);
  addMesh(retina, bandGeometry(1.29, discPhi, retinaPhi, 112, 64), new THREE.MeshPhysicalMaterial({ color: 0xf3a17e, map: tissueTexture('retina'), roughness: .49, clearcoat: .25, side: THREE.DoubleSide }));
  torus(retina, Math.sin(retinaPhi) * 1.29, .015, new THREE.MeshStandardMaterial({ color: 0xf7b790, roughness: .52 }), Math.cos(retinaPhi) * 1.29);

  // Branching vessels follow the retina's inner spherical surface.
  const vesselMaterial = new THREE.MeshStandardMaterial({ color: 0x8e3d43, roughness: .65, transparent: true, opacity: .8 });
  const vesselFineMaterial = new THREE.MeshStandardMaterial({ color: 0xb34e48, roughness: .65, transparent: true, opacity: .68 });
  const vesselRandom = seeded(1968);
  function vessel(phiStart, phiEnd, angle, bend, radius, material) {
    const pts = [];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28, p = phiStart + (phiEnd - phiStart) * t;
      const a = angle + Math.sin(t * 2.8) * bend + Math.sin(t * 9) * .025;
      pts.push(new THREE.Vector3(1.271 * Math.cos(p), 1.271 * Math.sin(p) * Math.cos(a), 1.271 * Math.sin(p) * Math.sin(a)));
    }
    addMesh(retina, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 36, radius, 5, false), material, false);
  }
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + .15, bend = (vesselRandom() - .5) * .45;
    vessel(.09, 1.54 + vesselRandom() * .16, a, bend, .010, vesselMaterial);
    for (let j = 0; j < 3; j++) vessel(.45 + j * .24, 1.30 + vesselRandom() * .39, a + (j % 2 ? 1 : -1) * (.15 + vesselRandom() * .14), bend * 1.5, .0045, vesselFineMaterial);
  }
  function opticDiscGeometry() {
    const positions = [], colors = [], indices = [], rows = 32, segments = 96;
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= segments; i++) {
      const radius = j / rows * discRadius, angle = i / segments * Math.PI * 2;
      positions.push(0, Math.cos(angle) * radius, Math.sin(angle) * radius);
      colors.push(1, 1, 1);
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < segments; i++) {
      const a = j * (segments + 1) + i, b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices);
    return geometry;
  }
  const opticDiscMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .66, side: THREE.DoubleSide });
  const opticDisc = addMesh(retina, opticDiscGeometry(), opticDiscMat, false);
  opticDisc.position.x = Math.sqrt(1.29 * 1.29 - discRadius * discRadius) - .003;
  const discRimColor = new THREE.Color(0xd8927c), discCupColor = new THREE.Color(0xf1d7af), discColor = new THREE.Color();
  function updateDiscGeometry(geometry, amount) {
    const positions = geometry.attributes.position, colors = geometry.attributes.color;
    // These are illustrative proportions, not diagnostic cup-to-disc cutoffs.
    const cupRadius = THREE.MathUtils.lerp(.035, .076, amount), depth = THREE.MathUtils.lerp(.008, .035, amount);
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i), z = positions.getZ(i), radius = Math.hypot(y, z);
      const cup = 1 - THREE.MathUtils.smoothstep(radius, cupRadius * .08, cupRadius);
      positions.setX(i, depth * cup);
      discColor.copy(discRimColor).lerp(discCupColor, THREE.MathUtils.smoothstep(cup, .02, .72));
      colors.setXYZ(i, discColor.r, discColor.g, discColor.b);
    }
    positions.needsUpdate = true; colors.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  }
  updateDiscGeometry(opticDisc.geometry, 0);
  const fovea = addMesh(retina, new THREE.CircleGeometry(.085, 48), new THREE.MeshStandardMaterial({ color: 0x9e463e, roughness: .5, transparent: true, opacity: .5, side: THREE.DoubleSide }), false);
  fovea.rotation.y = Math.PI / 2; fovea.position.set(1.17, .08, .42); fovea.lookAt(0, 0, 0);

  const nerve = makePart('optic-nerve');
  const nerveCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(1.36, -.04, 0), new THREE.Vector3(1.76, -.07, -.03), new THREE.Vector3(2.15, -.16, -.07), new THREE.Vector3(2.63, -.25, -.19)]);
  addMesh(nerve, new THREE.TubeGeometry(nerveCurve, 44, .205, 32, false), new THREE.MeshPhysicalMaterial({ color: 0xceae71, roughness: .59, clearcoat: .12 }));
  const end = addMesh(nerve, new THREE.CircleGeometry(.193, 48), new THREE.MeshStandardMaterial({ color: 0xf3d9a4, roughness: .65, side: THREE.DoubleSide }));
  end.position.copy(nerveCurve.getPoint(1)); end.lookAt(end.position.clone().add(nerveCurve.getTangent(1)));
  const fiberMat = new THREE.MeshStandardMaterial({ color: 0xe3c78e, roughness: .6, transparent: true, opacity: .65 });
  for (let i = 0; i < 19; i++) {
    const a = i / 19 * Math.PI * 2, pts = [];
    for (let j = 0; j <= 20; j++) { const p = nerveCurve.getPoint(j / 20); p.y += Math.cos(a) * .203; p.z += Math.sin(a) * .203; pts.push(p); }
    addMesh(nerve, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, .005, 4, false), fiberMat, false);
  }

  const vitreous = makePart('vitreous');
  const vitreousMat = new THREE.MeshPhysicalMaterial({ color: 0xa8e1df, roughness: .08, metalness: 0, transmission: .18, transparent: true, opacity: .105, thickness: .35, ior: 1.336, depthWrite: false, side: THREE.DoubleSide });
  addMesh(vitreous, shellGeometry(1.205, 1.96, 88, 48), vitreousMat, false);
  const vitreousEdge = torus(vitreous, Math.sin(1.96) * 1.205, .008, new THREE.MeshBasicMaterial({ color: 0xa7d5d5, transparent: true, opacity: .23, depthWrite: false }), Math.cos(1.96) * 1.205);
  vitreousEdge.raycast = () => {};

  const iris = makePart('iris');
  const irisMat = new THREE.MeshPhysicalMaterial({ map: irisTexture(), color: 0x9fcde3, roughness: .46, clearcoat: .64, clearcoatRoughness: .24, side: THREE.DoubleSide });
  const irisDisk = addMesh(iris, new THREE.RingGeometry(.259, .835, 180, 2), irisMat); irisDisk.rotation.y = Math.PI / 2;
  const backIris = addMesh(iris, new THREE.RingGeometry(.259, .835, 144, 1), new THREE.MeshStandardMaterial({ color: 0x293c38, roughness: .8, side: THREE.DoubleSide }));
  backIris.rotation.y = Math.PI / 2; backIris.position.x = .027;
  const irisRoot = addMesh(iris, new THREE.RingGeometry(.829, .893, 144, 1), new THREE.MeshStandardMaterial({ color: 0x2a4948, roughness: .7, side: THREE.DoubleSide }));
  irisRoot.rotation.y = Math.PI / 2; irisRoot.position.x = .125;
  torus(iris, .831, .021, new THREE.MeshPhysicalMaterial({ color: 0x183f4a, roughness: .33, clearcoat: .45 }));
  torus(iris, .259, .012, new THREE.MeshStandardMaterial({ color: 0x605431, roughness: .58 }), -.005);
  const pupil = makePart('pupil');
  const pupilMesh = addMesh(pupil, new THREE.CircleGeometry(.258, 96), new THREE.MeshBasicMaterial({ color: 0x020b10, side: THREE.DoubleSide }));
  pupilMesh.rotation.y = Math.PI / 2;

  const lens = makePart('lens');
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0xc5e7e0, roughness: .055, transmission: .7, thickness: .28, ior: 1.41, transparent: true, opacity: .46, clearcoat: 1, clearcoatRoughness: .05, side: THREE.DoubleSide, depthWrite: false });
  const lensMesh = addMesh(lens, new THREE.SphereGeometry(1, 88, 56), lensMat); lensMesh.scale.set(.225, .575, .575);
  const normalLensColor = lensMat.color.clone(), cloudyLensColor = new THREE.Color(0xd7c99f);
  torus(lens, .574, .009, new THREE.MeshBasicMaterial({ color: 0xb7e7dc, transparent: true, opacity: .62 }));
  const lensRings = new THREE.Group(); lens.add(lensRings);
  for (let i = 0; i < 3; i++) { const r = .35 + i * .07; const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .0025, 4, 96), new THREE.MeshBasicMaterial({ color: 0xc7f3eb, transparent: true, opacity: .14, depthWrite: false })); ring.rotation.y = Math.PI / 2; ring.position.x = -.225 * Math.sqrt(1 - r * r / (.575 * .575)); lensRings.add(ring); }

  const cornea = makePart('cornea');
  function cornealGeometry() {
    const pos = [], norm = [], uv = [], idx = [], rows = 48, segments = 144;
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= segments; i++) {
      const p = j / rows * Math.PI / 2, a = i / segments * Math.PI * 2;
      const r = .886 * Math.sin(p), x = -.415 * Math.cos(p);
      pos.push(x, Math.cos(a) * r, Math.sin(a) * r); uv.push(i / segments, j / rows);
      const n = new THREE.Vector3(-Math.cos(p) / .415, Math.cos(a) * Math.sin(p) / .886, Math.sin(a) * Math.sin(p) / .886).normalize(); norm.push(n.x, n.y, n.z);
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < segments; i++) { const a = j * (segments + 1) + i, b = a + segments + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
  }
  const corneaMat = new THREE.MeshPhysicalMaterial({ color: 0xc7edf0, roughness: .045, transmission: .76, thickness: .065, ior: 1.376, transparent: true, opacity: .34, clearcoat: 1, clearcoatRoughness: .025, depthWrite: false, side: THREE.DoubleSide });
  const corneaMesh = addMesh(cornea, cornealGeometry(), corneaMat);
  const normalCorneaPositions = corneaMesh.geometry.attributes.position.array.slice();
  const normalCorneaNormals = corneaMesh.geometry.attributes.normal.array.slice();
  torus(cornea, .886, .011, new THREE.MeshBasicMaterial({ color: 0xa1d2d8, transparent: true, opacity: .72, depthWrite: false }));
  // A restrained curved glint makes the cornea legible against the dark canvas.
  const glintPts = [];
  for (let i = 0; i <= 40; i++) { const a = .13 + i / 40 * .8, r = .68; glintPts.push(new THREE.Vector3(-.415 * Math.sqrt(1 - r * r / (.886 * .886)) - .006, Math.cos(a) * r, Math.sin(a) * r)); }
  const glint = new THREE.Line(new THREE.BufferGeometry().setFromPoints(glintPts), new THREE.LineBasicMaterial({ color: 0xdbffff, transparent: true, opacity: .5, depthWrite: false })); cornea.add(glint);
  const normalGlintPositions = glint.geometry.attributes.position.array.slice();
  function cornealSurfaceX(y, z, cone, toric) {
    const q = Math.min(1, (y * y + z * z) / (.886 * .886)), height = Math.sqrt(1 - q);
    const localizedCone = Math.exp(-((y + .16) ** 2 + (z - .05) ** 2) / .105) * Math.pow(1 - q, 1.5);
    // Both deformations meet the original circular limbus. The off-center
    // rounded cone and the two smooth meridians represent different shapes.
    return -.415 * height - cone * .48 * localizedCone - toric * .14 * height * (y * y - z * z) / (.886 * .886);
  }
  const surfaceContours = new THREE.Group(); cornea.add(surfaceContours); surfaceContours.visible = false;
  const contourMaterial = new THREE.LineBasicMaterial({ color: 0x96e6e9, transparent: true, opacity: 0, depthWrite: false });
  const meridianMaterial = new THREE.LineBasicMaterial({ color: 0xe6cf9a, transparent: true, opacity: 0, depthWrite: false });
  const contourLines = [];
  for (const radius of [.18, .35, .52, .70, .82]) {
    const points = [];
    for (let i = 0; i <= 112; i++) { const a = i / 112 * Math.PI * 2; points.push(new THREE.Vector3(0, Math.cos(a) * radius, Math.sin(a) * radius)); }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), contourMaterial); surfaceContours.add(line); contourLines.push(line);
  }
  for (const angle of [0, Math.PI / 2]) {
    const points = [];
    for (let i = 0; i <= 112; i++) { const r = -.88 + i / 112 * 1.76; points.push(new THREE.Vector3(0, Math.cos(angle) * r, Math.sin(angle) * r)); }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), meridianMaterial); surfaceContours.add(line); contourLines.push(line);
  }
  function updateCorneaGeometry() {
    const cone = conditionWeights.keratoconus, toric = conditionWeights.astigmatism, positions = corneaMesh.geometry.attributes.position;
    if (cone === 0 && toric === 0) {
      positions.array.set(normalCorneaPositions); corneaMesh.geometry.attributes.normal.array.set(normalCorneaNormals); corneaMesh.geometry.attributes.normal.needsUpdate = true;
    } else {
      for (let i = 0; i < positions.count; i++) positions.setX(i, cornealSurfaceX(positions.getY(i), positions.getZ(i), cone, toric));
      corneaMesh.geometry.computeVertexNormals();
    }
    positions.needsUpdate = true; corneaMesh.geometry.computeBoundingSphere();
    for (const line of [...contourLines, glint]) {
      const points = line.geometry.attributes.position;
      if (line === glint && cone === 0 && toric === 0) points.array.set(normalGlintPositions);
      else for (let i = 0; i < points.count; i++) points.setX(i, cornealSurfaceX(points.getY(i), points.getZ(i), cone, toric) - (line === glint ? .006 : .007));
      points.needsUpdate = true; line.geometry.computeBoundingSphere();
    }
  }

  // A separate, enlarged teaching detail makes local nerve-head cupping
  // visible without enlarging the optic disc or changing the whole eyeball.
  const discDetail = new THREE.Group(); scene.add(discDetail); discDetail.visible = false;
  discDetail.quaternion.setFromUnitVectors(new THREE.Vector3(-1, 0, 0), cameraDirection);
  const enlargedDiscMat = opticDiscMat.clone(); enlargedDiscMat.transparent = true; enlargedDiscMat.depthTest = false; enlargedDiscMat.depthWrite = false;
  const enlargedDisc = new THREE.Mesh(opticDisc.geometry.clone(), enlargedDiscMat); enlargedDisc.renderOrder = 101; discDetail.add(enlargedDisc);
  const discBacking = new THREE.Mesh(new THREE.CylinderGeometry(discRadius, discRadius, .012, 96, 1, true), new THREE.MeshStandardMaterial({ color: 0xad725f, roughness: .75, side: THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: false }));
  discBacking.rotation.z = Math.PI / 2; discBacking.position.x = .006; discBacking.renderOrder = 100; discDetail.add(discBacking);
  const detailEdge = new THREE.Mesh(new THREE.TorusGeometry(discRadius * 1.10, .0018, 6, 120), new THREE.MeshBasicMaterial({ color: 0x7bbac7, transparent: true, opacity: .7, depthTest: false, depthWrite: false })); detailEdge.rotation.y = Math.PI / 2; detailEdge.position.x = -.004; detailEdge.renderOrder = 102; discDetail.add(detailEdge);
  const discConnector = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x82b9c2, transparent: true, opacity: .32, depthWrite: false, depthTest: false }));
  discConnector.visible = false; discConnector.renderOrder = 99; scene.add(discConnector);
  const nativeDiscWorld = new THREE.Vector3(), detailLabelWorld = new THREE.Vector3();

  function updateConditionGeometry() {
    updateCorneaGeometry(); updateDiscGeometry(opticDisc.geometry, conditionWeights.glaucoma); updateDiscGeometry(enlargedDisc.geometry, conditionWeights.glaucoma);
    const amount = conditionWeights.cataract;
    lensMat.color.copy(normalLensColor).lerp(cloudyLensColor, amount);
    lensMat.transmission = THREE.MathUtils.lerp(.7, .08, amount); lensMat.roughness = THREE.MathUtils.lerp(.055, .43, amount);
    lensMat.opacity = THREE.MathUtils.lerp(.46, .87, amount); lensMat.clearcoat = THREE.MathUtils.lerp(1, .25, amount);
  }
  function updateConditionTransition(dt, instant = false) {
    let changed = false;
    for (const id of Object.keys(conditionWeights)) {
      const goal = state.condition === id && !state.comparing ? 1 : 0, previous = conditionWeights[id];
      let value = instant || reducedMotion ? goal : THREE.MathUtils.damp(previous, goal, 7, dt);
      if (Math.abs(value - goal) < .0005) value = goal;
      conditionWeights[id] = value; changed ||= previous !== value;
    }
    const contourGoal = ['keratoconus', 'astigmatism'].includes(state.condition) ? 1 : 0;
    const detailGoal = state.condition === 'glaucoma' ? 1 : 0;
    contourWeight = instant || reducedMotion ? contourGoal : THREE.MathUtils.damp(contourWeight, contourGoal, 8, dt);
    discDetailWeight = instant || reducedMotion ? detailGoal : THREE.MathUtils.damp(discDetailWeight, detailGoal, 8, dt);
    if (Math.abs(contourWeight - contourGoal) < .0005) contourWeight = contourGoal;
    if (Math.abs(discDetailWeight - detailGoal) < .0005) discDetailWeight = detailGoal;
    surfaceContours.visible = contourWeight > .001; contourMaterial.opacity = contourWeight * .5; meridianMaterial.opacity = contourWeight * .75;
    discDetail.visible = discConnector.visible = discDetailWeight > .001;
    if (changed || instant) updateConditionGeometry();
  }
  function setCondition(id, options = {}) {
    if (!['normal', ...Object.keys(conditionWeights)].includes(id)) return false;
    state.condition = id; state.comparing = id !== 'normal' && !!options.comparing;
    updateConditionTransition(0, options.animate === false); return true;
  }
  function setComparison(value) { state.comparing = state.condition !== 'normal' && !!value; updateConditionTransition(0); }
  function placeDiscDetail() {
    if (!discDetail.visible) return;
    const mobile = width <= 760, worldWidth = viewportWorldHeight * camera.aspect;
    const radius = viewportWorldHeight * (mobile ? .065 : .09);
    discDetail.position.copy(cameraTarget)
      .addScaledVector(cameraRight, worldWidth * (mobile ? .19 : .18))
      .addScaledVector(cameraUp, viewportWorldHeight * (mobile ? .10 : -.17));
    discDetail.scale.setScalar(radius / discRadius * discDetailWeight);
    detailLabelWorld.copy(discDetail.position).addScaledVector(cameraUp, radius * (mobile ? -1.24 : 1.30));
    nativeDiscWorld.copy(opticDisc.position); retina.localToWorld(nativeDiscWorld);
    const line = discConnector.geometry.attributes.position;
    line.setXYZ(0, nativeDiscWorld.x, nativeDiscWorld.y, nativeDiscWorld.z);
    const edge = discDetail.position.clone().addScaledVector(cameraRight, -radius * .76).addScaledVector(cameraUp, radius * .76);
    const elbow = nativeDiscWorld.clone().lerp(edge, .60).addScaledVector(cameraUp, -.08);
    line.setXYZ(1, elbow.x, elbow.y, elbow.z); line.setXYZ(2, edge.x, edge.y, edge.z);
    line.needsUpdate = true; discConnector.geometry.computeBoundingSphere(); discConnector.material.opacity = .4 * discDetailWeight;
  }

  const halo = new THREE.Group(); model.add(halo);
  const haloMat = new THREE.MeshBasicMaterial({ color: 0x76dacb, transparent: true, opacity: .55, depthWrite: false });
  const haloRing = new THREE.Mesh(new THREE.TorusGeometry(1, .007, 6, 160), haloMat); haloRing.rotation.y = Math.PI / 2; halo.add(haloRing); halo.visible = false;

  const guideGroup = new THREE.Group(); scene.add(guideGroup);
  const guideMaterial = new THREE.LineBasicMaterial({ color: 0x41868b, transparent: true, opacity: .10, depthWrite: false });
  for (const radius of [2.28, 2.7]) {
    const pts = [];
    for (let i = 0; i <= 180; i++) { const a = i / 180 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * radius * 1.27, -1.7, Math.sin(a) * radius * .59)); }
    guideGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), guideMaterial));
  }
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 256;
  const sctx = shadowCanvas.getContext('2d'), shadowGradient = sctx.createRadialGradient(128, 128, 3, 128, 128, 125);
  shadowGradient.addColorStop(0, 'rgba(0,0,0,.42)'); shadowGradient.addColorStop(1, 'rgba(0,0,0,0)'); sctx.fillStyle = shadowGradient; sctx.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.7), new THREE.MeshBasicMaterial({ map: textureFromCanvas(shadowCanvas), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(-.1, -1.68, 0); scene.add(shadow);

  const rays = new THREE.Group(); model.add(rays); rays.visible = false;
  const rayPaths = [];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2, offsetY = Math.cos(a) * .43, offsetZ = Math.sin(a) * .43;
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(41 * 3), 3));
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: i % 2 ? 0xbfeec9 : 0x6ce3da, transparent: true, opacity: .73, depthWrite: false }));
    rays.add(line);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.024, 10, 8), new THREE.MeshBasicMaterial({ color: 0xccfff1 })); rays.add(dot);
    rayPaths.push({ line, dot, offsetY, offsetZ, curve: null });
  }
  function updateRayPaths() {
    for (const ray of rayPaths) {
      ray.curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(cornea.position.x - 1.25, ray.offsetY, ray.offsetZ),
        new THREE.Vector3(cornea.position.x - .25, ray.offsetY * .98, ray.offsetZ * .98),
        new THREE.Vector3(iris.position.x, ray.offsetY * .42, ray.offsetZ * .42),
        new THREE.Vector3(lens.position.x, ray.offsetY * .42, ray.offsetZ * .42),
        new THREE.Vector3(retina.position.x + 1.25, .025, .035)
      ], false, 'centripetal', .25);
      const positions = ray.line.geometry.attributes.position;
      for (let j = 0; j <= 40; j++) { const p = ray.curve.getPoint(j / 40); positions.setXYZ(j, p.x, p.y, p.z); }
      positions.needsUpdate = true; ray.line.geometry.computeBoundingSphere();
    }
  }
  function placeParts(e) {
    sclera.position.x = .30 + e * .14;
    choroid.position.x = .30 - e * .08;
    retina.position.x = .30 - e * .30;
    nerve.position.x = sclera.position.x;
    vitreous.position.x = .22 - e * .37;
    iris.position.x = -.98 - e * 1.72;
    pupil.position.x = iris.position.x + .015;
    lens.position.x = -.68 - e * .83;
    cornea.position.x = -.86 - e * 2.72;
    if (state.lightPath) updateRayPaths();
  }
  placeParts(actualExplode);

  function resize() {
    width = Math.max(1, container.clientWidth); height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container); resize();
  function setCamera() {
    const mobile = width <= 760;
    const halfFov = THREE.MathUtils.degToRad(camera.fov * .5);
    // Use the entire screen for the model. On a phone, keep the globe above
    // the information card while still allowing an enlarged eye to pass under it.
    const baseDistance = mobile
      ? 2.92 / (.62 * camera.aspect * 2 * Math.tan(halfFov))
      : 6.6 + actualExplode * 1.05;
    const distance = baseDistance / zoomActual;
    viewportWorldHeight = 2 * distance * Math.tan(halfFov);
    const worldWidth = viewportWorldHeight * camera.aspect;
    panTargetX = THREE.MathUtils.clamp(panTargetX, -worldWidth * .65, worldWidth * .65);
    panTargetY = THREE.MathUtils.clamp(panTargetY, -viewportWorldHeight * .5, viewportWorldHeight * .5);
    cameraTarget.set(-.13 - actualExplode * .22, -.025, 0)
      .addScaledVector(cameraUp, viewportWorldHeight * (mobile ? -.08 : -.015))
      .addScaledVector(cameraRight, -panX)
      .addScaledVector(cameraUp, -panY);
    camera.position.copy(cameraDirection).multiplyScalar(distance).add(cameraTarget);
    camera.lookAt(cameraTarget);
  }
  function pan(deltaX, deltaY) {
    const dx = Number(deltaX), dy = Number(deltaY);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const unitsPerPixel = viewportWorldHeight / height;
    const maxX = viewportWorldHeight * camera.aspect * .65, maxY = viewportWorldHeight * .5;
    panTargetX = THREE.MathUtils.clamp(panTargetX + dx * unitsPerPixel, -maxX, maxX);
    panTargetY = THREE.MathUtils.clamp(panTargetY - dy * unitsPerPixel, -maxY, maxY);
  }
  function setInteractionMode(mode) {
    if (!['rotate', 'pan'].includes(mode)) return;
    state.interactionMode = mode;
    renderer.domElement.style.cursor = pointers.size ? 'grabbing' : 'grab';
  }
  function selectPart(id) {
    if (id !== null && !anatomy.has(id)) return;
    state.selected = id;
    halo.visible = !!id;
    if (id) {
      const p = anatomy.get(id); halo.position.copy(p.position);
      const radii = { cornea: .94, iris: .89, pupil: .31, lens: .63, sclera: 1.53, choroid: 1.43, retina: 1.35, vitreous: 1.26, 'optic-nerve': .25 };
      haloRing.scale.setScalar(radii[id]);
      if (id === 'sclera') halo.position.x += Math.cos(scleraPhi) * 1.46;
      if (id === 'choroid') halo.position.x += Math.cos(choroidPhi) * 1.365;
      if (id === 'retina') halo.position.x += Math.cos(retinaPhi) * 1.29;
      if (id === 'vitreous') halo.position.x -= .30;
      if (id === 'optic-nerve') { halo.position.add(new THREE.Vector3(2.62, -.25, -.19)); }
    }
  }
  function onPointerDown(event) {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    renderer.domElement.setPointerCapture(event.pointerId);
    if (pointers.size === 1) {
      pointerDown = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, rx: targetX, ry: targetY, pan: state.interactionMode === 'pan' || event.shiftKey };
      dragged = false;
    }
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchDistance = Math.hypot(a.x - b.x, a.y - b.y); dragged = true; }
    renderer.domElement.style.cursor = 'grabbing';
  }
  function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance) zoomTarget = THREE.MathUtils.clamp(zoomTarget * d / pinchDistance, .62, 2.4);
      pinchDistance = d; return;
    }
    if (!pointerDown || pointers.size !== 1) return;
    const dx = event.clientX - pointerDown.x, dy = event.clientY - pointerDown.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) dragged = true;
    if (pointerDown.pan) pan(event.clientX - pointerDown.lastX, event.clientY - pointerDown.lastY);
    else { targetY = pointerDown.ry + dx * .006; targetX = THREE.MathUtils.clamp(pointerDown.rx + dy * .0045, -1.25, 1.25); }
    pointerDown.lastX = event.clientX; pointerDown.lastY = event.clientY;
  }
  function onPointerUp(event) {
    const wasSingle = pointers.size === 1;
    pointers.delete(event.pointerId); pinchDistance = 0;
    if (!dragged && wasSingle && pointerDown) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickables, false).filter(h => h.object.visible && h.object.parent.visible);
      if (hits.length) { const id = hits[0].object.userData.part; selectPart(id); callbacks.onSelect?.(id); }
    }
    if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
    if (pointers.size === 1) {
      const remaining = [...pointers.values()][0];
      pointerDown = { x: remaining.x, y: remaining.y, lastX: remaining.x, lastY: remaining.y, rx: targetX, ry: targetY, pan: state.interactionMode === 'pan' || event.shiftKey };
    } else pointerDown = null;
    renderer.domElement.style.cursor = pointers.size ? 'grabbing' : 'grab';
  }
  function onPointerCancel(event) { pointers.delete(event.pointerId); pointerDown = null; pinchDistance = 0; renderer.domElement.style.cursor = 'grab'; }
  function onWheel(event) { event.preventDefault(); zoomTarget = THREE.MathUtils.clamp(zoomTarget * Math.exp(-event.deltaY * .00085), .62, 2.4); }
  renderer.domElement.style.cursor = 'grab';
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerCancel);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

  const labelAnchors = {
    cornea: new THREE.Vector3(-.23, .66, .26), iris: new THREE.Vector3(0, .69, -.03),
    pupil: new THREE.Vector3(-.02, -.02, .03), lens: new THREE.Vector3(-.05, -.47, .27),
    sclera: new THREE.Vector3(.75, .93, .78), choroid: new THREE.Vector3(-.12, -.98, .89),
    retina: new THREE.Vector3(-.2, .92, .80), vitreous: new THREE.Vector3(.1, -.17, .55),
    'optic-nerve': new THREE.Vector3(2.47, -.21, -.16)
  };
  const projected = new THREE.Vector3();
  function emitLabels() {
    if (!callbacks.onLabelPositions) return;
    model.updateMatrixWorld(true);
    const labels = [];
    for (const [id, anchor] of Object.entries(labelAnchors)) {
      projected.copy(anchor); anatomy.get(id).localToWorld(projected); projected.project(camera);
      const hiddenInWhole = state.view === 'whole' && ['lens', 'choroid', 'retina', 'vitreous'].includes(id);
      labels.push({ id, x: (projected.x * .5 + .5) * width, y: (-projected.y * .5 + .5) * height, visible: state.labels && !hiddenInWhole && projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1 });
    }
    projected.copy(detailLabelWorld).project(camera);
    labels.push({ id: 'condition-detail', x: (projected.x * .5 + .5) * width, y: (-projected.y * .5 + .5) * height, visible: state.condition === 'glaucoma' && discDetailWeight > .05 && projected.z > -1 && projected.z < 1 });
    callbacks.onLabelPositions(labels);
  }
  function updateSelection(time, dt) {
    for (const [id, group] of anatomy) group.traverse(obj => {
      if (!obj.isMesh) return;
      for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) {
        if (!mat.emissive || !mat.userData.baseEmissive) continue;
        const goal = state.selected === id ? .23 : mat.userData.baseIntensity;
        mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, goal, 8, dt);
        if (state.selected === id) mat.emissive.set(id === 'retina' || id === 'choroid' ? 0x7d4938 : 0x2c8880);
        else mat.emissive.copy(mat.userData.baseEmissive);
      }
    });
    if (state.selected) {
      const id = state.selected, p = anatomy.get(id); halo.position.copy(p.position);
      if (id === 'sclera') halo.position.x += Math.cos(scleraPhi) * 1.46;
      if (id === 'choroid') halo.position.x += Math.cos(choroidPhi) * 1.365;
      if (id === 'retina') halo.position.x += Math.cos(retinaPhi) * 1.29;
      if (id === 'vitreous') halo.position.x -= .30;
      if (id === 'optic-nerve') halo.position.add(new THREE.Vector3(2.62, -.25, -.19));
      haloMat.opacity = .36 + (reducedMotion ? 0 : Math.sin(time * 1.8) * .1);
    }
  }
  function animate(now) {
    if (destroyed) return;
    frame = requestAnimationFrame(animate);
    const dt = Math.min((now - lastTime) / 1000, .05), time = (now - startTime) / 1000; lastTime = now;
    const prev = actualExplode;
    actualExplode = THREE.MathUtils.damp(actualExplode, state.explode, reducedMotion ? 30 : 5.5, dt);
    if (Math.abs(prev - actualExplode) > .00001) placeParts(actualExplode);
    if (state.autoRotate && !pointers.size && !reducedMotion) targetY += dt * .13;
    rotationY = THREE.MathUtils.damp(rotationY, targetY, 9, dt); rotationX = THREE.MathUtils.damp(rotationX, targetX, 9, dt);
    model.rotation.set(rotationX, rotationY, 0); model.position.y = reducedMotion ? 0 : Math.sin(time * .65) * .035;
    zoomActual = THREE.MathUtils.damp(zoomActual, zoomTarget, 9, dt);
    panX = THREE.MathUtils.damp(panX, panTargetX, 12, dt); panY = THREE.MathUtils.damp(panY, panTargetY, 12, dt); setCamera();
    updateConditionTransition(dt); model.updateMatrixWorld(true); placeDiscDetail();
    updateSelection(time, dt);
    if (state.lightPath) rayPaths.forEach((ray, i) => { if (ray.curve) ray.dot.position.copy(ray.curve.getPoint(reducedMotion ? .6 : (time * .23 + i * .13) % 1)); });
    renderer.render(scene, camera);
    if (now - lastLabelTime > 32) { emitLabels(); lastLabelTime = now; }
  }
  setCamera(); renderer.render(scene, camera); emitLabels(); frame = requestAnimationFrame(animate);
  queueMicrotask(() => { if (!destroyed) callbacks.onReady?.(); });

  return {
    setExplode(value) { state.explode = THREE.MathUtils.clamp(Number(value) || 0, 0, 1); },
    setView(view) {
      if (!['whole', 'cutaway', 'exploded'].includes(view)) return;
      state.view = view; anteriorSclera.visible = view === 'whole'; limbus.visible = view === 'whole'; scleraRim.visible = view !== 'whole';
      state.explode = view === 'whole' ? 0 : view === 'exploded' ? .88 : .32;
      if (view === 'whole') { targetX = -.03; targetY = .18; } else { targetX = 0; targetY = 0; }
      emitLabels();
    },
    selectPart,
    setCondition,
    setComparison,
    focusCondition() {
      if (state.condition === 'keratoconus') { targetX = -.06; targetY = -.20; }
      else if (state.condition === 'astigmatism') { targetX = .10; targetY = .48; }
      else if (state.condition === 'cataract') { targetX = 0; targetY = .16; }
      else { targetX = 0; targetY = 0; }
      const cornealCondition = ['keratoconus', 'astigmatism'].includes(state.condition), mobile = width <= 760;
      const baseWorldHeight = mobile ? 2.92 / (.62 * camera.aspect) : 2 * (6.6 + state.explode * 1.05) * Math.tan(THREE.MathUtils.degToRad(camera.fov * .5));
      panTargetX = cornealCondition ? baseWorldHeight * camera.aspect * (mobile ? .16 : .18) : 0;
      panTargetY = 0; zoomTarget = cornealCondition ? (mobile ? .9 : .8) : 1; state.autoRotate = false;
    },
    setLabels(value) { state.labels = !!value; emitLabels(); },
    setAutoRotate(value) { state.autoRotate = !!value; },
    setLightPath(value) { state.lightPath = !!value; rays.visible = state.lightPath; if (state.lightPath) updateRayPaths(); },
    setInteractionMode,
    pan,
    zoom(delta) { const amount = Number(delta); if (Number.isFinite(amount)) zoomTarget = THREE.MathUtils.clamp(zoomTarget * Math.exp(amount * .12), .62, 2.4); },
    reset() { targetX = 0; targetY = 0; zoomTarget = 1; panTargetX = 0; panTargetY = 0; state.autoRotate = false; setInteractionMode('rotate'); },
    getState() { return { ...state, zoom: zoomTarget, rotation: { x: targetX, y: targetY }, pan: { x: panTargetX, y: panTargetY } }; },
    destroy() {
      if (destroyed) return; destroyed = true; cancelAnimationFrame(frame); resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown); renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp); renderer.domElement.removeEventListener('pointercancel', onPointerCancel); renderer.domElement.removeEventListener('wheel', onWheel);
      const geometries = new Set(), materials = new Set();
      scene.traverse(obj => { if (obj.geometry) geometries.add(obj.geometry); if (obj.material) for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) materials.add(m); });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); disposableTextures.forEach(t => t.dispose()); environment.dispose();
      renderer.dispose(); renderer.domElement.remove();
    }
  };
}
