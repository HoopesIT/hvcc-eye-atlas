import { createEyeScene } from './eye-scene.js?v=nerve-section-5';
import { PARTS, VISION_STEPS, SOURCES, MODEL_NOTE } from './content.js';
import { CONDITIONS, MODEL_CONDITION_NOTE } from './conditions.js?v=nerve-section-5';
import { createNerveDetail } from './nerve-detail.js?v=nerve-section-5';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
let selectedId = 'cornea';
let mode = 'anatomy';
let view = 'cutaway';
let labelsVisible = true;
let rotating = false;
let moving = false;
let tourIndex = -1;
let visionIndex = -1;
let conditionId = 'keratoconus';
let comparing = false;
let engine;
let nerveDetail;
let nerveDetailFailed = false;
let toastTimer;
const visited = new Set();
const labels = new Map();
const categories = { cornea: 'OUTER STRUCTURE', iris: 'ANTERIOR STRUCTURE', pupil: 'LIGHT ENTRY', lens: 'FOCUSING STRUCTURE', vitreous: 'INNER CHAMBER', retina: 'INNER LAYER', choroid: 'MIDDLE LAYER', sclera: 'OUTER LAYER', 'optic-nerve': 'NEURAL CONNECTION' };
const footerNote = $('#footer-note').textContent;
const conditionAnnotation = document.createElement('span');
conditionAnnotation.className = 'condition-scene-label';
conditionAnnotation.textContent = 'Optic nerve head';
conditionAnnotation.hidden = true;
$('#scene-labels').append(conditionAnnotation);

CONDITIONS.forEach((condition) => {
  const part = PARTS.find((entry) => entry.id === condition.partId);
  const button = document.createElement('button');
  button.className = 'condition-button';
  button.dataset.condition = condition.id;
  button.style.setProperty('--condition-color', part.color);
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = `<span class="condition-dot"></span><span><strong>${condition.name}</strong><small>${condition.id === 'normal' ? 'Reference anatomy' : part.name}</small></span><span class="condition-arrow" aria-hidden="true">↗</span>`;
  button.addEventListener('click', () => chooseCondition(condition.id));
  $('#condition-list').append(button);
});

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
  if (mode === 'vision') setMode('anatomy');
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
  $('#condition-anatomy-name').textContent = part.name;
  $('#condition-anatomy-description').textContent = part.description;
  if (scroll && window.innerWidth <= 760) $(`[data-part="${id}"]`).scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest', inline: 'center' });
}

function updateLabels(positions) {
  const occupied = [];
  const mobile = window.innerWidth <= 760;
  const max = mobile ? 4 : 6;
  const container = $('#scene');
  const w = container.clientWidth;
  const h = container.clientHeight;
  const sceneRect = container.getBoundingClientRect();
  const panels = $$('.hud-panel, .topbar, .footer, .intro, #tour-bar, #start-tour, .condition-model-note')
    .filter((panel) => getComputedStyle(panel).display !== 'none' && !panel.hidden)
    .map((panel) => panel.getBoundingClientRect());
  const sorted = [...positions].sort((a,b) => (a.id === selectedId ? -1 : b.id === selectedId ? 1 : 0));
  const shown = new Set();
  conditionAnnotation.hidden = true;
  sorted.forEach(({ id, x, y, visible }) => {
    if (id === 'optic-nerve-head') {
      const width = 155;
      const markerY = y - 47;
      const blocked = panels.some((rect) => x + sceneRect.left + width / 2 > rect.left - 8 && x + sceneRect.left - width / 2 < rect.right + 8 && markerY + sceneRect.top + 25 > rect.top - 8 && markerY + sceneRect.top - 25 < rect.bottom + 8);
      const show = labelsVisible && mode === 'conditions' && conditionId === 'glaucoma' && visible && !blocked && x > width / 2 && x < w - width / 2 && markerY > 25 && y < h - 25;
      conditionAnnotation.hidden = !show;
      if (show) { conditionAnnotation.style.left = `${x}px`; conditionAnnotation.style.top = `${markerY}px`; occupied.push({ x, y: markerY, width }); }
      return;
    }
    const label = labels.get(id);
    if (!label) return;
    const width = id === 'optic-nerve' ? 106 : 82;
    const px = Math.max(width / 2 + 3, Math.min(w - width / 2 - 3, x));
    const py = Math.max(15, Math.min(h - 15, y));
    const collision = occupied.some((point) => Math.abs(point.x - px) < (point.width + width) / 2 + 10 && Math.abs(point.y - py) < 36);
    const behindPanel = panels.some((rect) => px + sceneRect.left + width / 2 > rect.left - 8 && px + sceneRect.left - width / 2 < rect.right + 8 && py + sceneRect.top + 18 > rect.top - 8 && py + sceneRect.top - 18 < rect.bottom + 8);
    const show = labelsVisible && visible && shown.size < max && !collision && !behindPanel && x > 0 && x < w && y > 0 && y < h;
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
  updateSceneStatus();
}

function updateSceneStatus() {
  if (mode === 'conditions') {
    const condition = CONDITIONS.find((entry) => entry.id === conditionId);
    $('#scene-status').textContent = `${condition.name.toUpperCase()} / ${comparing ? 'TYPICAL REFERENCE' : 'STRUCTURAL SCHEMATIC'}`;
  } else $('#scene-status').textContent = view === 'whole' ? 'WHOLE EYE / INTERACTIVE 3D' : view === 'exploded' ? 'EXPLODED ANATOMY / INTERACTIVE 3D' : 'CUTAWAY ANATOMY / INTERACTIVE 3D';
}

function chooseCondition(id) {
  conditionId = id;
  if (mode !== 'conditions') setMode('conditions');
  else applyCondition(id);
  if (window.innerWidth <= 760) $(`[data-condition="${id}"]`).scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function applyCondition(id) {
  const condition = CONDITIONS.find((entry) => entry.id === id);
  if (!condition) return;
  conditionId = id;
  comparing = false;
  engine?.setComparison(false);
  engine?.setCondition(id);
  setView(condition.preferredView, condition.preferredExplode);
  selectPart(condition.partId);
  engine?.focusCondition();
  rotating = false;
  $('#auto-rotate').classList.remove('active');
  $('#auto-rotate').setAttribute('aria-pressed', 'false');
  $('#app').dataset.condition = id;
  $('#condition-category').textContent = id === 'normal' ? 'REFERENCE ANATOMY' : `FOCUS / ${PARTS.find((part) => part.id === condition.partId).name.toUpperCase()}`;
  $('#condition-name').textContent = condition.name;
  $('#condition-subtitle').textContent = condition.subtitle;
  $('#condition-description').textContent = condition.description;
  $('#condition-caution').textContent = condition.caution;
  $('#condition-sources').replaceChildren(...condition.sourceUrls.map((source) => {
    const link = document.createElement('a');
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.innerHTML = `<span>${source.title}</span>${icon('arrow')}`;
    return link;
  }));
  $$('.condition-button').forEach((button) => {
    const active = button.dataset.condition === id;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $('.condition-detail').scrollTop = 0;
  $('.right-rail').scrollTop = 0;
  updateComparison();
  if (id === 'glaucoma') nerveDetail?.reset();
}

function updateComparison() {
  const condition = CONDITIONS.find((entry) => entry.id === conditionId);
  const reference = conditionId === 'normal';
  const button = $('#compare-condition');
  button.hidden = reference;
  button.classList.toggle('active', comparing);
  button.setAttribute('aria-pressed', String(comparing));
  button.querySelector('span').textContent = comparing ? `Return to ${condition.name.toLowerCase()}` : 'View typical eye';
  $('#condition-state').textContent = comparing || reference ? 'TYPICAL REFERENCE' : 'SCHEMATIC';
  $('#condition-change').textContent = comparing ? (conditionId === 'glaucoma' ? 'Shows the reference nerve head with a smaller, shallower cup and a wider surrounding rim in the same 3D section.' : CONDITIONS[0].modelChange) : condition.modelChange;
  $('#comparison-note').textContent = reference ? 'Choose a condition to explore a structural change.' : comparing ? 'The model now shows typical anatomy in the same position. Return to the condition to compare.' : 'Switch to typical anatomy without moving the model.';
  const notes = { normal: 'Typical anatomy · schematic reference', keratoconus: 'Corneal shape · structural schematic', astigmatism: 'Corneal shape · structural schematic', glaucoma: 'Optic nerve head · enlarged schematic', cataract: 'Lens opacity · schematic example' };
  $('#condition-model-note-text').textContent = comparing ? `Typical anatomy · comparing ${condition.name.toLowerCase()}` : notes[conditionId];
  const showNerveDetail = mode === 'conditions' && conditionId === 'glaucoma';
  $('#nerve-detail').hidden = !showNerveDetail;
  if (showNerveDetail && !nerveDetail && !nerveDetailFailed) {
    try { nerveDetail = createNerveDetail($('#nerve-detail-scene')); }
    catch (error) {
      nerveDetailFailed = true;
      $('#nerve-detail-scene').innerHTML = '<p class="nerve-detail-error">The central cup is a recess where nerve tissue meets the back of the eye. Compare the typical reference to see the rim change.</p>';
      console.error('Unable to initialize the nerve-head detail:', error);
    }
  }
  nerveDetail?.setVisible(showNerveDetail);
  nerveDetail?.setComparison(comparing);
  $('#nerve-detail-state').textContent = comparing ? 'TYPICAL REFERENCE' : 'GLAUCOMA EXAMPLE';
  updateSceneStatus();
}

function setMode(next) {
  mode = next;
  $('#app').classList.toggle('vision-mode', next === 'vision');
  $('#app').classList.toggle('conditions-mode', next === 'conditions');
  $('.condition-library').hidden = next !== 'conditions';
  $('.condition-detail').hidden = next !== 'conditions';
  $('#condition-model-note').hidden = next !== 'conditions';
  $('#footer-note').textContent = next === 'conditions' ? 'Schematic structural examples. No diagnostic measurements.' : footerNote;
  $$('[data-mode]').forEach((button) => {
    const active = button.dataset.mode === next;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  engine?.setLightPath(false);
  if (next === 'conditions') {
    endTour();
    visionIndex = -1;
    applyCondition(conditionId);
    updateVision();
  } else {
    comparing = false;
    engine?.setComparison(false);
    engine?.setCondition('normal', { animate: false });
    $('#app').dataset.condition = 'normal';
    conditionAnnotation.hidden = true;
    $('#nerve-detail').hidden = true;
    nerveDetail?.setVisible(false);
    if (next === 'vision') { endTour(); visionIndex = 0; setView('cutaway', 12); engine?.setLightPath(true); updateVision(); }
    else { visionIndex = -1; setView('cutaway'); updateVision(); }
    engine?.focusCondition();
    rotating = false;
    $('#auto-rotate').classList.remove('active');
    $('#auto-rotate').setAttribute('aria-pressed', 'false');
  }
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
function toggleMove() {
  moving = !moving;
  engine?.setInteractionMode(moving ? 'pan' : 'rotate');
  $('#move-eye').classList.toggle('active', moving);
  $('#move-eye').setAttribute('aria-pressed', String(moving));
  $('#drag-hint').textContent = moving ? 'Drag to move the eye' : 'Drag to rotate';
}
function reset() {
  endTour();
  if (mode === 'vision') setMode('anatomy');
  engine?.reset();
  moving = false;
  $('#move-eye').classList.remove('active');
  $('#move-eye').setAttribute('aria-pressed', 'false');
  $('#drag-hint').textContent = 'Drag to rotate';
  rotating = false;
  $('#auto-rotate').classList.remove('active');
  $('#auto-rotate').setAttribute('aria-pressed', 'false');
  if (!labelsVisible) toggleLabels();
  if (mode === 'conditions') { applyCondition(conditionId); toast('Condition view reset.'); }
  else { setView('cutaway'); selectPart('cornea', true); toast('A fresh perspective. View reset.'); }
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
$('#move-eye').addEventListener('click', toggleMove);
$('#move-eye').addEventListener('keydown', (event) => {
  const directions = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -40], ArrowDown: [0, 40] };
  if (!directions[event.key]) return;
  event.preventDefault();
  if (!moving) toggleMove();
  engine?.pan(...directions[event.key]);
});
$('#toggle-labels').addEventListener('click', toggleLabels);
$('#reset').addEventListener('click', reset);
$('#compare-condition').addEventListener('click', () => {
  if (conditionId === 'normal') return;
  comparing = !comparing;
  engine?.setComparison(comparing);
  updateComparison();
});
$('#reset-nerve-detail').addEventListener('click', () => nerveDetail?.reset());
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
$('#model-note').textContent = `${MODEL_NOTE} ${MODEL_CONDITION_NOTE}`;
const allSources = [...new Map([...SOURCES, ...CONDITIONS.flatMap((condition) => condition.sourceUrls)].map((source) => [source.url, source])).values()];
allSources.forEach((source) => {
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
window.addEventListener('pagehide', () => { engine?.destroy(); nerveDetail?.destroy(); }, { once: true });
