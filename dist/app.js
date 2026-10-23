import { createEyeScene } from './eye-scene.js';
import { PARTS, VISION_STEPS, SOURCES, MODEL_NOTE } from './content.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
let selectedId = 'cornea';
let mode = 'anatomy';
let view = 'cutaway';
let labelsVisible = true;
let rotating = false;
let tourIndex = -1;
let visionIndex = -1;
let engine;
let toastTimer;
const visited = new Set();
const labels = new Map();
const categories = { cornea: 'OUTER STRUCTURE', iris: 'ANTERIOR STRUCTURE', pupil: 'LIGHT ENTRY', lens: 'FOCUSING STRUCTURE', vitreous: 'INNER CHAMBER', retina: 'INNER LAYER', choroid: 'MIDDLE LAYER', sclera: 'OUTER LAYER', 'optic-nerve': 'NEURAL CONNECTION' };

PARTS.forEach((part, index) => {
  const button = document.createElement('button');
  button.className = 'part-button';
  button.dataset.part = part.id;
  button.style.setProperty('--part-color', part.color);
  button.innerHTML = `<span class="part-number">${String(index + 1).padStart(2, '0')}</span><span class="part-color"></span><span class="part-name">${part.name}</span><span class="part-chevron">↗</span>`;
  button.addEventListener('click', () => choosePart(part.id));
  $('#part-list').append(button);
  const label = document.createElement('button');
  label.className = 'scene-label invisible';
  label.textContent = part.name;
  label.setAttribute('aria-label', `Explore ${part.name.toLowerCase()}`);
  label.tabIndex = -1;
  label.addEventListener('click', (event) => { event.stopPropagation(); choosePart(part.id); });
  $('#scene-labels').append(label);
  labels.set(part.id, label);
});

function choosePart(id) {
  if (mode !== 'anatomy') setMode('anatomy');
  if (tourIndex >= 0) endTour();
  selectPart(id, true);
}

function selectPart(id, scroll = false) {
  const part = PARTS.find((entry) => entry.id === id);
  if (!part) return;
  selectedId = id;
  visited.add(id);
  const index = PARTS.indexOf(part);
  $('#detail-index').textContent = `STRUCTURE ${String(index + 1).padStart(2, '0')} / 09`;
  $('#detail-category').textContent = categories[id];
  $('#detail-name').textContent = part.name;
  $('#detail-subtitle').textContent = part.subtitle;
  $('#detail-description').textContent = part.description;
  $('#detail-function').textContent = part.function;
  $('#detail-fact').textContent = part.fact;
  $('#detail-source').href = part.sourceUrl;
  $('.detail-panel').style.setProperty('--part-color', part.color);
  $$('.part-button').forEach((button) => {
    const active = button.dataset.part === id;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  labels.forEach((label, key) => label.classList.toggle('selected', key === id));
  engine?.selectPart(id);
  if (scroll && window.innerWidth <= 760) $(`[data-part="${id}"]`).scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest', inline: 'center' });
}

function updateLabels(positions) {
  const occupied = [];
  const mobile = window.innerWidth <= 760;
  const max = mobile ? 4 : 6;
  const container = $('#scene');
  const w = container.clientWidth;
  const h = container.clientHeight;
  const sorted = [...positions].sort((a,b) => (a.id === selectedId ? -1 : b.id === selectedId ? 1 : 0));
  const shown = new Set();
  sorted.forEach(({ id, x, y, visible }) => {
    const label = labels.get(id);
    if (!label) return;
    const width = id === 'optic-nerve' ? 106 : 82;
    const px = Math.max(width / 2 + 3, Math.min(w - width / 2 - 3, x));
    const py = Math.max(15, Math.min(h - 15, y));
    const collision = occupied.some((point) => Math.abs(point.x - px) < (point.width + width) / 2 + 10 && Math.abs(point.y - py) < 36);
    const show = labelsVisible && visible && shown.size < max && !collision && x > 0 && x < w && y > 0 && y < h;
    label.classList.toggle('invisible', !show);
    label.setAttribute('aria-hidden', String(!show));
    if (show) {
      label.style.left = `${px}px`;
      label.style.top = `${py}px`;
      occupied.push({ x: px, y: py, width });
      shown.add(id);
    }
  });
  labels.forEach((label, id) => { if (!shown.has(id)) label.classList.add('invisible'); });
}

function setExplosion(value) {
  const amount = Math.max(0, Math.min(100, Math.round(value)));
  $('#explode').value = amount;
  $('#explode').style.setProperty('--progress', `${amount}%`);
  $('#explode-value').innerHTML = `${amount}<span>%</span>`;
  $('#explode').setAttribute('aria-valuetext', `${amount} percent separated`);
  engine?.setExplode(amount / 100);
}

function setView(next, amount) {
  view = next;
  engine?.setView(next);
  $$('[data-view]').forEach((button) => {
    const active = button.dataset.view === next;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  setExplosion(amount ?? ({ whole: 0, cutaway: 32, exploded: 88 }[next]));
  $('#scene-status').textContent = next === 'whole' ? 'WHOLE EYE / INTERACTIVE 3D' : next === 'exploded' ? 'EXPLODED ANATOMY / INTERACTIVE 3D' : 'CUTAWAY ANATOMY / INTERACTIVE 3D';
}

function setMode(next) {
  mode = next;
  $('#app').classList.toggle('vision-mode', next === 'vision');
  $$('[data-mode]').forEach((button) => {
    const active = button.dataset.mode === next;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  engine?.setLightPath(next === 'vision');
  if (next === 'vision') { endTour(); visionIndex = 0; setView('cutaway', 12); updateVision(); }
  else { visionIndex = -1; setView('cutaway'); updateVision(); }
}

function updateVision() {
  const active = mode === 'vision';
  $('#journey-steps').hidden = !active;
  if (active) {
    const step = VISION_STEPS[visionIndex];
    $('#journey-title').textContent = step.title;
    $('#journey-description').textContent = step.description;
    $('#journey-action').innerHTML = `${visionIndex === VISION_STEPS.length - 1 ? 'Explore again' : 'Next step'} ${icon('arrow')}`;
    $$('.journey-step').forEach((button, i) => { button.classList.toggle('active', i === visionIndex); button.classList.toggle('visited', i < visionIndex); button.setAttribute('aria-current', i === visionIndex ? 'step' : 'false'); });
    selectPart(step.partId, true);
  } else {
    $('#journey-title').textContent = 'A remarkable journey.';
    $('#journey-description').textContent = 'Follow light through the eye and discover how you see.';
    $('#journey-action').innerHTML = `Follow the light ${icon('arrow')}`;
  }
}
VISION_STEPS.forEach((step, i) => {
  const button = document.createElement('button');
  button.className = 'journey-step';
  button.setAttribute('aria-label', `Step ${i + 1}: ${step.title}`);
  button.addEventListener('click', () => { visionIndex = i; updateVision(); });
  $('#journey-steps').append(button);
});

function startTour() {
  if (mode !== 'anatomy') setMode('anatomy');
  tourIndex = 0;
  setView('cutaway', 42);
  $('#tour-bar').hidden = false;
  $('#start-tour').textContent = 'Restart tour';
  updateTour();
}
function updateTour() {
  const part = PARTS[tourIndex];
  selectPart(part.id, true);
  $('#tour-progress').textContent = `GUIDED TOUR / ${String(tourIndex + 1).padStart(2, '0')} OF 09`;
  $('#tour-instruction').textContent = `${tourIndex === 0 ? 'First, meet' : 'Discover'} the ${part.name.toLowerCase()}.`;
  $('#tour-next').innerHTML = `${tourIndex === PARTS.length - 1 ? 'Finish tour' : 'Next structure'} ${icon('arrow')}`;
}
function endTour() {
  tourIndex = -1;
  $('#tour-bar').hidden = true;
  $('#start-tour').innerHTML = `Guided tour ${icon('arrow')}`;
}
function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3000);
}
function toggleLabels() {
  labelsVisible = !labelsVisible;
  engine?.setLabels(labelsVisible);
  $('#toggle-labels').classList.toggle('active', labelsVisible);
  $('#toggle-labels').setAttribute('aria-pressed', String(labelsVisible));
  if (!labelsVisible) labels.forEach((label) => label.classList.add('invisible'));
}
function toggleRotation() {
  rotating = !rotating;
  engine?.setAutoRotate(rotating);
  $('#auto-rotate').classList.toggle('active', rotating);
  $('#auto-rotate').setAttribute('aria-pressed', String(rotating));
}
function reset() {
  endTour();
  if (mode !== 'anatomy') setMode('anatomy');
  engine?.reset();
  setView('cutaway');
  rotating = false;
  $('#auto-rotate').classList.remove('active');
  $('#auto-rotate').setAttribute('aria-pressed', 'false');
  if (!labelsVisible) toggleLabels();
  selectPart('cornea', true);
  toast('A fresh perspective. View reset.');
}

$$('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
$$('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
$('#explode').addEventListener('input', (event) => {
  if (view === 'whole') setView('cutaway', event.target.value);
  else setExplosion(event.target.value);
});
$('#zoom-in').addEventListener('click', () => engine?.zoom(1));
$('#zoom-out').addEventListener('click', () => engine?.zoom(-1));
$('#auto-rotate').addEventListener('click', toggleRotation);
$('#toggle-labels').addEventListener('click', toggleLabels);
$('#reset').addEventListener('click', reset);
$('#part-prev').addEventListener('click', () => choosePart(PARTS[(PARTS.findIndex((part) => part.id === selectedId) + PARTS.length - 1) % PARTS.length].id));
$('#part-next').addEventListener('click', () => choosePart(PARTS[(PARTS.findIndex((part) => part.id === selectedId) + 1) % PARTS.length].id));
$('#start-tour').addEventListener('click', startTour);
$('#tour-close').addEventListener('click', endTour);
$('#tour-next').addEventListener('click', () => { if (tourIndex >= PARTS.length - 1) { endTour(); toast('You’ve explored all nine structures. Keep looking closer.'); } else { tourIndex++; updateTour(); } });
$('#journey-action').addEventListener('click', () => { if (mode !== 'vision') setMode('vision'); else { visionIndex = (visionIndex + 1) % VISION_STEPS.length; updateVision(); } });
$('#fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { toast('Use your browser’s full-screen option for a larger view.'); }
});
document.addEventListener('fullscreenchange', () => { $('#fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit full screen' : 'Enter full screen'); });
$('#model-note').textContent = MODEL_NOTE;
SOURCES.forEach((source) => {
  const link = document.createElement('a');
  link.href = source.url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.innerHTML = `<span>${source.title}</span>${icon('arrow')}`;
  $('#source-list').append(link);
});
$('#about-button').addEventListener('click', () => $('#about-dialog').showModal());
$('#close-about').addEventListener('click', () => $('#about-dialog').close());
$('#about-dialog').addEventListener('click', (event) => { if (event.target === $('#about-dialog')) { const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close(); } });
document.addEventListener('keydown', (event) => {
  if (['INPUT', 'TEXTAREA', 'BUTTON', 'A'].includes(document.activeElement.tagName) || $('#about-dialog').open || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key.toLowerCase() === 'r') reset();
  if (event.key.toLowerCase() === 'l') toggleLabels();
  if (event.key === '+' || event.key === '=') engine?.zoom(1);
  if (event.key === '-') engine?.zoom(-1);
});

selectPart('cornea');
try {
  engine = createEyeScene($('#scene'), {
    onSelect: (id) => choosePart(id),
    onReady: () => { $('#scene-loading').hidden = true; $('#scene-loading').style.display = 'none'; },
    onLabelPositions: updateLabels,
  });
  engine.selectPart(selectedId);
  setView('cutaway');
} catch (error) {
  $('#scene-loading').innerHTML = '<div class="scene-error"><strong>A different perspective.</strong><p>The 3D view needs WebGL, which is unavailable in this browser. You can still explore every structure using the anatomy index and follow how vision works.</p></div>';
  $('#scene-status').textContent = 'ANATOMY EXPLORER / TEXT VIEW';
  console.error('Unable to initialize the eye model:', error);
}
window.addEventListener('pagehide', () => engine?.destroy(), { once: true });
