/** Fallback demo: the engine's three futures on a keyless Cesium globe. */
import { LEVERS, BUDGET, normalizePolicies, fitBudget, hotspotsAt, cameraFor, START_YEAR, END_YEAR } from '../engine/index.js';

if (!window.cesiumReady) await new Promise((resolve) => document.addEventListener('cesium-ready', resolve, { once: true }));

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
// NASA GIBS imagery (keyless, CORS open): Blue Marble by day, city lights by night.
// GIBS geographic tiles are 512 px at 0.5625°/px, so a level-0 tile spans 288°:
// the matrix starts at (-180, 90) and runs past the globe's edge.
const GIBS_SCHEME = new Cesium.GeographicTilingScheme({
  rectangle: Cesium.Rectangle.fromDegrees(-180, -198, 396, 90),
  numberOfLevelZeroTilesX: 2,
  numberOfLevelZeroTilesY: 1,
});
const gibs = (layer, date, ext, maxLevel) => new Cesium.WebMapTileServiceImageryProvider({
  url: `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/${layer}/default/${date}/500m/{TileMatrix}/{TileRow}/{TileCol}.${ext}`,
  layer, style: 'default', tileMatrixSetID: '500m', format: `image/${ext === 'jpeg' ? 'jpeg' : 'png'}`,
  tilingScheme: GIBS_SCHEME, tileWidth: 512, tileHeight: 512, maximumLevel: maxLevel,
  credit: new Cesium.Credit('NASA GIBS / Blue Marble, Black Marble'),
});
const viewer = new Cesium.Viewer('globe', {
  baseLayer: new Cesium.ImageryLayer(gibs('BlueMarble_ShadedRelief_Bathymetry', '2004-08-01', 'jpeg', 7)),
  baseLayerPicker: false, geocoder: false, timeline: false, animation: false, homeButton: false,
  sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false, selectionIndicator: false,
  shouldAnimate: false,
});
const scene = viewer.scene;
const night = viewer.imageryLayers.addImageryProvider(gibs('VIIRS_Black_Marble', '2016-01-01', 'png', 7));
night.dayAlpha = 0.0;
night.nightAlpha = 1.0;
night.brightness = 2.0;
scene.globe.enableLighting = true;
scene.globe.dynamicAtmosphereLighting = true;
scene.globe.dynamicAtmosphereLightingFromSun = true;
scene.globe.showGroundAtmosphere = true;
scene.globe.baseColor = Cesium.Color.fromCssColorString('#020409');
scene.skyAtmosphere.show = true;
scene.backgroundColor = Cesium.Color.fromCssColorString('#020409');
// Late afternoon over Europe: the night line crosses the Middle East, Asia shows its city lights.
viewer.clock.currentTime = Cesium.JulianDate.fromIso8601('2026-11-03T15:30:00Z');
const bloom = scene.postProcessStages.bloom;
bloom.enabled = true;
Object.assign(bloom.uniforms, { glowOnly: false, contrast: 128, brightness: -0.55, delta: 1.0, sigma: 2.6, stepSize: 1.0 });
viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(30, 15, 17_000_000) });
const baseLayer = () => viewer.imageryLayers.get(0);

// Offline safety: if NASA's tiles keep failing (venue Wi-Fi), switch to the
// Natural Earth map that ships inside Cesium, and drop the night lights.
let gibsErrors = 0, offline = false;
async function goOffline() {
  if (offline) return;
  offline = true;
  const local = await Cesium.TileMapServiceImageryProvider.fromUrl(Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'));
  viewer.imageryLayers.removeAll();
  viewer.imageryLayers.addImageryProvider(local);
  console.warn('NASA imagery unreachable: using the offline map');
}
if (new URLSearchParams(location.search).has('offline')) goOffline();
for (const layer of [viewer.imageryLayers.get(0), night]) {
  layer.imageryProvider.errorEvent.addEventListener((err) => {
    err.retry = false;
    if (++gibsErrors >= 6) goOffline();
  });
}

let spin = true;
viewer.scene.preRender.addEventListener(() => { if (spin) viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z, -0.0005); });
viewer.screenSpaceEventHandler.setInputAction(() => { spin = false; }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

const entities = new Cesium.CustomDataSource('future');
viewer.dataSources.add(entities);

/** A soft round glow, drawn once per colour, used as the billboard for events and cities. */
const glowCache = new Map();
function glow(css) {
  if (glowCache.has(css)) return glowCache.get(css);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.18, css);
  grad.addColorStop(0.5, css + '55');
  grad.addColorStop(1, css + '00');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowCache.set(css, c);
  return c;
}

const RED = '#ff3b4e', GREEN = '#3ee08f', AMBER = '#ffb020', HEAT = '#ff6a1a';
// Regions where extra warming hits hardest (heat and drought). They grow and glow as the planet warms.
const HEAT_ZONES = [
  [13, 2, 'Sahel'], [25, 45, 'Arabian Peninsula'], [27, 78, 'North India'], [30, 70, 'Indus Valley'],
  [33, 44, 'Iraq'], [-23, 133, 'Central Australia'], [33, -112, 'US Southwest'], [24, -102, 'Northern Mexico'],
  [38, -4, 'Iberia'], [-10, -42, 'Brazil Northeast'], [-25, 25, 'Southern Africa'], [45, 63, 'Central Asia'],
];
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
  const now = () => performance.now() / 1000;

  // Coastal cities losing people to the sea: amber glow and a ring sized by displacement.
  for (const h of hotspotsAt(run, state.year, res.policies.adaptation)) {
    if (h.displacedM < 0.05) continue;
    const r = 60_000 + Math.sqrt(h.displacedM) * 140_000;
    entities.entities.add({
      position: Cesium.Cartesian3.fromDegrees(h.lon, h.lat),
      billboard: { image: glow(AMBER), scale: 0.35 + Math.sqrt(h.displacedM) * 0.25, color: Cesium.Color.WHITE.withAlpha(0.9) },
      ellipse: {
        semiMajorAxis: r, semiMinorAxis: r, height: 0,
        material: Cesium.Color.fromCssColorString(AMBER).withAlpha(0.18),
        outline: true, outlineColor: Cesium.Color.fromCssColorString(AMBER).withAlpha(0.8),
      },
      label: h.displacedM >= 1 ? {
        text: `${h.place.toUpperCase()}  ${h.displacedM.toFixed(1)}M`, font: '600 11px JetBrains Mono',
        fillColor: Cesium.Color.fromCssColorString('#ffd27a'), showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('#05070b').withAlpha(0.7), backgroundPadding: new Cesium.Cartesian2(6, 4),
        pixelOffset: new Cesium.Cartesian2(0, -20), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 9_000_000),
      } : undefined,
    });
  }

  // Events: a glow for every one so far; the recent ones send out shockwaves and carry a label.
  for (const e of run.events.filter((x) => x.year <= state.year)) {
    const css = e.kind === 'good' ? GREEN : RED;
    const color = Cesium.Color.fromCssColorString(css);
    const age = state.year - e.year;
    const recent = age <= 2;
    const pos = Cesium.Cartesian3.fromDegrees(e.lon, e.lat);
    const born = now();
    entities.entities.add({
      position: pos,
      billboard: {
        image: glow(css),
        scale: recent ? new Cesium.CallbackProperty(() => 1.1 + 0.35 * Math.sin((now() - born) * 4), false) : 0.6,
        color: Cesium.Color.WHITE.withAlpha(recent ? 1 : 0.55),
        disableDepthTestDistance: 0,
      },
      label: recent ? {
        text: `${e.year}  ${e.title.toUpperCase()}\n${e.place} · ${e.impact}`, font: '600 13px Inter', fillColor: color,
        showBackground: true, backgroundColor: Cesium.Color.fromCssColorString('#05070b').withAlpha(0.78),
        backgroundPadding: new Cesium.Cartesian2(8, 6), pixelOffset: new Cesium.Cartesian2(0, -34),
      } : undefined,
    });
    if (recent) {
      // Two expanding rings, half a cycle apart.
      for (const phase of [0, 0.5]) {
        const t = () => ((now() - born) / 2.2 + phase) % 1;
        entities.entities.add({
          position: pos,
          ellipse: {
            semiMajorAxis: new Cesium.CallbackProperty(() => 50_000 + t() * (e.kind === 'good' ? 600_000 : 900_000), false),
            semiMinorAxis: new Cesium.CallbackProperty(() => 50_000 + t() * (e.kind === 'good' ? 600_000 : 900_000), false),
            height: 0,
            material: new Cesium.ColorMaterialProperty(new Cesium.CallbackProperty(() => color.withAlpha(0.35 * (1 - t())), false)),
            outline: false,
          },
        });
      }
    }
  }

  // Heat stress: orange zones that spread with every tenth of a degree above 1.5 °C.
  const stress = Math.max(0, row.warmingC - 1.45);
  if (stress > 0) {
    for (const [lat, lon] of HEAT_ZONES) {
      const r = 150_000 + stress * 900_000;
      entities.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        ellipse: {
          semiMajorAxis: r, semiMinorAxis: r * 0.8, height: 0,
          material: Cesium.Color.fromCssColorString(HEAT).withAlpha(Math.min(0.42, 0.08 + stress * 0.3)),
        },
      });
    }
  }

  // Heat: a red veil over the whole planet that thickens with every tenth of a degree.
  const heat = Math.max(0, row.warmingC - 1.4);
  entities.entities.add({
    rectangle: {
      coordinates: Cesium.Rectangle.fromDegrees(-180, -85, 180, 85),
      material: Cesium.Color.fromCssColorString('#ff3a1a').withAlpha(Math.min(0.32, heat * 0.14)),
      height: 0,
    },
  });
  if (baseLayer()) { baseLayer().saturation = 1 + heat * 0.3; baseLayer().hue = -heat * 0.02; }
  scene.skyAtmosphere.hueShift = -heat * 0.07;
  scene.skyAtmosphere.saturationShift = heat * 0.25;
  scene.globe.atmosphereHueShift = -heat * 0.07;
  scene.globe.atmosphereSaturationShift = heat * 0.25;
}

/** Fly so the point sits in the middle of the screen, seen from the south at a tilt. */
function flyToPoint(lon, lat, range, pitchDeg, duration) {
  spin = false;
  viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(lon, lat), 1), {
    offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(pitchDeg), range),
    duration,
  });
}

function flyToEvent(e) {
  flyToPoint(e.lon, e.lat, 3_800_000, -58, 1.8);
}

function flyToYear(year) {
  const run = currentRun();
  if (!run) return;
  const cam = cameraFor(run, year);
  if (cam.event) flyToPoint(cam.event.lon, cam.event.lat, 4_200_000, -60, 2.2);
  else flyToPoint(30, 15, 17_000_000, -90, 2.2);
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
  const fresh = run ? run.events.filter((e) => e.year === state.year) : [];
  // While playing, the play loop shows the banner together with the camera move.
  if (fresh.length && !state.playing) showBanner(fresh.find((e) => e.kind === 'bad') ?? fresh[0]);
  $('ticker').innerHTML = ev.map((e) => `<span class="${e.kind}">● ${e.year} ${e.title} (${e.place}): ${e.impact}</span>`).join('&nbsp;&nbsp;&nbsp;');
  $('year').value = state.year;
}

let bannerTimer = null;
function showBanner(e) {
  const b = $('banner');
  b.className = `banner show ${e.kind}`;
  b.innerHTML = `<span class="y">${e.year}</span><b>${e.title}</b><small>${e.place} · ${e.impact}</small>`;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('show'), 2600);
}

function setLeftCollapsed(on) {
  $('left').classList.toggle('collapsed', on);
  $('collapse').textContent = on ? '›' : '‹';
}
$('collapse').addEventListener('click', () => setLeftCollapsed(!$('left').classList.contains('collapsed')));

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
function hideReport() {
  $('report').classList.add('hidden');
  document.body.classList.remove('reporting');
}
function play() {
  clearTimeout(autoplayTimer);
  hideReport();
  if (!currentRun()) return;
  if (state.playing) return stop();
  if (state.year >= END_YEAR) setYear(START_YEAR);
  $('btn-play').textContent = '❚❚';
  let lastFly = -10;
  state.playing = setInterval(() => {
    if (state.year >= END_YEAR) {
      stop();
      // End on the whole planet.
      flyToPoint(30, 15, 17_000_000, -90, 2.5);
      setTimeout(showReport, 1800);
      return;
    }
    const next = state.year + 1;
    setYear(next);
    const now = currentRun().events.filter((e) => e.year === next);
    const ev = now.find((e) => e.kind === 'bad') ?? now[0];
    if (ev && next - lastFly >= 3) { lastFly = next; flyToEvent(ev); showBanner(ev); }
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
  setLeftCollapsed(false);
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

// The AI starts choosing as soon as the page loads, in its own worker, so the
// button answers at once on stage. The seed is fixed, so the choice is the same.
const aiChoice = new Promise((resolve) => {
  const w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  w.onmessage = ({ data }) => { if (data.type === 'done') { resolve(data); w.terminate(); } };
  w.postMessage({ id: 0, type: 'optimize' });
});

/** Show the AI "testing futures" for at least `minMs`, then hand over its choice. */
async function thinking(promise, minMs = 1800) {
  const bar = $('progress').firstElementChild;
  $('progress').classList.remove('hidden');
  $('btn-ai').disabled = $('btn-run').disabled = true;
  const label = $('btn-ai').textContent;
  $('btn-ai').textContent = 'AI is testing futures…';
  const t0 = performance.now();
  const tick = setInterval(() => { bar.style.width = `${Math.min(96, ((performance.now() - t0) / minMs) * 100)}%`; }, 50);
  const [result] = await Promise.all([promise, new Promise((r) => setTimeout(r, minMs))]);
  clearInterval(tick);
  bar.style.width = '100%';
  $('progress').classList.add('hidden');
  $('btn-ai').textContent = label;
  return result;
}

async function letAiDecide() {
  stop();
  clearTimeout(autoplayTimer);
  const { policies, futures, rationale } = await thinking(aiChoice);
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
  setLeftCollapsed(true);
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
  document.querySelector('.panel.right').classList.toggle('empty', !res);
  if (!res) { $('cards').innerHTML = '<p class="hint">Run the simulation to see three futures.</p>'; $('histogram').innerHTML = ''; $('stats').innerHTML = ''; drawCompare(); return; }
  $('runs').textContent = res.runs.toLocaleString('en');
  $('cards').innerHTML = ['best', 'likely', 'worst'].map((w) => {
    const r = res[w], f = r.final;
    const top = r.events.slice(0, 3).map((e) => `${e.year} ${e.title}`).join(' · ') || 'no major shocks';
    return `<div class="card ${w} ${state.which === w ? 'active' : ''}" data-which="${w}">
      <div class="title">${r.label}<small>${r.share}</small></div>
      <div class="nums">${f.warmingC.toFixed(2)} °C · +${Math.round(f.seaLevelM * 100)} cm · ${f.displacedM.toFixed(0)}M flooded out</div>
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

// ---------- intro and the 2076 report ----------
function closeIntro() { $('intro').classList.add('gone'); }
$('intro-go').addEventListener('click', () => { closeIntro(); letAiDecide(); });
$('intro-skip').addEventListener('click', () => { closeIntro(); setMode('human'); });

/** AI vs audience, head to head on the most likely future, once both have run. */
function duel() {
  const { ai, human } = state.results;
  if (!ai || !human) return '';
  const rows = [
    ['Warming by 2076', ai.stats.medianWarming, human.stats.medianWarming, (v) => `${v} °C`, 'low'],
    ['Futures below 2 °C', ai.stats.p2C * 100, human.stats.p2C * 100, (v) => `${Math.round(v)}%`, 'high'],
    ['Flooded out', ai.likely.final.displacedM, human.likely.final.displacedM, (v) => `${Math.round(v)}M`, 'low'],
    ['Deaths', ai.likely.final.deathsM, human.likely.final.deathsM, (v) => `${Math.round(v)}M`, 'low'],
  ];
  let aiWins = 0;
  const html = rows.map(([label, a, h, fmt, better]) => {
    const max = Math.max(a, h) || 1;
    const aWin = better === 'low' ? a < h : a > h;
    const tie = a === h;
    if (aWin && !tie) aiWins++;
    return `<div class="duel-row"><span class="duel-label">${label}</span>
      <div class="duel-bar ai ${aWin && !tie ? 'win' : ''}"><i style="width:${(a / max) * 100}%"></i><b>${fmt(a)}</b></div>
      <div class="duel-bar human ${!aWin && !tie ? 'win' : ''}"><i style="width:${(h / max) * 100}%"></i><b>${fmt(h)}</b></div></div>`;
  }).join('');
  const verdict = aiWins > rows.length / 2 ? 'The AI wins' : aiWins < rows.length / 2 ? 'The audience wins' : 'A draw';
  return `<div class="duel"><div class="duel-head"><span>${verdict} ${Math.max(aiWins, rows.length - aiWins)} to ${Math.min(aiWins, rows.length - aiWins)}</span>
    <span class="legend"><i class="ai"></i>AI <i class="human"></i>Audience</span></div>${html}</div>`;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function showReport() {
  const res = state.results[state.mode];
  const run = currentRun();
  if (!res || !run) return;
  const f = run.final;
  const who = state.mode === 'ai' ? 'The AI' : 'The audience';
  const color = { best: 'var(--good)', likely: 'var(--mid)', worst: 'var(--bad)' }[state.which];
  const bad = run.events.filter((e) => e.kind === 'bad').length;
  const good = run.events.filter((e) => e.kind === 'good').length;
  const p = res.policies;
  const low = LEVERS.map((l) => ({ ...l, v: p[l.key] })).sort((a, b) => a.v - b.v)[0];
  $('report').innerHTML = `
    <p class="kicker" style="color:${color}">2076 · ${run.label} · ${run.share}</p>
    <h2>${who} ran the planet for 50 years.</h2>
    <div class="big">
      <div><b style="color:${f.warmingC >= 2 ? 'var(--bad)' : 'var(--good)'}">${f.warmingC.toFixed(2)} °C</b><span>warmer than pre-industrial</span></div>
      <div><b>+${Math.round(f.seaLevelM * 100)} cm</b><span>sea level since 2026</span></div>
      <div><b style="color:var(--mid)">${f.displacedM.toFixed(0)}M</b><span>people flooded out</span></div>
      <div><b>${f.populationBn.toFixed(1)} bn</b><span>people alive</span></div>
    </div>
    <p class="line">${plural(bad, 'disaster')}, ${plural(good, 'breakthrough')}. Across all ${res.runs.toLocaleString('en')} futures,
      <b>${Math.round(res.stats.p2C * 100)}%</b> stay below 2 °C.
      ${who === 'The AI' ? `It spent least on ${low.label.toLowerCase()} (${low.v}).` : ''}</p>
    ${duel()}
    <div class="actions">
      <button class="primary" id="report-again">Watch another future</button>
      <button class="secondary" id="report-beat">${state.mode === 'ai' ? 'Try to beat the AI' : 'Compare with the AI'}</button>
    </div>
    <p class="fine">Possible futures, not predictions.</p>`;
  $('report').classList.toggle('compact', Boolean(state.results.ai && state.results.human));
  $('report').classList.remove('hidden');
  document.body.classList.add('reporting');
  $('report-again').onclick = () => {
    hideReport();
    state.which = { likely: 'worst', worst: 'best', best: 'likely' }[state.which];
    drawResults(); setYear(START_YEAR); autoplay(300);
  };
  $('report-beat').onclick = () => {
    hideReport();
    if (state.mode === 'ai') setMode('human');
    else { setMode('ai'); if (!state.results.ai) letAiDecide(); }
  };
}

setMode('ai');
