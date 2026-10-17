// Synthetic track generation shared by gen-route.mjs and gen-history.mjs.
// The *path* depends only on `seed`; GPS noise uses `noiseSeed`, so the same
// route can be replayed many times with different noise (overlapping tracks).

import { PROFILES, destination, gaussian, mulberry32 } from './geo.mjs';

export function generateTrack({
  type = 'run',
  km = 3,
  interval = 1,
  noise = 4,
  outliers = 0,
  pauseS = 0,
  climb = 15,
  start = { lat: 52.2133, lon: 20.999 },
  seed = 42,
  noiseSeed,
  startTime = Date.parse('2026-01-01T07:00:00Z'),
}) {
  const profile = PROFILES[type];
  if (!profile) throw new Error(`Unknown type ${type}. Use walk, run or cycle.`);
  const rand = mulberry32(seed);
  const targetM = km * 1000;

  // True path: smooth random heading changes, steered home over the last 40%.
  let pos = { ...start };
  let heading = rand() * 360;
  let t = startTime;
  let travelled = 0;
  let paused = false;
  const truth = [];

  while (travelled < targetM) {
    const ele = 100 + climb * Math.sin((travelled / 1000) * Math.PI * 0.8) + climb * 0.3 * Math.sin(travelled / 170);
    truth.push({ ...pos, ele, t });

    if (pauseS > 0 && !paused && travelled >= targetM / 2) {
      paused = true;
      for (let s = interval; s <= pauseS; s += interval) truth.push({ ...pos, ele, t: t + s * 1000 });
      t += pauseS * 1000;
    }

    const speed = Math.max(0.3, profile.speed + gaussian(rand) * profile.speedJitter);
    const step = speed * interval;
    heading = (heading + gaussian(rand) * (type === 'cycle' ? 6 : 10) + 360) % 360;
    if (travelled > targetM * 0.6) {
      const home = Math.atan2(start.lon - pos.lon, start.lat - pos.lat) * (180 / Math.PI);
      heading += (((home - heading + 540) % 360) - 180) * 0.05;
    }
    pos = destination(pos, heading, step);
    travelled += step;
    t += interval * 1000;
  }

  // Observed path: GPS error is strongly autocorrelated (it drifts, it does not
  // jump every fix), so model it as an AR(1) offset in east/north metres.
  const nrand = noiseSeed == null ? rand : mulberry32(noiseSeed);
  const phi = Math.pow(0.97, interval);
  const innov = Math.sqrt(1 - phi * phi);
  let east = 0;
  let north = 0;
  let eleErr = 0;
  const observed = truth.map((p) => {
    east = phi * east + innov * gaussian(nrand) * noise;
    north = phi * north + innov * gaussian(nrand) * noise;
    eleErr = phi * eleErr + innov * gaussian(nrand) * noise * 1.5;
    const off = Math.hypot(east, north);
    const n = off > 0 ? destination(p, (Math.atan2(east, north) * 180) / Math.PI, off) : { lat: p.lat, lon: p.lon };
    const j = destination(n, nrand() * 360, Math.abs(gaussian(nrand)) * noise * 0.15); // small white jitter
    return { ...j, ele: p.ele + eleErr, t: p.t, accuracy: Math.round(noise * (1.5 + nrand())) };
  });
  for (let i = 0; i < outliers; i++) {
    const idx = 5 + Math.floor(nrand() * (observed.length - 10));
    const spike = destination(observed[idx], nrand() * 360, 150 + nrand() * 400);
    observed[idx] = { ...observed[idx], ...spike, accuracy: 65 };
  }

  const elapsedS = (truth.at(-1).t - truth[0].t) / 1000;
  let elevGainM = 0;
  for (let i = 1; i < truth.length; i++) elevGainM += Math.max(0, truth[i].ele - truth[i - 1].ele);
  return {
    truth: { distanceM: Math.round(travelled), elapsedS, movingS: elapsedS - pauseS, elevGainM: Math.round(elevGainM) },
    truePath: truth,
    points: observed,
  };
}
