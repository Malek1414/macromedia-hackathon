/** Fallback demo: the engine's three futures on a keyless Cesium globe. */
import { LEVERS, BUDGET, normalizePolicies, fitBudget, hotspotsAt, cameraFor, START_YEAR, END_YEAR } from '../engine/index.js';

if (!window.cesiumReady) await new Promise((resolve) => document.addEventListener('cesium-ready', resolve, { once: true }));

const $ = (id) => document.getElementById(id);
const COLORS = { best: '#3ee08f', likely: '#ffc53d', worst: '#ff4d5e' };

// Claude's own choice, made through God's Eye View's simulate_future MCP tool
// (results/claude-in-charge.txt), with its reasons in its own words.
const CLAUDE = {
  policies: normalizePolicies({ energy: 80, carbonPrice: 70, adaptation: 50, food: 30, cooperation: 60, tech: 70 }),
  why: 'I front-loaded decarbonization (energy, carbonPrice, tech) since it has the most leverage on bending the warming curve, backed by cooperation to keep nations aligned and adaptation to shield people from warming already locked in, with food getting the smallest share.',
};
const WHO = { ai: 'The AI optimizer', claude: 'Claude', human: 'The audience' };

const state = {
  mode: 'ai',
  policies: {
    ai: normalizePolicies({ energy: 60, carbonPrice: 60, adaptation: 60, food: 60, cooperation: 60, tech: 60 }),
    claude: CLAUDE.policies,
    human: normalizePolicies({ energy: 60, carbonPrice: 60, adaptation: 60, food: 60, cooperation: 60, tech: 60 }),
  },
  results: { ai: null, claude: null, human: null },
  rationale: { ai: [], claude: [CLAUDE.why], human: [] },
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
window.__viewer = viewer; // for performance checks from the console
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
viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(10, 10, 60_000_000) });
viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(30, 15, 17_000_000), duration: 4.5,
  easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT });
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

/** A soft disc that fades from `css` in the middle to nothing at the edge: heat and flooding read as glow, not stickers. */
const softCache = new Map();
function softDisc(css, core = 0.15) {
  const key = css + core;
  if (softCache.has(key)) return softCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, css + 'ff');
  grad.addColorStop(core, css + 'cc');
  grad.addColorStop(0.55, css + '55');
  grad.addColorStop(1, css + '00');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  softCache.set(key, c);
  return c;
}

// Where events spread to: pandemics travel, wars send shock through markets, breakthroughs diffuse.
const SPREAD_TO = {
  pandemic: [[51.5, -0.13], [40.7, -74], [35.7, 139.7], [-23.5, -46.6], [28.6, 77.2], [6.5, 3.4], [55.8, 37.6]],
  war: [[50.1, 8.7], [40.7, -74], [31.2, 121.5], [25.3, 55.3]],
  breakthrough: [[52.5, 13.4], [31.2, 121.5], [37.8, -122.4], [19.1, 72.9], [-33.9, 18.4], [-23.5, -46.6]],
  aiboom: [[51.5, -0.13], [35.7, 139.7], [12.97, 77.6], [1.35, 103.8], [-33.9, 151.2]],
  treaty: [[39.9, 116.4], [38.9, -77], [28.6, 77.2], [-15.8, -47.9], [-1.3, 36.8]],
};

/** A great-circle arc lifted off the surface, as points. */
function arcPoints(lat1, lon1, lat2, lon2, n = 48) {
  const geo = new Cesium.EllipsoidGeodesic(Cesium.Cartographic.fromDegrees(lon1, lat1), Cesium.Cartographic.fromDegrees(lon2, lat2));
  const lift = Math.min(1_800_000, geo.surfaceDistance * 0.18);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const c = geo.interpolateUsingFraction(t);
    pts.push(Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, Math.sin(Math.PI * t) * lift));
  }
  return pts;
}

// Animations keep their own clock per event, so redrawing every year does not restart them.
const firstSeen = new Map();
const nowS = () => performance.now() / 1000;
function bornAt(key) {
  if (!firstSeen.has(key)) firstSeen.set(key, nowS());
  return firstSeen.get(key);
}

/** A thin ring that fades at its edges: the ripple sent out by an event. */
let ringCanvas = null;
function ring() {
  if (ringCanvas) return ringCanvas;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 96, 128, 128, 128);
  grad.addColorStop(0, '#ffffff00');
  grad.addColorStop(0.55, '#ffffffff');
  grad.addColorStop(1, '#ffffff00');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return (ringCanvas = c);
}

// Entities live across years: drawGlobe adds what is new, updates what changed and
// removes what is gone, so playback never rebuilds the whole planet (it ran at 4 fps).
const live = new Map();
let liveRun = null;
function keep(key, make) {
  let e = live.get(key);
  if (!e) { e = entities.entities.add(make()); live.set(key, e); }
  return e;
}
// Values the callbacks read; drawGlobe only changes these numbers.
const sizes = new Map();

function drawGlobe() {
  const run = currentRun();
  const res = state.results[state.mode];
  const runKey = run ? `${state.mode}:${state.which}:${run.seed}` : null;
  if (runKey !== liveRun) { entities.entities.removeAll(); live.clear(); sizes.clear(); liveRun = runKey; }
  if (!run) { setHeat(0); return; }
  const row = run.years.find((y) => y.year === state.year);
  const wanted = new Set();

  // Coastal cities losing people to the sea: a soft amber glow sized by displacement, breathing slowly.
  for (const h of hotspotsAt(run, state.year, res.policies.adaptation)) {
    if (h.displacedM < 0.05) continue;
    const key = `coast:${h.id}`;
    wanted.add(key);
    sizes.set(key, 2 * (70_000 + Math.sqrt(h.displacedM) * 170_000));
    const phase = (h.lat + h.lon) * 0.1;
    const e = keep(key, () => ({
      position: Cesium.Cartesian3.fromDegrees(h.lon, h.lat),
      billboard: {
        image: softDisc(AMBER, 0.08), sizeInMeters: true,
        width: new Cesium.CallbackProperty(() => sizes.get(key), false),
        height: new Cesium.CallbackProperty(() => sizes.get(key), false),
        color: new Cesium.CallbackProperty(() => Cesium.Color.WHITE.withAlpha(0.6 + 0.2 * Math.sin(nowS() * 1.6 + phase)), false),
      },
      point: { pixelSize: 6, color: Cesium.Color.fromCssColorString('#ffe2a8') },
      label: {
        text: '', font: '600 11px JetBrains Mono', fillColor: Cesium.Color.fromCssColorString('#ffd27a'), showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('#05070b').withAlpha(0.7), backgroundPadding: new Cesium.Cartesian2(6, 4),
        pixelOffset: new Cesium.Cartesian2(0, -20), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 9_000_000),
      },
    }));
    e.label.text = h.displacedM >= 1 ? `${h.place.toUpperCase()}  ${h.displacedM.toFixed(1)}M` : '';
  }

  // Events: a glow for every one so far; recent ones flash in, ripple, carry a label and spread along arcs.
  for (const e of run.events.filter((x) => x.year <= state.year)) {
    const css = e.kind === 'good' ? GREEN : RED;
    const color = Cesium.Color.fromCssColorString(css);
    const age = state.year - e.year;
    const recent = age <= 2;
    const id = `ev:${e.year}:${e.id}`;
    const born = bornAt(`${runKey}:${id}`);
    const pos = Cesium.Cartesian3.fromDegrees(e.lon, e.lat);
    wanted.add(id);
    sizes.set(id, recent ? 1 : 0);
    const ent = keep(id, () => ({
      position: pos,
      billboard: {
        image: glow(css), disableDepthTestDistance: 0,
        scale: new Cesium.CallbackProperty(() => {
          if (!sizes.get(id)) return 0.55;
          const t = nowS() - born;
          return t < 0.5 ? 0.4 + 2.2 * (t / 0.5) : 1.15 + 0.3 * Math.sin(t * 4);
        }, false),
      },
      label: {
        text: `${e.year}  ${e.title.toUpperCase()}\n${e.place} · ${e.impact}`, font: '600 13px Inter', fillColor: color,
        showBackground: true, backgroundColor: Cesium.Color.fromCssColorString('#05070b').withAlpha(0.78),
        backgroundPadding: new Cesium.Cartesian2(8, 6), pixelOffset: new Cesium.Cartesian2(0, -34),
      },
    }));
    ent.label.show = recent;
    ent.billboard.color = Cesium.Color.WHITE.withAlpha(recent ? 1 : 0.5);
    if (!recent) continue;
    // Three ripples a third of a cycle apart, easing out as they grow (camera-facing, sized in metres).
    const reach = e.kind === 'good' ? 1_300_000 : 2_000_000;
    for (const [n, phase] of [0, 1 / 3, 2 / 3].entries()) {
      const key = `${id}:ripple${n}`;
      wanted.add(key);
      const t = () => ((nowS() - born) / 2.4 + phase) % 1;
      const size = () => 80_000 + (1 - Math.pow(1 - t(), 3)) * reach;
      keep(key, () => ({
        position: pos,
        billboard: {
          image: ring(), sizeInMeters: true,
          width: new Cesium.CallbackProperty(size, false),
          height: new Cesium.CallbackProperty(size, false),
          color: new Cesium.CallbackProperty(() => color.withAlpha(0.75 * Math.pow(1 - t(), 1.5)), false),
        },
      }));
    }
    // Arcs: the event reaching the rest of the world, drawn out over 1.6 s, then fixed in place.
    for (const [i, [lat, lon]] of (SPREAD_TO[e.id] ?? []).entries()) {
      const key = `${id}:arc${i}`;
      wanted.add(key);
      const arc = keep(key, () => {
        const pts = arcPoints(e.lat, e.lon, lat, lon);
        const delay = i * 0.12;
        const entity = {
          polyline: {
            positions: new Cesium.CallbackProperty(() => {
              const f = Math.max(0, Math.min(1, (nowS() - born - delay) / 1.6));
              return pts.slice(0, Math.max(2, Math.ceil(f * pts.length)));
            }, false),
            width: 9, arcType: Cesium.ArcType.NONE,
            material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.28, taperPower: 0.85, color: color.withAlpha(0.85) }),
          },
        };
        // Once drawn, the arc stops being recomputed every frame.
        setTimeout(() => { const a = live.get(key); if (a) a.polyline.positions = pts; }, (1.7 + delay) * 1000);
        return entity;
      });
      arc.polyline.material = new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.28, taperPower: 0.85, color: color.withAlpha(Math.max(0.25, 0.85 - age * 0.25)) });
    }
  }

  // Heat stress: soft orange glows that spread with every tenth of a degree above 1.5 °C.
  const stress = Math.max(0, row.warmingC - 1.45);
  sizes.set('heat', 2 * (220_000 + stress * 1_100_000));
  sizes.set('heatAlpha', Math.min(0.85, 0.25 + stress * 0.55));
  if (stress > 0) {
    for (const [lat, lon] of HEAT_ZONES) {
      const key = `heat:${lat}:${lon}`;
      wanted.add(key);
      keep(key, () => ({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        billboard: {
          image: softDisc(HEAT, 0.2), sizeInMeters: true,
          width: new Cesium.CallbackProperty(() => sizes.get('heat'), false),
          height: new Cesium.CallbackProperty(() => sizes.get('heat') * 0.8, false),
          color: new Cesium.CallbackProperty(() => Cesium.Color.WHITE.withAlpha(sizes.get('heatAlpha')), false),
        },
      }));
    }
  }

  for (const [key, e] of live) if (!wanted.has(key)) { entities.entities.remove(e); live.delete(key); }
  setHeat(Math.max(0, row.warmingC - 1.4));
}

/** The planet runs a fever: a red vignette over the screen and warmer imagery as it heats up. */
function setHeat(heat) {
  $('heatveil').style.opacity = Math.min(0.85, heat * 0.45);
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
  // Events that spread get a wider shot, so the arcs leaving them are in frame.
  if (SPREAD_TO[e.id]) flyToPoint(e.lon, e.lat, 9_500_000, -75, 1.8);
  else flyToPoint(e.lon, e.lat, 3_800_000, -58, 1.8);
}

function flyToYear(year) {
  const run = currentRun();
  if (!run) return;
  const cam = cameraFor(run, year);
  if (cam.event) flyToPoint(cam.event.lon, cam.event.lat, 4_200_000, -60, 2.2);
  else flyToPoint(30, 15, 17_000_000, -90, 2.2);
}

// ---------- HUD + timeline ----------
/** Numbers glide to their new value instead of jumping (about one playback step). */
const shown = new Map();
function tween(id, to, fmt, ms = 380) {
  const el = $(id);
  const from = shown.has(id) ? shown.get(id) : to;
  shown.set(id, to);
  const t0 = performance.now();
  cancelAnimationFrame(el._raf);
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) el._raf = requestAnimationFrame(step);
  };
  step();
}

function drawHud() {
  const run = currentRun();
  const row = run ? run.years.find((y) => y.year === state.year) : null;
  $('hud-year').textContent = state.year;
  tween('hud-warm', row ? row.warmingC : 1.4, (v) => `${v.toFixed(2)} °C`);
  tween('hud-sea', row ? row.seaLevelM * 100 : 0, (v) => `+${Math.round(v)} cm`);
  tween('hud-pop', row ? row.populationBn : 8.2, (v) => `${v.toFixed(2)} bn`);
  tween('hud-disp', row ? row.displacedM : 0, (v) => `${v.toFixed(1)}M`);
  tween('hud-wb', row ? row.wellbeing : 62, (v) => `${Math.round(v)}`);
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
  let quietStop = 0;
  const playingMode = state.mode;
  state.playing = setInterval(() => {
    // The tab changed or its future is gone: stop instead of playing something else.
    if (state.mode !== playingMode || !currentRun()) return stop();
    if (state.year >= END_YEAR) {
      stop();
      // End on the whole planet.
      flyToPoint(30, 15, 17_000_000, -90, 2.5);
      setTimeout(() => { if (state.mode === playingMode && !state.playing) showReport(); }, 1800);
      return;
    }
    const next = state.year + 1;
    setYear(next);
    const now = currentRun().events.filter((e) => e.year === next);
    const ev = now.find((e) => e.kind === 'bad') ?? now[0];
    if (ev && next - lastFly >= 3) { lastFly = next; flyToEvent(ev); showBanner(ev); }
    else if (!ev && next - lastFly >= 7) {
      // Quiet years: visit the coast losing the most people, then the whole planet.
      lastFly = next;
      quietStop = (quietStop + 1) % 2;
      if (quietStop === 1) {
        const worst = hotspotsAt(currentRun(), next, state.results[state.mode].policies.adaptation)
          .sort((a, b) => b.displacedM - a.displacedM)[0];
        flyToPoint(worst.lon, worst.lat, 4_500_000, -55, 2.6);
      } else flyToPoint(30, 15, 17_000_000, -90, 2.6);
    }
  }, 420);
}
$('btn-play').addEventListener('click', play);
document.addEventListener('keydown', (e) => { if (e.code === 'Space' && e.target.tagName !== 'INPUT') { e.preventDefault(); play(); } });

// ---------- levers ----------
function drawLevers() {
  const p = state.policies[state.mode];
  const locked = state.mode !== 'human';
  $('levers').innerHTML = LEVERS.map(({ key, label, help }) => `
    <div class="lever ${locked && state.results.ai && p[key] <= 5 ? 'starved' : ''}">
      <div class="row"><span>${label}</span><b id="v-${key}">${p[key]}</b></div>
      <small>${help}</small>
      <input type="range" min="0" max="100" value="${p[key]}" data-key="${key}" ${locked ? 'disabled' : ''} />
    </div>`).join('');
  drawBudget();
  $('btn-ai').classList.toggle('hidden', state.mode !== 'ai');
  $('btn-run').textContent = state.mode === 'claude' ? "Run Claude's 5,000 futures" : 'Run 5,000 futures';
  const reasons = state.rationale.ai;
  $('who-hint').classList.toggle('reason', state.mode === 'claude' || (locked && reasons.length > 0));
  $('who-hint').innerHTML = state.mode === 'claude'
    ? `<b>Claude chose these levers itself</b>, through the God's Eye View tools: “${CLAUDE.why}”`
    : locked && reasons.length
    ? `<b>The AI's reasoning:</b> ${reasons[0]} ${reasons[1]}`
    : locked
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
  stop();
  clearTimeout(autoplayTimer);
  hideReport();
  state.mode = mode;
  setLeftCollapsed(false);
  for (const m of ['ai', 'claude', 'human']) $(`tab-${m === 'human' ? 'human' : m}`).classList.toggle('active', mode === m);
  drawLevers();
  drawResults();
  setYear(state.year);
}
$('tab-ai').addEventListener('click', () => setMode('ai'));
$('tab-human').addEventListener('click', () => setMode('human'));
$('tab-claude').addEventListener('click', () => { setMode('claude'); if (!state.results.claude) runFutures('claude'); });

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
  if (mode === 'human') state.rationale.human = rationale;
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

let deciding = false;
async function letAiDecide() {
  if (deciding) return;
  deciding = true;
  try { await decide(); } finally { deciding = false; }
}
async function decide() {
  stop();
  clearTimeout(autoplayTimer);
  const { policies, futures, rationale } = await thinking(aiChoice);
  $('btn-ai').disabled = $('btn-run').disabled = true;
  // Animate the sliders to the AI's choice.
  const from = { ...state.policies.ai };
  const t0 = performance.now();
  await new Promise((done) => {
    const step = () => {
      // Eased, and slow enough to read: this is the moment the AI makes its choice.
      const x = Math.min(1, (performance.now() - t0) / 2000);
      const k = 1 - Math.pow(1 - x, 3);
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
  // Leave the choice and its reasons on screen for a moment, then give the globe the stage.
  const linger = state.mode === 'human' ? 1200 : 3200;
  setTimeout(() => setLeftCollapsed(true), linger);
  autoplay(linger + 500);
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

/** Everyone who has run, head to head on the most likely future (needs two). */
function duel() {
  const players = ['ai', 'claude', 'human'].filter((m) => state.results[m]);
  if (players.length < 2) return '';
  const metrics = [
    ['Warming by 2076', (r) => r.stats.medianWarming, (v) => `${v} °C`, 'low'],
    ['Futures below 2 °C', (r) => r.stats.p2C * 100, (v) => `${Math.round(v)}%`, 'high'],
    ['Flooded out', (r) => r.likely.final.displacedM, (v) => `${Math.round(v)}M`, 'low'],
    ['Deaths', (r) => r.likely.final.deathsM, (v) => `${Math.round(v)}M`, 'low'],
  ];
  const wins = Object.fromEntries(players.map((m) => [m, 0]));
  const html = metrics.map(([label, get, fmt, better]) => {
    const vals = players.map((m) => get(state.results[m]));
    const max = Math.max(...vals) || 1;
    const best = better === 'low' ? Math.min(...vals) : Math.max(...vals);
    const winners = players.filter((m, i) => vals[i] === best);
    if (winners.length === 1) wins[winners[0]]++;
    return `<div class="duel-row n${players.length}"><span class="duel-label">${label}</span>${players.map((m, i) =>
      `<div class="duel-bar ${m} ${winners.length === 1 && winners[0] === m ? 'win' : ''}"><i style="width:${(vals[i] / max) * 100}%"></i><b>${fmt(vals[i])}</b></div>`).join('')}</div>`;
  }).join('');
  const ranked = [...players].sort((a, b) => wins[b] - wins[a]);
  const verdict = wins[ranked[0]] === wins[ranked[1]] ? 'No clear winner' : `${WHO[ranked[0]]} wins ${wins[ranked[0]]} of ${metrics.length}`;
  const names = { ai: 'AI', claude: 'Claude', human: 'Audience' };
  return `<div class="duel"><div class="duel-head"><span>${verdict}</span>
    <span class="legend">${players.map((m) => `<i class="${m}"></i>${names[m]}`).join(' ')}</span></div>${html}</div>`;
}

/** Every number in the report's big tiles counts up from zero. */
function countUp(root) {
  for (const b of root.querySelectorAll('.big b')) {
    const m = b.textContent.match(/^([+]?)([\d.]+)(.*)$/);
    if (!m) continue;
    const [, sign, num, unit] = m;
    const to = Number(num), dp = (num.split('.')[1] ?? '').length, t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 1100);
      b.textContent = `${sign}${(to * (1 - Math.pow(1 - k, 3))).toFixed(dp)}${unit}`;
      if (k < 1) requestAnimationFrame(step);
    };
    step();
  }
  // The face-off bars grow in, one row after another.
  root.querySelectorAll('.duel-bar i').forEach((i, n) => {
    const w = i.style.width;
    i.style.width = '0%';
    i.style.transition = `width .9s cubic-bezier(.2,.8,.2,1) ${0.25 + n * 0.06}s`;
    requestAnimationFrame(() => requestAnimationFrame(() => { i.style.width = w; }));
  });
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function showReport() {
  const res = state.results[state.mode];
  const run = currentRun();
  if (!res || !run) return;
  const f = run.final;
  const who = WHO[state.mode];
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
      ${state.mode === 'ai' ? `It spent least on ${low.label.toLowerCase()} (${low.v}).` : ''}</p>
    ${duel()}
    <div class="actions">
      <button class="primary" id="report-again">Watch another future</button>
      <button class="secondary" id="report-beat">${{ ai: 'Try to beat the AI', claude: 'Try to beat both', human: state.results.claude ? 'Back to the AI' : 'See what Claude would do' }[state.mode]}</button>
    </div>
    <p class="fine">Possible futures, not predictions.</p>`;
  $('report').classList.toggle('compact', ['ai', 'claude', 'human'].filter((m) => state.results[m]).length >= 2);
  $('report').classList.remove('hidden');
  document.body.classList.add('reporting');
  countUp($('report'));
  $('report-again').onclick = () => {
    hideReport();
    state.which = { likely: 'worst', worst: 'best', best: 'likely' }[state.which];
    drawResults(); setYear(START_YEAR); autoplay(300);
  };
  $('report-beat').onclick = () => {
    hideReport();
    if (state.mode !== 'human') setMode('human');
    else if (!state.results.claude) { setMode('claude'); runFutures('claude'); }
    else { setMode('ai'); if (!state.results.ai) letAiDecide(); }
  };
}

setMode('ai');
