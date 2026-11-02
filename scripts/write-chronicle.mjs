// The film's chronicle: the AI's most likely future told place by place, in
// photoreal 3D with GEV's HUD off and slow continuous camera moves. Every place
// and number comes from the engine run (seed 2026); see docs/film.md.
// Writes out/chronicle.scenes.json and gods-eye-view/public/scene-assets/chronicle/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { optimizePolicies } from '../engine/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gev = join(root, '..', 'gods-eye-view');
const ai = optimizePolicies({ seed: 2026 }).futures;
const seaRise = ai.likely.final.seaLevelM;

const ell = 'ellipsoid';
const rad = Math.PI / 180;
/** A camera `dist` metres from a target, looking at it along `heading` with `pitch` (degrees, negative = down). */
function look(lat, lon, ground, heading, pitch, dist) {
  const horiz = dist * Math.cos(Math.abs(pitch) * rad), up = dist * Math.sin(Math.abs(pitch) * rad);
  const dLat = -(horiz * Math.cos(heading * rad)) / 111_320;
  const dLon = -(horiz * Math.sin(heading * rad)) / (111_320 * Math.cos(lat * rad));
  return { lat: +(lat + dLat).toFixed(5), lon: +(lon + dLon).toFixed(5), alt: Math.round(ground + up), heading, pitch, roll: 0, altitudeReference: ell };
}
const space = (lat, lon, alt) => ({ lat, lon, alt, heading: 0, pitch: -90, roll: 0, altitudeReference: ell });

// Ground heights (WGS84 ellipsoid metres): Miami sea -27.3, Dhaka -42.8 (GEV get_terrain_height);
// Boston about -23, Shanghai about +14, Kyiv about +197 (geoid estimates; cameras keep 500 m+ clearance).
const SEA_MIAMI = -27.3;
const water = SEA_MIAMI + seaRise + 2.5;
const ring = [[-80.175, 25.755], [-80.115, 25.755], [-80.115, 25.83], [-80.175, 25.83], [-80.175, 25.755]].map(([a, b]) => [a, b, +water.toFixed(2)]);
const assets = {
  'chronicle/miami.geojson': { type: 'FeatureCollection', features: [{ type: 'Feature', id: 'water', properties: { tone: 'water' }, geometry: { type: 'Polygon', coordinates: [ring] } }] },
};

const clean = { style: 'normal', mapStack: 'photoreal', bloom: { enabled: true, intensity: 18, version: 2 }, hud: { visible: false, variant: 'tactical' }, scope: { enabled: false, featherPct: 35 } };
const shot = (id, title, from, to, secs, packs = []) => ({
  id, title, durationSec: secs, holdSec: 0.5, camera: to, move: { from, easing: 'linear' }, visual: clean, layers: {}, dataPackIds: packs,
});

const shots = [
  shot('earth-open', '2026 · the planet', space(12, 70, 32_000_000), space(22, 40, 19_000_000), 10),
  shot('earth-2032', '2032 · 1.5 °C', space(32, 10, 19_000_000), space(36, -35, 16_000_000), 9),
  // Boston: low over the Charles River, sweeping round towards downtown.
  shot('boston', '2035 · Boston', look(42.3555, -71.0640, -23, 250, -18, 3200), look(42.3555, -71.0640, -23, 305, -20, 1500), 10),
  // Shanghai: across the Huangpu from the Bund towards the Pudong towers.
  shot('shanghai', '2050 · Shanghai', look(31.2380, 121.4990, 14, 60, -14, 3000), look(31.2380, 121.4990, 14, 95, -16, 1400), 10),
  // Kyiv: descending over the river towards the centre.
  shot('kyiv', '2067 · Eastern Europe', look(50.4501, 30.5234, 197, 200, -40, 4200), look(50.4501, 30.5234, 197, 150, -22, 1800), 10),
  // Miami Beach: low over the bay, pushing in on the flooded streets.
  shot('miami', '2076 · Miami Beach', look(25.7907, -80.1300, SEA_MIAMI, 80, -12, 2600), look(25.7907, -80.1300, SEA_MIAMI, 100, -14, 1100), 10, ['miami']),
  // Dhaka: a slow pass over the dense city.
  shot('dhaka', '2076 · Dhaka', look(23.7937, 90.4066, -42.8, 0, -24, 3400), look(23.7937, 90.4066, -42.8, 60, -20, 1700), 10),
  shot('earth-end', '2076 · the planet', space(24, 90, 1_500_000), space(18, 60, 26_000_000), 12),
];

const document = {
  version: 5,
  scenes: [{
    id: 'chronicle', title: 'AI Runs the Planet · Chronicle',
    dataPacks: [{
      id: 'miami', version: 1, format: 'geojson', source: { adapter: 'assets', path: 'chronicle/miami.geojson' },
      attribution: { text: `Water at ${Math.round(seaRise * 100)} cm of 2076 sea-level rise plus a 2.5 m hurricane surge. Simulated, not a prediction.`, license: 'CC BY 4.0' },
      placement: { altitudeReference: ell },
    }],
    shots,
  }],
};

const { parseSceneDocument } = await import(join(gev, 'src/director/document.js'));
parseSceneDocument(JSON.stringify(document));
for (const [path, fc] of Object.entries(assets)) {
  const file = join(gev, 'public', 'scene-assets', path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(fc));
}
writeFileSync(join(gev, 'public', 'scene-assets', 'chronicle', 'chronicle.scenes.json'), JSON.stringify(document));
mkdirSync(join(root, 'out'), { recursive: true });
writeFileSync(join(root, 'out', 'chronicle.scenes.json'), JSON.stringify(document, null, 2));
const total = shots.reduce((s, x) => s + x.durationSec + x.holdSec, 0);
console.log(`chronicle: ${shots.length} shots, ${total} s; Miami water ${water.toFixed(2)} m`);
