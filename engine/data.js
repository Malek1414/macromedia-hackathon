/**
 * The real-world anchors of the model. Values are rounded approximations of
 * the cited sources, enough to keep the futures honest, not a climate model.
 */

export const START_YEAR = 2026;
export const END_YEAR = 2076;

export const SOURCES = [
  { label: 'IPCC AR6 WG1, SPM Table SPM.1 and Fig. SPM.8 (warming and sea level by SSP)', url: 'https://www.ipcc.ch/report/ar6/wg1/' },
  { label: 'UN World Population Prospects 2024 (medium variant)', url: 'https://population.un.org/wpp/' },
  { label: 'Copernicus / WMO: about 1.4 °C above 1850-1900 in the mid-2020s', url: 'https://wmo.int/' },
];

/** Warming above 1850-1900 in 2026, °C. */
export const WARMING_NOW = 1.4;

/**
 * SSP pathways from low to high emissions: warming reached by 2076 (°C above
 * 1850-1900) and sea-level rise from 2026 to 2076 (m), interpolated from AR6.
 */
export const SSPS = [
  { id: 'SSP1-2.6', warming2076: 1.8, seaRise2076: 0.26 },
  { id: 'SSP2-4.5', warming2076: 2.4, seaRise2076: 0.31 },
  { id: 'SSP3-7.0', warming2076: 2.9, seaRise2076: 0.36 },
  { id: 'SSP5-8.5', warming2076: 3.3, seaRise2076: 0.41 },
];

/** World population, billions (UN WPP 2024 medium), linearly interpolated. */
export const POPULATION = [
  [2026, 8.2], [2036, 8.9], [2046, 9.45], [2056, 9.85], [2066, 10.15], [2076, 10.25],
];

/**
 * Coastal cities with large populations near sea level. exposureM: millions
 * living low enough to be displaced by roughly half a metre of rise without
 * protection (rounded, illustrative from coastal exposure studies).
 */
export const HOTSPOTS = [
  { id: 'dhaka', place: 'Dhaka', lat: 23.81, lon: 90.41, exposureM: 9 },
  { id: 'kolkata', place: 'Kolkata', lat: 22.57, lon: 88.36, exposureM: 6 },
  { id: 'shanghai', place: 'Shanghai', lat: 31.23, lon: 121.47, exposureM: 7 },
  { id: 'guangzhou', place: 'Guangzhou', lat: 23.13, lon: 113.26, exposureM: 6 },
  { id: 'jakarta', place: 'Jakarta', lat: -6.2, lon: 106.85, exposureM: 5 },
  { id: 'hcmc', place: 'Ho Chi Minh City', lat: 10.82, lon: 106.63, exposureM: 5 },
  { id: 'bangkok', place: 'Bangkok', lat: 13.76, lon: 100.5, exposureM: 4 },
  { id: 'mumbai', place: 'Mumbai', lat: 19.08, lon: 72.88, exposureM: 4 },
  { id: 'lagos', place: 'Lagos', lat: 6.52, lon: 3.38, exposureM: 3 },
  { id: 'alexandria', place: 'Alexandria', lat: 31.2, lon: 29.92, exposureM: 2 },
  { id: 'miami', place: 'Miami', lat: 25.76, lon: -80.19, exposureM: 1.5 },
  { id: 'newyork', place: 'New York', lat: 40.71, lon: -74.01, exposureM: 1.5 },
  { id: 'rotterdam', place: 'Rotterdam', lat: 51.92, lon: 4.48, exposureM: 1 },
  { id: 'hamburg', place: 'Hamburg', lat: 53.55, lon: 9.99, exposureM: 0.5 },
];

const P = (place, lat, lon) => ({ place, lat, lon });

/**
 * Chance events. Each year, `chance(state)` gives the probability it happens;
 * `effect` changes the run state. kind: good or bad for the world.
 */
export const EVENTS = [
  {
    id: 'pandemic', title: 'New pandemic', kind: 'bad',
    places: [P('Wuhan', 30.59, 114.31), P('Kinshasa', -4.44, 15.27), P('São Paulo', -23.55, -46.63), P('Delhi', 28.61, 77.21)],
    chance: () => 0.022,
    effect: (s, p) => { const d = 25 * (1.4 - p.cooperation / 100); s.deathsM += d; s.wellbeing -= 4; return `${d.toFixed(0)}M deaths`; },
  },
  {
    id: 'war', title: 'Major war', kind: 'bad',
    places: [P('Taiwan Strait', 24.5, 119.5), P('Eastern Europe', 49.0, 32.0), P('Kashmir', 34.08, 74.8), P('Persian Gulf', 26.5, 52.0)],
    chance: (s, p) => 0.015 * (1.4 - p.cooperation / 100),
    effect: (s) => { s.deathsM += 8; s.wellbeing -= 7; s.emissionShift += 0.04; return '8M deaths, transition slowed'; },
  },
  {
    id: 'tipping', title: 'Climate tipping point', kind: 'bad',
    places: [P('Amazon rainforest', -3.47, -62.2), P('Siberian permafrost', 66.5, 120.0), P('Greenland ice sheet', 72.0, -40.0), P('West Antarctica', -79.0, -110.0)],
    chance: (s) => (s.warmingC > 1.8 ? 0.015 * (s.warmingC - 1.8) * 4 : 0),
    effect: (s) => { s.extraWarming += 0.25; s.extraSea += 0.05; s.wellbeing -= 5; return '+0.25 °C, +5 cm sea level locked in'; },
    once: true,
  },
  {
    id: 'heatdome', title: 'Deadly heat dome', kind: 'bad',
    places: [P('Delhi', 28.61, 77.21), P('Karachi', 24.86, 67.0), P('Phoenix', 33.45, -112.07), P('Seville', 37.39, -5.98), P('Baghdad', 33.31, 44.36)],
    chance: (s) => Math.max(0, 0.04 * (s.warmingC - 1.2)),
    effect: (s, p) => { const d = 0.4 * (1.2 - p.adaptation / 100); s.deathsM += d; s.wellbeing -= 1.5; return `${Math.round(d * 1000)}k deaths`; },
  },
  {
    id: 'cropfail', title: 'Breadbasket failure', kind: 'bad',
    places: [P('US Midwest', 41.5, -93.5), P('Punjab', 30.9, 75.85), P('North China Plain', 36.0, 116.0), P('Ukraine', 49.0, 31.0)],
    chance: (s, p) => Math.max(0, 0.03 * (s.warmingC - 1.3) * (1.3 - p.food / 100)),
    effect: (s) => { s.deathsM += 2; s.wellbeing -= 4; return 'food prices spike, 2M deaths'; },
  },
  {
    id: 'volcano', title: 'Volcanic winter', kind: 'bad',
    places: [P('Tambora', -8.25, 118.0), P('Pinatubo', 15.14, 120.35), P('Katla', 63.63, -19.05)],
    chance: () => 0.006,
    effect: (s) => { s.coolingYears = 3; s.wellbeing -= 3; return '-0.3 °C for 3 years, harvests hit'; },
    once: true,
  },
  {
    id: 'breakthrough', title: 'Clean-energy breakthrough', kind: 'good',
    places: [P('Cadarache (ITER)', 43.71, 5.76), P('Shenzhen', 22.54, 114.06), P('Boston', 42.36, -71.06), P('Berlin', 52.52, 13.4)],
    chance: (s, p) => 0.004 + 0.03 * p.tech / 100,
    effect: (s) => { s.emissionShift -= 0.12; s.wellbeing += 3; return 'emissions fall faster'; },
    once: true,
  },
  {
    id: 'aiboom', title: 'AI science boom', kind: 'good',
    places: [P('San Francisco', 37.77, -122.42), P('London', 51.51, -0.13), P('Bengaluru', 12.97, 77.59), P('Beijing', 39.9, 116.4)],
    chance: (s, p) => 0.004 + 0.025 * p.tech / 100,
    effect: (s) => { s.wellbeing += 5; s.emissionShift -= 0.04; return 'medicine and materials leap ahead'; },
    once: true,
  },
  {
    id: 'treaty', title: 'Global climate treaty', kind: 'good',
    places: [P('Geneva', 46.2, 6.14), P('New York (UN)', 40.75, -73.97), P('Nairobi', -1.29, 36.82)],
    chance: (s, p) => 0.002 + 0.03 * p.cooperation / 100 * (p.carbonPrice / 100),
    effect: (s) => { s.emissionShift -= 0.08; s.wellbeing += 2; return 'binding cuts agreed'; },
    once: true,
  },
];
