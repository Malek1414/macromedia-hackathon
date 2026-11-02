import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonteCarlo, optimizePolicies } from '../montecarlo.js';
import { normalizePolicies, BUDGET, LEVERS } from '../policies.js';

test('three futures ordered by score, with stats', () => {
  const f = runMonteCarlo(normalizePolicies({}), { runs: 1000, seed: 1 });
  assert.ok(f.best.score >= f.likely.score && f.likely.score >= f.worst.score);
  assert.equal(f.best.label, 'Best case');
  assert.ok(f.stats.p2C >= 0 && f.stats.p2C <= 1);
  assert.equal(f.runs, 1000);
  assert.ok(f.histogram.length > 5);
});

test('5,000 runs take under 2 seconds', () => {
  const t = performance.now();
  runMonteCarlo(normalizePolicies({}), { runs: 5000 });
  assert.ok(performance.now() - t < 2000);
});

test('the optimizer stays in budget and beats doing nothing', () => {
  const ai = optimizePolicies({ seed: 3, candidates: 30, runs: 200 });
  const total = LEVERS.reduce((s, { key }) => s + ai.policies[key], 0);
  assert.ok(total <= BUDGET, String(total));
  const none = runMonteCarlo(normalizePolicies(Object.fromEntries(LEVERS.map((l) => [l.key, 0]))), { runs: 200, seed: 3 });
  assert.ok(ai.futures.stats.scoreQuantiles.p50 > none.stats.scoreQuantiles.p50);
  assert.ok(ai.rationale.length >= 2);
});
