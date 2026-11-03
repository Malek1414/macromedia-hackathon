/** The levers the AI (or the audience) controls, each 0-100. */

export const LEVERS = [
  { key: 'energy', label: 'Energy transition', help: 'How fast coal, oil and gas are replaced by clean power' },
  { key: 'carbonPrice', label: 'Carbon price', help: 'How much polluting costs' },
  { key: 'adaptation', label: 'Coastal & heat adaptation', help: 'Sea walls, cooling, early warnings' },
  { key: 'food', label: 'Food & land', help: 'Resilient crops, less waste, forests protected' },
  { key: 'cooperation', label: 'Global cooperation', help: 'Treaties, aid, pandemic preparedness, peace' },
  { key: 'tech', label: 'AI & tech investment', help: 'Research, storage, fusion, medicine' },
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function normalizePolicies(partial = {}) {
  return Object.fromEntries(
    LEVERS.map(({ key }) => {
      const v = Number(partial?.[key]);
      return [key, Number.isFinite(v) ? Math.round(clamp(v, 0, 100)) : 50];
    }),
  );
}

/** 0 = lowest-emission pathway (SSP1-2.6), 1 = highest (SSP5-8.5). */
export function emissionIndex(p) {
  const effort = (0.45 * p.energy + 0.25 * p.carbonPrice + 0.15 * p.cooperation + 0.15 * p.tech) / 100;
  return clamp(1.05 - 1.1 * effort, 0, 1);
}

/**
 * Cost of a policy mix in the model's wellbeing units: doing everything at
 * once is not free, so the optimizer has to choose.
 */
export function policyCost(p) {
  const total = LEVERS.reduce((sum, { key }) => sum + p[key], 0) / 100;
  return Math.max(0, total - 3) * 2.2 + (p.carbonPrice / 100) * 1.5;
}

export function describePolicies(p) {
  return LEVERS.map(({ key, label }) => `${label}: ${p[key]}`).join(', ');
}

/** Everyone (AI or audience) spends the same budget across the six levers. */
export const BUDGET = 360;

/** Scale levers down proportionally so they fit the budget. */
export function fitBudget(p, budget = BUDGET) {
  const total = LEVERS.reduce((sum, { key }) => sum + p[key], 0);
  if (total <= budget) return { ...p };
  const k = budget / total;
  return Object.fromEntries(LEVERS.map(({ key }) => [key, Math.floor(p[key] * k)]));
}
