/**
 * Turns futures into God's Eye View formats: a version-5 scene document with
 * GeoJSON data packs for Director playback, and view annotations (pins and
 * labels) for share links and the MCP panel.
 */

import { hotspotsAt } from './simulate.js';
import { START_YEAR, END_YEAR } from './data.js';

export const WHICH = ['best', 'likely', 'worst'];
const DECADES = [2026, 2036, 2046, 2056, 2066, 2076];
const SCENE_TITLES = { best: 'Best case', likely: 'Most likely', worst: 'Scariest' };
// Each future gets GEV's glow and tactical HUD; the scariest one glows hardest.
const SCENE_VISUALS = {
  best: { style: 'normal', bloom: { enabled: true, intensity: 40, version: 2 }, hud: { visible: true, variant: 'tactical' } },
  likely: { style: 'normal', bloom: { enabled: true, intensity: 55, version: 2 }, hud: { visible: true, variant: 'tactical' } },
  worst: { style: 'normal', bloom: { enabled: true, intensity: 75, version: 2 }, hud: { visible: true, variant: 'tactical' } },
};

const clampYear = (y) => Math.min(END_YEAR, Math.max(START_YEAR, Math.round(y)));
const rowAt = (run, year) => run.years.find((r) => r.year === year) ?? run.years.at(-1);

/** The event that defines a decade of a run: the first bad one, else the first good one. */
export function focusEvent(run, decade) {
  const inDecade = run.events.filter((e) => e.year > decade - 10 && e.year <= decade);
  return inDecade.find((e) => e.kind === 'bad') ?? inDecade[0] ?? null;
}

/** Camera for a year: over that decade's defining event, or a global view. */
export function cameraFor(run, year) {
  const decade = DECADES.find((d) => d >= clampYear(year)) ?? END_YEAR;
  const ev = year > START_YEAR ? focusEvent(run, decade) : null;
  if (!ev) return { lat: 20, lon: 20, alt: 18_000_000, heading: 0, pitch: -90, roll: 0, event: null };
  // The camera hangs south of the event, looking north at it: at this tilt it
  // sees the ground alt / tan(|pitch|) ahead, so step back that far.
  const alt = 2_400_000, pitch = -62;
  const backDeg = alt / Math.tan((Math.abs(pitch) * Math.PI) / 180) / 111_320;
  return ev
    ? { lat: Math.max(-89, ev.lat - backDeg), lon: ev.lon, alt, heading: 0, pitch, roll: 0, event: ev }
    : { lat: 20, lon: 20, alt: 18_000_000, heading: 0, pitch: -90, roll: 0, event: null };
}

/** Pins and labels for everything that happened up to `year` (at most 24). */
export function annotationsFor(run, year, adaptation = 50) {
  const y = clampYear(year);
  const events = run.events.filter((e) => e.year <= y).slice(-16).map((e) => ({
    type: 'pin', latitude: e.lat, longitude: e.lon,
    label: `${e.year} ${e.title}: ${e.impact}`.slice(0, 120),
    color: e.kind === 'good' ? 'green' : 'red',
  }));
  const coast = hotspotsAt(run, y, adaptation)
    .filter((h) => h.displacedM >= 0.3)
    .sort((a, b) => b.displacedM - a.displacedM)
    .slice(0, 24 - events.length)
    .map((h) => ({
      type: 'highlight', latitude: h.lat, longitude: h.lon,
      label: `${h.place}: ${h.displacedM}M displaced by the sea`, color: 'amber',
    }));
  return [...events, ...coast];
}

/** One line for a year, for HUDs and narration. */
export function headline(run, year) {
  const r = rowAt(run, clampYear(year));
  return `${r.year}: ${r.warmingC} °C, sea +${Math.round(r.seaLevelM * 100)} cm, ` +
    `${r.populationBn} bn people, ${r.displacedM}M displaced by the sea`;
}

function decadePack(sceneId, run, decade, adaptation) {
  const id = `${sceneId}-${decade}`;
  const features = [
    ...run.events.filter((e) => e.year <= decade).map((e, i) => ({
      type: 'Feature', id: `${id}-ev-${i}`,
      geometry: { type: 'Point', coordinates: [e.lon, e.lat, 2000] },
      properties: {},
    })),
    ...hotspotsAt(run, decade, adaptation).filter((h) => h.displacedM >= 0.3).map((h) => ({
      type: 'Feature', id: `${id}-coast-${h.id}`,
      geometry: { type: 'Point', coordinates: [h.lon, h.lat, 500] },
      properties: {},
    })),
  ];
  return { id, path: `future/${id}.geojson`, collection: { type: 'FeatureCollection', features } };
}

/** A GEV scene document (version 5): one scene per future, one shot per decade. */
export function toSceneDocument(futures, { title = 'AI Runs the Planet' } = {}) {
  const assets = {};
  const scenes = WHICH.map((which) => {
    const run = futures[which];
    const sceneId = `future-${which}`;
    const packs = DECADES.map((d) => decadePack(sceneId, run, d, futures.policies.adaptation));
    for (const p of packs) assets[p.path] = p.collection;
    return {
      id: sceneId,
      title: `${title}: ${SCENE_TITLES[which]} (${run.share})`,
      dataPacks: packs.map((p) => ({
        id: p.id, version: 1, format: 'geojson',
        source: { adapter: 'assets', path: p.path },
        attribution: {
          text: `Simulated future (seed ${run.seed}), not a prediction. Anchored to IPCC AR6 and UN WPP 2024.`,
          license: 'CC BY 4.0',
        },
        placement: { altitudeReference: 'ellipsoid' },
      })),
      shots: DECADES.map((d) => {
        const cam = cameraFor(run, d);
        return {
          id: `${sceneId}-${d}`,
          title: (cam.event ? `${headline(run, d)}. ${cam.event.title}, ${cam.event.place}` : headline(run, d)).slice(0, 200),
          durationSec: 4,
          holdSec: 3,
          camera: { lat: cam.lat, lon: cam.lon, alt: cam.alt, heading: cam.heading, pitch: cam.pitch, roll: cam.roll },
          visual: SCENE_VISUALS[which],
          dataPackIds: [`${sceneId}-${d}`],
        };
      }),
    };
  });
  return { document: { version: 5, scenes }, assets };
}
