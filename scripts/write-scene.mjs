// Lets the AI pick the policies, runs the futures and writes them as a God's Eye
// View scene file (Director, version 5) plus its GeoJSON packs. Import
// out/ai-runs-the-planet.scenes.json in GEV's scene editor to play them.
// Usage: node scripts/write-scene.mjs [--policies '{"energy":80,...}'] [--seed 2026]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { optimizePolicies, runMonteCarlo, normalizePolicies, fitBudget, toSceneDocument } from '../engine/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gev = join(root, '..', 'gods-eye-view');
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const seed = Number(arg('--seed') ?? 2026);

const futures = arg('--policies')
  ? runMonteCarlo(fitBudget(normalizePolicies(JSON.parse(arg('--policies')))), { seed })
  : optimizePolicies({ seed }).futures;
const { document, assets } = toSceneDocument(futures);

const { parseSceneDocument } = await import(join(gev, 'src/director/document.js'));
parseSceneDocument(JSON.stringify(document)); // throws with a field path if GEV would reject it

for (const [path, fc] of Object.entries(assets)) {
  const file = join(gev, 'public', 'scene-assets', path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(fc));
}
mkdirSync(join(root, 'out'), { recursive: true });
const out = join(root, 'out', 'ai-runs-the-planet.scenes.json');
writeFileSync(out, JSON.stringify(document, null, 2));
console.log(`policies ${JSON.stringify(futures.policies)}`);
console.log(`wrote ${Object.keys(assets).length} packs and ${out}`);
