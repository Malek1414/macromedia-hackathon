import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateRun } from '../simulate.js';
import { normalizePolicies, emissionIndex, LEVERS } from '../policies.js';
import { mulberry32 } from '../rng.js';

const all = (v) => Object.fromEntries(LEVERS.map((l) => [l.key, v]));
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

test('rng is deterministic', () => {
  const a = mulberry32(7), b = mulberry32(7);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('policies fill missing levers with 50 and clamp', () => {
  const p = normalizePolicies({ energy: 140, food: -3 });
  assert.equal(p.energy, 100);
  assert.equal(p.food, 0);
  assert.equal(p.tech, 50);
  assert.ok(emissionIndex(all(100)) < emissionIndex(all(0)));
});

test('same seed gives the same run, 51 yearly rows', () => {
  const p = normalizePolicies({});
  const a = simulateRun(p, 42), b = simulateRun(p, 42);
  assert.deepEqual(a, b);
  assert.equal(a.years.length, 51);
  assert.equal(a.years[0].year, 2026);
  assert.equal(a.years.at(-1).year, 2076);
  assert.ok(Math.abs(a.years[0].warmingC - 1.4) < 0.15);
});

test('strong climate policy lowers median warming', () => {
  const hi = [], lo = [];
  for (let s = 1; s <= 200; s++) {
    hi.push(simulateRun(all(100), s).final.warmingC);
    lo.push(simulateRun(all(0), s).final.warmingC);
  }
  assert.ok(median(hi) + 0.5 < median(lo), `${median(hi)} vs ${median(lo)}`);
});

test('population and events are plausible', () => {
  for (let s = 1; s <= 50; s++) {
    const r = simulateRun(normalizePolicies({}), s);
    assert.ok(r.final.populationBn > 9 && r.final.populationBn < 11.5, String(r.final.populationBn));
    for (const e of r.events) {
      assert.ok(e.year >= 2026 && e.year <= 2076);
      assert.ok(Number.isFinite(e.lat) && Number.isFinite(e.lon));
      assert.ok(e.kind === 'good' || e.kind === 'bad');
    }
    assert.ok(Number.isFinite(r.score));
  }
});
