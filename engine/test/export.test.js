import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonteCarlo } from '../montecarlo.js';
import { normalizePolicies } from '../policies.js';
import { toSceneDocument, annotationsFor, cameraFor, headline } from '../export.js';

const futures = runMonteCarlo(normalizePolicies({ adaptation: 10 }), { runs: 300, seed: 9 });

test('scene document v5: three scenes, packs exist, unique feature ids', () => {
  const { document, assets } = toSceneDocument(futures);
  assert.equal(document.version, 5);
  assert.equal(document.scenes.length, 3);
  for (const scene of document.scenes) {
    assert.ok(scene.dataPacks.length <= 8);
    const packIds = new Set(scene.dataPacks.map((p) => p.id));
    for (const shot of scene.shots) {
      for (const k of ['lat', 'lon', 'alt', 'pitch']) assert.ok(Number.isFinite(shot.camera[k]));
      for (const id of shot.dataPackIds) assert.ok(packIds.has(id));
    }
    for (const p of scene.dataPacks) {
      const fc = assets[p.source.path];
      assert.ok(fc, p.source.path);
      const ids = fc.features.map((f) => f.id);
      assert.equal(new Set(ids).size, ids.length);
      assert.ok(ids.every((id) => typeof id === 'string'));
    }
  }
});

test('annotations are placed and capped at 24', () => {
  for (const which of ['best', 'likely', 'worst']) {
    const a = annotationsFor(futures[which], 2076, 10);
    assert.ok(a.length <= 24);
    for (const x of a) assert.ok(Number.isFinite(x.latitude) && Number.isFinite(x.longitude));
  }
  assert.equal(annotationsFor(futures.worst, 2026).filter((x) => x.type === 'pin').length, 0);
});

test('camera and headline for a year', () => {
  assert.equal(cameraFor(futures.likely, 2026).alt, 18_000_000);
  assert.match(headline(futures.likely, 2050), /^2050: /);
});
