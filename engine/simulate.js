/**
 * One possible future: 50 years, year by year, from a policy mix and a seed.
 * Warming and sea level follow the SSP pathway the policies point to, scaled
 * by an uncertain climate sensitivity; chance events push the run around.
 */

import { mulberry32, normal, pick } from './rng.js';
import { START_YEAR, END_YEAR, WARMING_NOW, SSPS, POPULATION, HOTSPOTS, EVENTS } from './data.js';
import { emissionIndex, policyCost } from './policies.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r2 = (v) => Math.round(v * 100) / 100;
const SPAN = END_YEAR - START_YEAR;

/** Value along the SSP list for an emission index 0..1. */
function alongSsps(e, field) {
  const x = clamp(e, 0, 1) * (SSPS.length - 1);
  const i = Math.min(Math.floor(x), SSPS.length - 2);
  return SSPS[i][field] + (SSPS[i + 1][field] - SSPS[i][field]) * (x - i);
}

export function populationAt(year) {
  for (let i = 1; i < POPULATION.length; i++) {
    const [y1, v1] = POPULATION[i];
    const [y0, v0] = POPULATION[i - 1];
    if (year <= y1) return v0 + ((v1 - v0) * (year - y0)) / (y1 - y0);
  }
  return POPULATION.at(-1)[1];
}

const warmShape = (t) => Math.pow(t / SPAN, 1.1);
const seaShape = (t) => Math.pow(t / SPAN, 1.3);

export function simulateRun(policies, seed) {
  const rand = mulberry32(seed);
  const sensitivity = Math.exp(0.18 * normal(rand));
  const s = {
    trendC: WARMING_NOW, seaLevelM: 0, warmingC: WARMING_NOW, wellbeing: 62,
    deathsM: 0, displacedM: 0, emissionShift: 0, extraWarming: 0, extraSea: 0, coolingYears: 0,
  };
  const happened = new Set();
  const years = [];
  const events = [];
  const cost = policyCost(policies);

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    const t = year - START_YEAR;
    if (t > 0) {
      const e = emissionIndex(policies) + s.emissionShift;
      const dShape = warmShape(t) - warmShape(t - 1);
      s.trendC += (alongSsps(e, 'warming2076') - WARMING_NOW) * sensitivity * dShape;
      s.seaLevelM += alongSsps(e, 'seaRise2076') * (0.5 + 0.5 * sensitivity) * (seaShape(t) - seaShape(t - 1));
      // Locked-in shocks (tipping points) arrive over about ten years.
      const extraW = Math.min(s.extraWarming, 0.025);
      const extraS = Math.min(s.extraSea, 0.005);
      s.trendC += extraW; s.extraWarming -= extraW;
      s.seaLevelM += extraS; s.extraSea -= extraS;
    }
    const cooling = s.coolingYears > 0 ? 0.3 : 0;
    if (s.coolingYears > 0) s.coolingYears--;
    s.warmingC = s.trendC + 0.05 * normal(rand) - cooling;

    if (t > 0) {
      for (const ev of EVENTS) {
        if (ev.once && happened.has(ev.id)) continue;
        if (rand() < ev.chance(s, policies)) {
          happened.add(ev.id);
          const where = pick(rand, ev.places);
          const impact = ev.effect(s, policies);
          events.push({ year, id: ev.id, title: ev.title, kind: ev.kind, ...where, impact });
        }
      }
      const excess = Math.max(0, s.warmingC - 1.5);
      s.wellbeing +=
        0.12 + 0.1 * (policies.tech / 100) + 0.06 * (policies.cooperation / 100)
        - cost / 50 - 0.25 * excess * (1 - 0.4 * policies.adaptation / 100);
      s.wellbeing = clamp(s.wellbeing, 0, 100);
    }

    const protect = 1 - 0.8 * (policies.adaptation / 100);
    s.displacedM = HOTSPOTS.reduce(
      (sum, h) => sum + Math.min(h.exposureM * 1.2, h.exposureM * (s.seaLevelM / 0.5)) * protect, 0);

    years.push({
      year, warmingC: r2(s.warmingC), seaLevelM: Math.round(s.seaLevelM * 1000) / 1000,
      populationBn: r2(populationAt(year) - s.deathsM / 1000), wellbeing: r2(s.wellbeing),
      displacedM: r2(s.displacedM), deathsM: r2(s.deathsM),
    });
  }

  const final = { ...years.at(-1) };
  delete final.year;
  const score = r2(
    final.wellbeing - 12 * Math.max(0, final.warmingC - 1.5) - 0.08 * final.displacedM - 0.15 * final.deathsM,
  );
  return { seed, score, years, events, final };
}

/** Where each coastal hotspot stands in a given year of a run. */
export function hotspotsAt(run, year, adaptation) {
  const row = run.years.find((y) => y.year === year) ?? run.years.at(-1);
  const protect = 1 - 0.8 * (adaptation / 100);
  return HOTSPOTS.map((h) => ({
    ...h,
    displacedM: r2(Math.min(h.exposureM * 1.2, h.exposureM * (row.seaLevelM / 0.5)) * protect),
  }));
}
