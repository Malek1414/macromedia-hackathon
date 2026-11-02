/** Runs the Monte Carlo and the AI optimizer off the main thread. */
import { runMonteCarlo, optimizePolicies, explain } from '../engine/index.js';

self.onmessage = ({ data }) => {
  const { id, type, policies, runs = 5000, seed = 2026 } = data;
  if (type === 'run') {
    const futures = runMonteCarlo(policies, { runs, seed });
    self.postMessage({ id, type: 'done', futures, rationale: explain(policies, futures) });
  } else if (type === 'optimize') {
    let last = 0;
    const result = optimizePolicies({
      seed,
      onProgress: (p) => { if (p - last > 0.02) { last = p; self.postMessage({ id, type: 'progress', p }); } },
    });
    self.postMessage({ id, type: 'done', ...result });
  }
};
