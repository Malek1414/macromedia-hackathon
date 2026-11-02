// The God's Eye View deep dive: the futures played out in real places, in 3D,
// with GEV's live layers (public cameras, flights, military aircraft) running.
// Writes out/deep-dive.scenes.json and its packs into gods-eye-view/public/scene-assets/deep/.
// Import the scene file in GEV (AUTHORING > import > Apply import) and play it.
//
// Heights are WGS84 ellipsoid metres, from GEV's get_terrain_height:
//   Miami Beach ground -25.6 (1.8 m above sea), sea level (geoid) -27.3
//   London Westminster ground 50.6, Los Angeles downtown 51.6, Taiwan Strait sea 15.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { optimizePolicies, runMonteCarlo, normalizePolicies } from '../engine/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gev = join(root, '..', 'gods-eye-view');

// The numbers the shots quote come from the engine, not from this file.
const ai = optimizePolicies({ seed: 2026 }).futures;
const audience = runMonteCarlo(normalizePolicies({ energy: 20, carbonPrice: 20, adaptation: 100, food: 100, cooperation: 20, tech: 100 }), { runs: 5000, seed: 2026 });
const seaRiseM = ai.likely.final.seaLevelM;                // AI's most likely future, 2076
const audienceWarming = audience.likely.final.warmingC;

const SEA_MIAMI = -27.3;                                  // geoid: mean sea level in ellipsoid metres
const SURGE_M = 2.5;                                      // a hurricane surge like Irma's (2017) in South Florida
const water = SEA_MIAMI + seaRiseM + SURGE_M;

const ell = 'ellipsoid';
const pose = (lat, lon, alt, heading, pitch) => ({ lat, lon, alt, heading, pitch, roll: 0, altitudeReference: ell });

/** Great-circle arc lifted off the ground, as [lon, lat, h] positions. */
function arc([lat1, lon1], [lat2, lon2], n = 32) {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const [p1, l1, p2, l2] = [lat1 * rad, lon1 * rad, lat2 * rad, lon2 * rad];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2));
  const lift = Math.min(1_500_000, d * 6_371_000 * 0.15);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    pts.push([+(Math.atan2(y, x) * deg).toFixed(4), +(Math.atan2(z, Math.hypot(x, y)) * deg).toFixed(4), Math.round(Math.sin(Math.PI * f) * lift) + 100]);
  }
  return pts;
}

const feature = (id, geometry, tone) => ({ type: 'Feature', id, properties: { tone }, geometry });
const assets = {};
const pack = (id, features, text) => {
  const path = `deep/${id}.geojson`;
  assets[path] = { type: 'FeatureCollection', features };
  return {
    id, version: 1, format: 'geojson', source: { adapter: 'assets', path },
    attribution: { text: `${text} Simulated future, not a prediction. Anchored to IPCC AR6 and UN WPP 2024.`, license: 'CC BY 4.0' },
    placement: { altitudeReference: ell },
  };
};

// Pandemic: from Wuhan to the world's hubs, ending over London.
const WUHAN = [30.59, 114.31];
const HUBS = [[51.47, -0.45], [40.64, -73.78], [35.55, 139.78], [-23.43, -46.47], [28.56, 77.1], [6.58, 3.32], [55.97, 37.41]];
const pandemic = pack('pandemic', [
  ...HUBS.map((h, i) => feature(`arc-${i}`, { type: 'LineString', coordinates: arc(WUHAN, h) }, 'red')),
  feature('origin', { type: 'Point', coordinates: [WUHAN[1], WUHAN[0], 200] }, 'red'),
  ...HUBS.map((h, i) => feature(`hub-${i}`, { type: 'Point', coordinates: [h[1], h[0], 200] }, 'red')),
], 'New pandemic spreading from its origin to the world\'s air hubs.');

// Miami Beach: the sea of 2076 plus a hurricane surge, as a water surface over the island and the bay.
const ring = [[-80.175, 25.755], [-80.115, 25.755], [-80.115, 25.83], [-80.175, 25.83], [-80.175, 25.755]].map(([lon, lat]) => [lon, lat, +water.toFixed(2)]);
const miami = pack('miami-surge', [
  feature('water', { type: 'Polygon', coordinates: [ring] }, 'water'),
], `Water at ${(seaRiseM * 100).toFixed(0)} cm of 2076 sea-level rise (the AI's most likely future) plus a ${SURGE_M} m hurricane surge like Irma's.`);

// Heat: the hottest districts of Los Angeles marked as heat zones.
const laHeat = pack('la-heat', [
  feature('downtown', { type: 'Point', coordinates: [-118.2437, 34.0522, 400] }, 'heat'),
  feature('valley', { type: 'Point', coordinates: [-118.45, 34.2, 600] }, 'heat'),
  feature('inland', { type: 'Point', coordinates: [-117.6, 34.06, 700] }, 'heat'),
], `Heat in the audience's future: ${audienceWarming} °C above pre-industrial by 2076.`);

// War risk: the strait the model's war events can hit.
const strait = pack('strait', [
  feature('flashpoint', { type: 'Point', coordinates: [119.5, 24.5, 2000] }, 'red'),
  feature('line', { type: 'LineString', coordinates: [[118.2, 23.0, 3000], [120.6, 26.0, 3000]] }, 'red'),
], 'A major war is one of the shocks in the scariest futures.');

const layers = (ids) => Object.fromEntries(ids.map((id) => [id, { enabled: true }]));
const visual = (style = 'normal', bloom = 55) => ({ style, mapStack: 'photoreal', bloom: { enabled: true, intensity: bloom, version: 2 }, hud: { visible: true, variant: 'tactical' } });

const shots = [
  {
    id: 'today', title: '2026 · The planet today, live: every aircraft in the sky right now',
    durationSec: 7, holdSec: 1,
    camera: (pose(28, 20, 14_000_000, 0, -90)),
    move: { from: pose(10, -20, 26_000_000, 0, -90), easing: 'cubic-in-out' },
    visual: visual('normal', 45), layers: layers(['flights']), dataPackIds: [],
  },
  {
    id: 'pandemic', title: '2056 · A new pandemic reaches London (scariest future) · live TfL cameras and flights',
    durationSec: 9, holdSec: 5,
    camera: (pose(51.4885, -0.1290, 50.6 + 650, 8, -27)),
    move: { from: pose(47.0, -0.13, 1_400_000, 0, -70), easing: 'cubic-in-out' },
    visual: visual('normal', 55), layers: layers(['cctv', 'flights']), dataPackIds: ['pandemic'],
  },
  {
    id: 'miami', title: `2076 · Miami Beach: +${Math.round(seaRiseM * 100)} cm of sea plus an Irma-sized surge (the AI's most likely future)`,
    durationSec: 9, holdSec: 6,
    camera: (pose(25.7907, -80.1424, SEA_MIAMI + 420, 90, -18)),
    move: { from: pose(25.35, -80.6, 220_000, 45, -55), easing: 'cubic-in-out' },
    visual: visual('normal', 50), layers: layers(['flights']), dataPackIds: ['miami-surge'],
  },
  {
    id: 'heat', title: `2076 · Los Angeles through a thermal camera: ${audienceWarming} °C in the audience's future · live Caltrans cameras`,
    durationSec: 8, holdSec: 3,
    camera: (pose(34.0413, -118.2303, 51.6 + 850, 315, -26)),
    move: { from: pose(34.0413, -118.2571, 51.6 + 850, 45, -26), easing: 'cubic-in-out' },
    visual: visual('thermal', 60), layers: layers(['cctv', 'flights']), dataPackIds: ['la-heat'],
  },
  {
    id: 'strait', title: 'Scariest futures · major-war risk in the Taiwan Strait · live military aircraft',
    durationSec: 8, holdSec: 4,
    camera: (pose(21.6, 117.4, 650_000, 30, -42)),
    move: { from: pose(15, 112, 2_500_000, 20, -70), easing: 'cubic-in-out' },
    visual: visual('normal', 55), layers: layers(['military', 'flights']), dataPackIds: ['strait'],
  },
  {
    id: 'planet', title: 'Possible futures, not predictions. One world.',
    durationSec: 8, holdSec: 3,
    camera: (pose(20, 30, 24_000_000, 0, -90)),
    move: { from: pose(21.6, 117.4, 650_000, 30, -42), easing: 'cubic-in-out' },
    visual: visual('normal', 45), layers: layers(['flights']), dataPackIds: [],
  },
];

const document = {
  version: 5,
  scenes: [{ id: 'deep-dive', title: 'AI Runs the Planet · Deep dive', dataPacks: [pandemic, miami, laHeat, strait], shots }],
};

const { parseSceneDocument } = await import(join(gev, 'src/director/document.js'));
parseSceneDocument(JSON.stringify(document));
for (const [path, fc] of Object.entries(assets)) {
  const file = join(gev, 'public', 'scene-assets', path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(fc));
}
mkdirSync(join(root, 'out'), { recursive: true });
writeFileSync(join(root, 'out', 'deep-dive.scenes.json'), JSON.stringify(document, null, 2));
writeFileSync(join(gev, 'public', 'scene-assets', 'deep', 'deep-dive.scenes.json'), JSON.stringify(document));
console.log(`deep dive: ${shots.length} shots, ${Object.keys(assets).length} packs; Miami water at ${water.toFixed(2)} m ellipsoid (${(water - SEA_MIAMI).toFixed(2)} m above today's sea)`);
