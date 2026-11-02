/** Thousands of futures from one policy mix, and an AI that picks the mix. */

import { simulateRun } from './simulate.js';
import { LEVERS, BUDGET, fitBudget, normalizePolicies } from './policies.js';
import { mulberry32 } from './rng.js';

const quantile = (sorted, q) => sorted[Math.round(q * (sorted.length - 1))];
const r2 = (v) => Math.round(v * 100) / 100;

export function runMonteCarlo(policies, { runs = 5000, seed = 2026 } = {}) {
  const all = [];
  for (let i = 0; i < runs; i++) all.push(simulateRun(policies, seed * 100003 + i));
  const byScore = [...all].sort((a, b) => a.score - b.score);
  const scores = byScore.map((r) => r.score);
  const p5 = quantile(scores, 0.05), p50 = quantile(scores, 0.5), p95 = quantile(scores, 0.95);
  const nearest = (target) => byScore.reduce((b, r) => (Math.abs(r.score - target) < Math.abs(b.score - target) ? r : b));
  const share = (f) => r2(all.filter(f).length / runs);
  const warm = all.map((r) => r.final.warmingC).sort((a, b) => a - b);
  const sea = all.map((r) => r.final.seaLevelM).sort((a, b) => a - b);

  // Histogram of scores in 20 bins, for the "how likely" bar.
  const lo = scores[0], hi = scores.at(-1), bins = 20, width = (hi - lo) / bins || 1;
  const histogram = Array.from({ length: bins }, (_, i) => ({ from: r2(lo + i * width), count: 0 }));
  for (const s of scores) histogram[Math.min(bins - 1, Math.floor((s - lo) / width))].count++;

  return {
    policies, runs, seed,
    best: { ...nearest(p95), label: 'Best case', share: 'top 5% of futures' },
    likely: { ...nearest(p50), label: 'Most likely', share: 'the middle of all futures' },
    worst: { ...nearest(p5), label: 'Scariest', share: 'worst 5% of futures' },
    stats: {
      p1_5C: share((r) => r.final.warmingC < 1.5),
      p2C: share((r) => r.final.warmingC < 2),
      tippingShare: share((r) => r.events.some((e) => e.id === 'tipping')),
      warShare: share((r) => r.events.some((e) => e.id === 'war')),
      breakthroughShare: share((r) => r.events.some((e) => e.id === 'breakthrough')),
      medianWarming: quantile(warm, 0.5), warming90: [quantile(warm, 0.05), quantile(warm, 0.95)],
      medianSeaLevel: quantile(sea, 0.5),
      scoreQuantiles: { p5, p50, p95 },
    },
    histogram,
  };
}

/** What the AI optimizes: a good typical future, with extra weight on avoiding the worst ones. */
const objective = (f) => f.stats.scoreQuantiles.p50 + 0.5 * f.stats.scoreQuantiles.p5;

/**
 * The AI in charge: random search over budget-fitting policy mixes, then hill
 * climbing (moving 10 points between levers). Same seeds for every candidate,
 * so mixes are compared on the same luck.
 */
export function optimizePolicies({ candidates = 60, runs = 300, seed = 2026, steps = 40, onProgress } = {}) {
  const rand = mulberry32(seed);
  const evaluate = (p) => runMonteCarlo(p, { runs, seed });
  let best = null;
  const consider = (p) => {
    const futures = evaluate(p);
    const value = objective(futures);
    if (!best || value > best.value) best = { policies: p, futures, value };
  };
  for (let i = 0; i < candidates; i++) {
    const raw = Object.fromEntries(LEVERS.map(({ key }) => [key, rand() * 100]));
    const total = LEVERS.reduce((s, { key }) => s + raw[key], 0);
    consider(fitBudget(normalizePolicies(Object.fromEntries(LEVERS.map(({ key }) => [key, (raw[key] * BUDGET) / total])))));
    onProgress?.(i / (candidates + steps));
  }
  for (let i = 0; i < steps; i++) {
    const from = LEVERS[Math.floor(rand() * LEVERS.length)].key;
    const to = LEVERS[Math.floor(rand() * LEVERS.length)].key;
    if (from === to || best.policies[from] < 10 || best.policies[to] > 90) continue;
    consider({ ...best.policies, [from]: best.policies[from] - 10, [to]: best.policies[to] + 10 });
    onProgress?.((candidates + i) / (candidates + steps));
  }
  const full = runMonteCarlo(best.policies, { runs: 5000, seed });
  return { policies: best.policies, futures: full, rationale: explain(best.policies, full) };
}

/** Plain-language reasons for the AI's mix, from the levers it chose. */
export function explain(p, futures) {
  const ranked = LEVERS.map((l) => ({ ...l, v: p[l.key] })).sort((a, b) => b.v - a.v);
  const top = ranked.slice(0, 2), low = ranked.at(-1);
  return [
    `Spent most of the budget on ${top[0].label.toLowerCase()} (${top[0].v}) and ${top[1].label.toLowerCase()} (${top[1].v}).`,
    `Spent least on ${low.label.toLowerCase()} (${low.v}): it moved the outcomes least per point.`,
    `Result over ${futures.runs.toLocaleString('en')} futures: median ${futures.stats.medianWarming} °C by 2076, ` +
      `${Math.round(futures.stats.p2C * 100)}% of futures stay below 2 °C.`,
  ];
}
