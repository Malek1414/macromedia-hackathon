// Copies the engine into the God's Eye View fork (src/future/), so GEV's tools
// and the fallback page run the same code. Run after any engine change.
import { cpSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, '..', 'gods-eye-view', 'src', 'future');
mkdirSync(target, { recursive: true });
const files = readdirSync(join(root, 'engine')).filter((f) => f.endsWith('.js'));
for (const f of files) cpSync(join(root, 'engine', f), join(target, f));
writeFileSync(join(target, 'README.md'),
  '# Future engine (vendored)\n\nCopied from `ai-runs-the-planet/engine` by `scripts/sync-engine.mjs`. Edit it there, not here.\n');
console.log(`synced ${files.length} files to ${target}`);
