import * as THREE from './vendor/three.module.js';

// An enlarged teaching section, not a measured cup-to-disc ratio.
export function createNerveDetail(container) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 30);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x081720, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'nerve-detail-canvas';
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline-offset:-3px;';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-roledescription', 'interactive 3D model');
  canvas.tabIndex = 0;
  container.appendChild(canvas);

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
  overlay.setAttribute('aria-hidden', 'true');
  container.appendChild(overlay);
  const labels = ['Cup', 'Nerve tissue rim'].map(text => {
    const label = document.createElement('span'); label.textContent = text;
    label.style.cssText = 'position:absolute;padding:4px 6px;border:1px solid rgba(144,205,220,.27);border-radius:5px;background:rgba(8,25,35,.88);color:#e0edf2;font-family:inherit;font-size:11px;font-weight:500;line-height:1.2;white-space:nowrap;transform:translate(-50%,-50%);';
    overlay.appendChild(label); return label;
  });

  const tissue = new THREE.Group(); tissue.rotation.y = -.08; scene.add(tissue);
  const hemisphere = new THREE.HemisphereLight(0xc7e1e8, 0x403134, .7); scene.add(hemisphere);
  const key = new THREE.DirectionalLight(0xffe1c5, 3.2);
  key.position.set(-3.6, 4.8, 2.2); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -1.7, right: 1.7, top: 1.7, bottom: -1.7, near: .5, far: 12 });
  key.shadow.bias = -.00015; key.shadow.normalBias = .014; key.shadow.radius = 3;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8cc8d6, .65); fill.position.set(3, 1, 3); scene.add(fill);
  const backlight = new THREE.DirectionalLight(0xffb7a2, .8); backlight.position.set(0, 3, -4); scene.add(backlight);

  const radialSteps = 48, angularSteps = 112, outerRadius = 1;
  // Removing the front 120 degrees exposes a section through the recess.
  const startAngle = Math.PI * 5 / 6, angleRange = Math.PI * 4 / 3, baseY = -.76;
  const rimColor = new THREE.Color(0xc47f73), cupColor = new THREE.Color(0xe2cba7);
  const sectionTop = new THREE.Color(0xdba18b), sectionBase = new THREE.Color(0x9e635e), tint = new THREE.Color();
  let amount = 1, targetAmount = 1, comparing = false, visible = false, destroyed = false, frame = 0, lastTime = 0;
  let azimuth = .30, polar = .85, width = 1, height = 1, pointer = null;
  const lookAt = new THREE.Vector3(0, -.16, -.04), projected = new THREE.Vector3();

  function profile(radius, value = amount) {
    const cupRadius = THREE.MathUtils.lerp(.29, .67, value);
    const depth = THREE.MathUtils.lerp(.18, .49, value);
    const cup = 1 - THREE.MathUtils.smoothstep(radius, cupRadius * .10, cupRadius);
    const surface = .03 + .055 * (1 - radius * radius);
    return { y: surface - depth * cup, cup };
  }
  function geometry(positions, indices, colors) {
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (colors) result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    result.setIndex(indices); result.computeVertexNormals(); return result;
  }
  function mesh(shape, material) {
    const result = new THREE.Mesh(shape, material); result.castShadow = result.receiveShadow = true;
    tissue.add(result); return result;
  }
  const surfaceMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .79, metalness: 0 });
  const sectionMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .9, side: THREE.DoubleSide });
  const outerMaterial = new THREE.MeshStandardMaterial({ color: 0xb87c70, roughness: .86, side: THREE.DoubleSide });
  const topPositions = [0, 0, 0], topColors = [1, 1, 1], topIndices = [];
  for (let row = 1; row <= radialSteps; row++) for (let col = 0; col <= angularSteps; col++) {
    const radius = row / radialSteps, theta = startAngle + col / angularSteps * angleRange;
    topPositions.push(Math.cos(theta) * radius, 0, Math.sin(theta) * radius); topColors.push(1, 1, 1);
  }
  for (let col = 0; col < angularSteps; col++) topIndices.push(0, col + 2, col + 1);
  for (let row = 1; row < radialSteps; row++) for (let col = 0; col < angularSteps; col++) {
    const a = 1 + (row - 1) * (angularSteps + 1) + col, b = a + angularSteps + 1;
    topIndices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const surface = mesh(geometry(topPositions, topIndices, topColors), surfaceMaterial);

  const cutSections = [];
  for (const theta of [startAngle, startAngle + angleRange]) {
    const positions = [], colors = [], indices = [];
    for (let row = 0; row <= radialSteps; row++) {
      const radius = row / radialSteps, x = Math.cos(theta) * radius, z = Math.sin(theta) * radius;
      positions.push(x, 0, z, x, baseY, z); colors.push(1, 1, 1, sectionBase.r, sectionBase.g, sectionBase.b);
      if (row < radialSteps) { const a = row * 2; indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    }
    cutSections.push(mesh(geometry(positions, indices, colors), sectionMaterial));
  }
  const wallPositions = [], wallIndices = [];
  for (let col = 0; col <= angularSteps; col++) {
    const theta = startAngle + col / angularSteps * angleRange, x = Math.cos(theta) * outerRadius, z = Math.sin(theta) * outerRadius;
    wallPositions.push(x, profile(1).y, z, x, baseY, z);
    if (col < angularSteps) { const a = col * 2; wallIndices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); }
  }
  mesh(geometry(wallPositions, wallIndices), outerMaterial);

  // A few surface vessels provide context without implying a diagnostic pattern.
  const vesselMaterial = new THREE.MeshStandardMaterial({ color: 0x974d48, roughness: .7 });
  const vesselAngles = [3.45, 5.93];
  const vessels = vesselAngles.map(() => mesh(new THREE.BufferGeometry(), vesselMaterial));
  function updateShape() {
    const positions = surface.geometry.attributes.position, colors = surface.geometry.attributes.color;
    for (let i = 0; i < positions.count; i++) {
      const radius = Math.hypot(positions.getX(i), positions.getZ(i)), { y, cup } = profile(radius);
      positions.setY(i, y); tint.copy(rimColor).lerp(cupColor, THREE.MathUtils.smoothstep(cup, .06, .88));
      colors.setXYZ(i, tint.r, tint.g, tint.b);
    }
    positions.needsUpdate = colors.needsUpdate = true;
    surface.geometry.computeVertexNormals(); surface.geometry.computeBoundingSphere();
    for (const section of cutSections) {
      const points = section.geometry.attributes.position, sectionColors = section.geometry.attributes.color;
      for (let row = 0; row <= radialSteps; row++) {
        const { y, cup } = profile(row / radialSteps); points.setY(row * 2, y);
        tint.copy(sectionTop).lerp(cupColor, cup * .6); sectionColors.setXYZ(row * 2, tint.r, tint.g, tint.b);
      }
      points.needsUpdate = sectionColors.needsUpdate = true;
      section.geometry.computeVertexNormals(); section.geometry.computeBoundingSphere();
    }
    vessels.forEach((vessel, index) => {
      const points = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, radius = .06 + t * .92;
        const theta = vesselAngles[index] + Math.sin(t * Math.PI) * (index ? -.12 : .14);
        points.push(new THREE.Vector3(Math.cos(theta) * radius, profile(radius).y + .012, Math.sin(theta) * radius));
      }
      vessel.geometry.dispose();
      vessel.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 50, index ? .010 : .013, 6, false);
    });
  }
  updateShape();

  function updateCamera() {
    // Fixed distance preserves a stable reference during comparison.
    const distance = width / height < 1.1 ? 4.4 : 3.9;
    camera.position.set(distance * Math.sin(polar) * Math.sin(azimuth), distance * Math.cos(polar), distance * Math.sin(polar) * Math.cos(azimuth)).add(lookAt);
    camera.lookAt(lookAt); camera.updateMatrixWorld();
  }
  function placeLabel(label, point, dx = 0, dy = 0) {
    projected.copy(point); tissue.localToWorld(projected); projected.project(camera);
    const x = THREE.MathUtils.clamp((projected.x * .5 + .5) * width + dx, 29, width - 35);
    const y = THREE.MathUtils.clamp((-.5 * projected.y + .5) * height + dy, 15, height - 15);
    label.style.left = `${x}px`; label.style.top = `${y}px`;
  }
  function render() {
    updateCamera(); renderer.render(scene, camera);
    placeLabel(labels[0], new THREE.Vector3(.11, profile(.11).y, .09), 12, 3);
    const radius = .83, theta = 4.6;
    placeLabel(labels[1], new THREE.Vector3(Math.cos(theta) * radius, profile(radius).y, Math.sin(theta) * radius), -4, -17);
  }
  function resize() {
    width = Math.max(1, container.clientWidth); height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    if (visible) render();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container); resize();
  function tick(now) {
    if (!visible || destroyed) return;
    const dt = Math.min((now - (lastTime || now)) / 1000, .05); lastTime = now;
    const previous = amount;
    amount = reducedMotion ? targetAmount : THREE.MathUtils.damp(amount, targetAmount, 8, dt);
    if (Math.abs(amount - targetAmount) < .0005) amount = targetAmount;
    if (previous !== amount) updateShape();
    render(); frame = requestAnimationFrame(tick);
  }
  function updateDescription() {
    canvas.setAttribute('aria-label', `Three-dimensional cutaway of the optic nerve head. ${comparing ? 'Typical reference with a smaller, shallower cup and a wider nerve tissue rim.' : 'Glaucoma schematic with a wider, deeper cup and a narrower nerve tissue rim.'} Drag or use arrow keys to rotate this detail.`);
    container.dataset.comparison = comparing ? 'typical' : 'glaucoma';
  }
  function reset() { azimuth = .30; polar = .85; if (visible) render(); }
  function onPointerDown(event) {
    if (event.button !== 0) return;
    event.stopPropagation(); pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing';
  }
  function onPointerMove(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    event.stopPropagation();
    azimuth = THREE.MathUtils.clamp(azimuth - (event.clientX - pointer.x) * .008, -.55, .80);
    polar = THREE.MathUtils.clamp(polar - (event.clientY - pointer.y) * .006, .58, 1.17);
    pointer.x = event.clientX; pointer.y = event.clientY;
  }
  function onPointerUp(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    event.stopPropagation(); if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    pointer = null; canvas.style.cursor = 'grab';
  }
  function onKeyDown(event) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Home') reset();
    else if (event.key === 'ArrowLeft') azimuth = Math.max(-.55, azimuth - .10);
    else if (event.key === 'ArrowRight') azimuth = Math.min(.80, azimuth + .10);
    else if (event.key === 'ArrowUp') polar = Math.max(.58, polar - .08);
    else polar = Math.min(1.17, polar + .08);
  }
  canvas.addEventListener('pointerdown', onPointerDown); canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp); canvas.addEventListener('pointercancel', onPointerUp); canvas.addEventListener('keydown', onKeyDown);
  updateDescription();

  return {
    setComparison(value) { comparing = !!value; targetAmount = comparing ? 0 : 1; updateDescription(); if (reducedMotion) { amount = targetAmount; updateShape(); if (visible) render(); } },
    setVisible(value) {
      if (destroyed || visible === !!value) return;
      visible = !!value; cancelAnimationFrame(frame); lastTime = 0;
      if (visible) { resize(); frame = requestAnimationFrame(tick); }
      else pointer = null;
    },
    reset,
    destroy() {
      if (destroyed) return; destroyed = true; cancelAnimationFrame(frame); resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown); canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp); canvas.removeEventListener('pointercancel', onPointerUp); canvas.removeEventListener('keydown', onKeyDown);
      const geometries = new Set(), materials = new Set();
      scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); });
      geometries.forEach(shape => shape.dispose()); materials.forEach(material => material.dispose());
      renderer.dispose(); canvas.remove(); overlay.remove();
    },
  };
}
