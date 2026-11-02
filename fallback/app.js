/** Fallback demo: the engine's three futures on a keyless Cesium globe. */
import { LEVERS, BUDGET, normalizePolicies, fitBudget, hotspotsAt, cameraFor, START_YEAR, END_YEAR } from '../engine/index.js';

const $ = (id) => document.getElementById(id);
const COLORS = { best: '#3ee08f', likely: '#ffc53d', worst: '#ff4d5e' };

const state = {
  mode: 'ai',
  policies: { ai: normalizePolicies({ energy: 60, carbonPrice: 60, adaptation: 60, food: 60, cooperation: 60, tech: 60 }), human: normalizePolicies({ energy: 60, carbonPrice: 60, adaptation: 60, food: 60, cooperation: 60, tech: 60 }) },
  results: { ai: null, human: null },
  rationale: { ai: [], human: [] },
  which: 'likely',
  year: START_YEAR,
  playing: null,
};

// ---------- globe ----------
const viewer = new Cesium.Viewer('globe', {
  baseLayer: Cesium.ImageryLayer.fromProviderAsync(
    Cesium.TileMapServiceImageryProvider.fromUrl(Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')),
  ),
  baseLayerPicker: false, geocoder: false, timeline: false, animation: false, homeButton: false,
  sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false, selectionIndicator: false,
});
const scene = viewer.scene;
scene.globe.enableLighting = false;
scene.skyAtmosphere.show = true;
scene.globe.showGroundAtmosphere = true;
viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(20, 20, 20_000_000) });
const layer = () => viewer.imageryLayers.get(0);

let spin = true;
viewer.clock.onTick.addEventListener(() => { if (spin) viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z, -0.0006); });
viewer.screenSpaceEventHandler.setInputAction(() => { spin = false; }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

const entities = new Cesium.CustomDataSource('future');
viewer.dataSources.add(entities);

function currentRun() {
  const r = state.results[state.mode];
  return r ? r[state.which] : null;
}

function drawGlobe() {
  entities.entities.removeAll();
  const run = currentRun();
  const res = state.results[state.mode];
  if (!run) return;
  const row = run.years.find((y) => y.year === state.year);
  // Hotspots: coastal cities, circle grows with people displaced by the sea.
  for (const h of hotspotsAt(run, state.year, res.policies.adaptation)) {
    if (h.displacedM < 0.05) continue;
    const r = 40_000 + Math.sqrt(h.displacedM) * 110_000;
    entities.entities.add({
      position: Cesium.Cartesian3.fromDegrees(h.lon, h.lat),
      ellipse: { semiMajorAxis: r, semiMinorAxis: r, material: Cesium.Color.fromCssColorString('#ffb020').withAlpha(0.35), outline: true, outlineColor: Cesium.Color.fromCssColorString('#ffb020') , height: 0 },
      label: h.displacedM >= 1 ? {
        text: `${h.place}  ${h.displacedM}M`, font: '12px JetBrains Mono', fillColor: Cesium.Color.fromCssColorString('#ffd27a'),
        showBackground: true, backgroundColor: Cesium.Color.BLACK.withAlpha(0.55), pixelOffset: new Cesium.Cartesian2(0, -18),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 14_000_000),
      } : undefined,
    });
  }
  // Events: pins, the recent ones pulse and carry labels.
  const t0 = performance.now();
  for (const e of run.events.filter((x) => x.year <= state.year)) {
    const recent = state.year - e.year <= 3;
    const color = Cesium.Color.fromCssColorString(e.kind === 'good' ? '#3ee08f' : '#ff4d5e');
    entities.entities.add({
      position: Cesium.Cartesian3.fromDegrees(e.lon, e.lat),
      point: {
        pixelSize: recent ? new Cesium.CallbackProperty(() => 10 + 6 * Math.abs(Math.sin((performance.now() - t0) / 300)), false) : 8,
        color: color.withAlpha(recent ? 1 : 0.6), outlineColor: Cesium.Color.WHITE.withAlpha(0.7), outlineWidth: 1,
      },
      label: recent ? {
        text: `${e.year} · ${e.title}\n${e.place}: ${e.impact}`, font: '13px Inter', fillColor: color,
        showBackground: true, backgroundColor: Cesium.Color.BLACK.withAlpha(0.7), pixelOffset: new Cesium.Cartesian2(0, -26),
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      } : undefined,
    });
  }
  // Heat: the planet's colours shift toward red as it warms.
  const heat = Math.max(0, row.warmingC - 1.4);
  if (layer()) { layer().saturation = 1 + heat * 0.25; layer().hue = -heat * 0.03; layer().brightness = 1 - heat * 0.06; }
  scene.skyAtmosphere.hueShift = -heat * 0.06;
  scene.skyAtmosphere.saturationShift = heat * 0.15;
  scene.globe.atmosphereHueShift = -heat * 0.06;
}

function flyToEvent(e) {
  spin = false;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(e.lon, e.lat - 3.5, 4_200_000),
    orientation: { heading: 0, pitch: Cesium.Math.toRadians(-72), roll: 0 },
    duration: 1.8,
  });
}

function flyToYear(year) {
  const run = currentRun();
  if (!run) return;
  const cam = cameraFor(run, year);
  spin = false;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(cam.lon, cam.lat, cam.event ? 4_500_000 : 20_000_000),
    orientation: { heading: 0, pitch: Cesium.Math.toRadians(cam.event ? -70 : -90), roll: 0 },
    duration: 2.2,
  });
}

// ---------- HUD + timeline ----------
function drawHud() {
  const run = currentRun();
  const row = run ? run.years.find((y) => y.year === state.year) : null;
  $('hud-year').textContent = state.year;
  $('hud-warm').textContent = row ? `${row.warmingC.toFixed(2)} °C` : '1.40 °C';
  $('hud-sea').textContent = row ? `+${Math.round(row.seaLevelM * 100)} cm` : '+0 cm';
  $('hud-pop').textContent = row ? `${row.populationBn.toFixed(2)} bn` : '8.20 bn';
  $('hud-disp').textContent = row ? `${row.displacedM.toFixed(1)}M` : '0';
  $('hud-wb').textContent = row ? Math.round(row.wellbeing) : '62';
  $('hud-warm').style.color = row && row.warmingC >= 2 ? '#ff4d5e' : row && row.warmingC >= 1.7 ? '#ffc53d' : '#e6edf7';
  const ev = run ? run.events.filter((e) => e.year <= state.year && e.year > state.year - 3).slice(-3) : [];
  $('ticker').innerHTML = ev.map((e) => `<span class="${e.kind}">● ${e.year} ${e.title} (${e.place}): ${e.impact}</span>`).join('&nbsp;&nbsp;&nbsp;');
  $('year').value = state.year;
}

function setYear(y, { fly = false } = {}) {
  state.year = Math.min(END_YEAR, Math.max(START_YEAR, y));
  drawHud();
  drawGlobe();
  if (fly) flyToYear(state.year);
}

$('year').addEventListener('input', (e) => setYear(Number(e.target.value)));
$('year').addEventListener('change', (e) => flyToYear(Number(e.target.value)));
function stop() { clearInterval(state.playing); state.playing = null; $('btn-play').textContent = '▶'; }
let autoplayTimer = null;
/** Start playback shortly, once; never toggles it off. */
function autoplay(delay) {
  clearTimeout(autoplayTimer);
  autoplayTimer = setTimeout(() => { if (!state.playing) play(); }, delay);
}
function play() {
  clearTimeout(autoplayTimer);
  if (!currentRun()) return;
  if (state.playing) return stop();
  if (state.year >= END_YEAR) setYear(START_YEAR);
  $('btn-play').textContent = '❚❚';
  let lastFly = -10;
  state.playing = setInterval(() => {
    if (state.year >= END_YEAR) {
      stop();
      // End on the whole planet.
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(20, 20, 20_000_000), duration: 2.5 });
      return;
    }
    const next = state.year + 1;
    setYear(next);
    const now = currentRun().events.filter((e) => e.year === next);
    const ev = now.find((e) => e.kind === 'bad') ?? now[0];
    if (ev && next - lastFly >= 4) { lastFly = next; flyToEvent(ev); }
  }, 420);
}
$('btn-play').addEventListener('click', play);
document.addEventListener('keydown', (e) => { if (e.code === 'Space' && e.target.tagName !== 'INPUT') { e.preventDefault(); play(); } });

// ---------- levers ----------
function drawLevers() {
  const p = state.policies[state.mode];
  const locked = state.mode === 'ai';
  $('levers').innerHTML = LEVERS.map(({ key, label, help }) => `
    <div class="lever">
      <div class="row"><span>${label}</span><b id="v-${key}">${p[key]}</b></div>
      <small>${help}</small>
      <input type="range" min="0" max="100" value="${p[key]}" data-key="${key}" ${locked ? 'disabled' : ''} />
    </div>`).join('');
  drawBudget();
  $('btn-ai').classList.toggle('hidden', !locked);
  $('who-hint').innerHTML = locked
    ? 'The AI gets the same budget as humanity: <b>360 points</b> across six levers. It tests every mix on hundreds of futures and keeps the one with the best typical outcome and the least bad worst case.'
    : 'Your turn. Spend the same <b>360 points</b>. Then compare your future with the AI\'s.';
  const list = state.rationale[state.mode];
  $('rationale').innerHTML = list.map((r) => `<li>${r}</li>`).join('');
}
function drawBudget() {
  const p = state.policies[state.mode];
  const total = LEVERS.reduce((s, { key }) => s + p[key], 0);
  $('budget-bar').style.width = `${Math.min(100, (total / BUDGET) * 100)}%`;
  $('budget-bar').classList.toggle('over', total > BUDGET);
  $('budget-text').textContent = `${total} / ${BUDGET}${total > BUDGET ? ' (over: will be scaled down)' : ''}`;
}
$('levers').addEventListener('input', (e) => {
  const key = e.target.dataset.key;
  if (!key) return;
  state.policies.human[key] = Number(e.target.value);
  $(`v-${key}`).textContent = e.target.value;
  drawBudget();
});

function setMode(mode) {
  state.mode = mode;
  $('tab-ai').classList.toggle('active', mode === 'ai');
  $('tab-human').classList.toggle('active', mode === 'human');
  drawLevers();
  drawResults();
  setYear(state.year);
}
$('tab-ai').addEventListener('click', () => setMode('ai'));
$('tab-human').addEventListener('click', () => setMode('human'));

// ---------- worker ----------
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let jobId = 0;
function job(msg) {
  const id = ++jobId;
  $('progress').classList.remove('hidden');
  $('progress').firstElementChild.style.width = '5%';
  $('btn-ai').disabled = $('btn-run').disabled = true;
  return new Promise((resolve) => {
    const onMessage = ({ data }) => {
      if (data.id !== id) return;
      if (data.type === 'progress') { $('progress').firstElementChild.style.width = `${Math.round(data.p * 100)}%`; return; }
      worker.removeEventListener('message', onMessage);
      $('progress').classList.add('hidden');
      $('btn-ai').disabled = $('btn-run').disabled = false;
      resolve(data);
    };
    worker.addEventListener('message', onMessage);
    worker.postMessage({ id, ...msg });
  });
}

async function runFutures(mode) {
  stop();
  clearTimeout(autoplayTimer);
  const policies = fitBudget(normalizePolicies(state.policies[mode]));
  state.policies[mode] = policies;
  const { futures, rationale } = await job({ type: 'run', policies });
  state.results[mode] = futures;
  state.rationale[mode] = mode === 'ai' ? state.rationale.ai : rationale;
  afterResult();
}

async function letAiDecide() {
  stop();
  clearTimeout(autoplayTimer);
  const { policies, futures, rationale } = await job({ type: 'optimize' });
  $('btn-ai').disabled = $('btn-run').disabled = true;
  // Animate the sliders to the AI's choice.
  const from = { ...state.policies.ai };
  const t0 = performance.now();
  await new Promise((done) => {
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 900);
      for (const { key } of LEVERS) state.policies.ai[key] = Math.round(from[key] + (policies[key] - from[key]) * k);
      drawLevers();
      k < 1 ? requestAnimationFrame(step) : done();
    };
    step();
  });
  state.results.ai = futures;
  state.rationale.ai = rationale;
  $('btn-ai').disabled = $('btn-run').disabled = false;
  afterResult();
}

function afterResult() {
  state.which = 'likely';
  drawLevers();
  drawResults();
  setYear(START_YEAR);
  autoplay(600);
}

$('btn-ai').addEventListener('click', letAiDecide);
$('btn-run').addEventListener('click', () => runFutures(state.mode));

// ---------- results ----------
function drawResults() {
  const res = state.results[state.mode];
  if (!res) { $('cards').innerHTML = '<p class="hint">Run the simulation to see three futures.</p>'; $('histogram').innerHTML = ''; $('stats').innerHTML = ''; drawCompare(); return; }
  $('runs').textContent = res.runs.toLocaleString('en');
  $('cards').innerHTML = ['best', 'likely', 'worst'].map((w) => {
    const r = res[w], f = r.final;
    const top = r.events.slice(0, 3).map((e) => `${e.year} ${e.title}`).join(' · ') || 'no major shocks';
    return `<div class="card ${w} ${state.which === w ? 'active' : ''}" data-which="${w}">
      <div class="title">${r.label}<small>${r.share}</small></div>
      <div class="nums">${f.warmingC.toFixed(2)} °C · sea +${Math.round(f.seaLevelM * 100)} cm · ${f.displacedM.toFixed(0)}M displaced</div>
      <div class="events">${top}</div></div>`;
  }).join('');
  const max = Math.max(...res.histogram.map((b) => b.count));
  const marks = { worst: res.worst.score, likely: res.likely.score, best: res.best.score };
  $('histogram').innerHTML = res.histogram.map((b, i) => {
    const next = res.histogram[i + 1]?.from ?? Infinity;
    const hit = Object.entries(marks).find(([, s]) => s >= b.from && s < next);
    return `<div style="height:${(b.count / max) * 100}%;${hit ? `background:${COLORS[hit[0]]}` : ''}" title="${b.count} futures"></div>`;
  }).join('');
  const s = res.stats;
  $('stats').innerHTML = `
    <span>Median warming 2076</span><b>${s.medianWarming} °C</b>
    <span>90% range</span><b>${s.warming90[0]}–${s.warming90[1]} °C</b>
    <span>Futures below 2 °C</span><b>${Math.round(s.p2C * 100)}%</b>
    <span>Futures with a tipping point</span><b>${Math.round(s.tippingShare * 100)}%</b>
    <span>Futures with a major war</span><b>${Math.round(s.warShare * 100)}%</b>
    <span>Futures with a clean-energy breakthrough</span><b>${Math.round(s.breakthroughShare * 100)}%</b>`;
  drawCompare();
}
$('cards').addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  stop();
  state.which = card.dataset.which;
  drawResults();
  setYear(START_YEAR);
  autoplay(300);
});

function drawCompare() {
  const { ai, human } = state.results;
  const box = $('compare');
  if (!ai || !human) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const rows = [
    ['Median warming', ai.stats.medianWarming, human.stats.medianWarming, 'low', ' °C'],
    ['Below 2 °C', Math.round(ai.stats.p2C * 100), Math.round(human.stats.p2C * 100), 'high', '%'],
    ['Displaced (likely)', Math.round(ai.likely.final.displacedM), Math.round(human.likely.final.displacedM), 'low', 'M'],
    ['Deaths (likely)', Math.round(ai.likely.final.deathsM), Math.round(human.likely.final.deathsM), 'low', 'M'],
    ['Wellbeing (likely)', Math.round(ai.likely.final.wellbeing), Math.round(human.likely.final.wellbeing), 'high', ''],
    ['Worst-5% score', Math.round(ai.stats.scoreQuantiles.p5), Math.round(human.stats.scoreQuantiles.p5), 'high', ''],
  ];
  const cls = (a, b, dir, mine) => ((dir === 'low' ? (mine ? a < b : b < a) : (mine ? a > b : b > a)) ? 'win' : '');
  box.innerHTML = `<h4>AI vs audience</h4><table><tr><th></th><th>AI</th><th>Audience</th></tr>${rows.map(([l, a, h, d, u]) =>
    `<tr><td>${l}</td><td class="${cls(a, h, d, true)}">${a}${u}</td><td class="${cls(a, h, d, false)}">${h}${u}</td></tr>`).join('')}</table>`;
}

setMode('ai');
