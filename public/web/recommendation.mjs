import { catalog } from './catalog.mjs';
import { origins } from './origins.mjs';

export const resultStorageKey = 'weekend-result-v1';
export const resultLifetimeMs = 30 * 60 * 1000;
const lines = (value, maxLength) => Array.isArray(value) ? value.filter(line =>
  typeof line === 'string' && line.length <= maxLength).slice(0, 4) : [];

// Keep a single presentation, never the answers or device coordinates.
export function resultSnapshot(place, now = Date.now()) {
  const known = catalog.find(candidate => candidate.id === place?.id);
  if (!known) return null;
  const snapshot = { id: known.id, createdAt: now, counted: false,
    reasons: lines(place.reasons, 200), cautions: lines(place.cautions, 240) };
  const travel = place.travel;
  const anchors = ['내 현재 위치', ...origins.map(origin => `${origin.label} 대표 위치`)];
  if (travel && Number.isInteger(travel.roundTripMinutes) && travel.roundTripMinutes >= 0 &&
    travel.roundTripMinutes <= 5000 && anchors.includes(travel.anchor)) {
    snapshot.travel = { roundTripMinutes: travel.roundTripMinutes, anchor: travel.anchor };
    if (travel.accuracy > 100 || travel.approximateLocation === true) snapshot.travel.approximateLocation = true;
  }
  return snapshot;
}

export function readRecommendation(storage, now = Date.now()) {
  try {
    const stored = JSON.parse(storage.getItem(resultStorageKey));
    if (!stored || !Number.isFinite(stored.createdAt) || stored.createdAt > now ||
      now - stored.createdAt >= resultLifetimeMs) { storage.removeItem(resultStorageKey); return null; }
    const snapshot = resultSnapshot(stored, stored.createdAt);
    if (!snapshot) return null;
    return { ...catalog.find(place => place.id === snapshot.id), ...snapshot, counted: stored.counted === true };
  } catch { return null; }
}

export function saveRecommendation(storage, place, now = Date.now()) {
  const snapshot = resultSnapshot(place, now);
  if (!snapshot) return false;
  try { storage.setItem(resultStorageKey, JSON.stringify(snapshot)); return true; }
  catch { return false; }
}

export function markRecommendationCounted(storage) {
  const place = readRecommendation(storage);
  if (!place) return;
  try {
    storage.setItem(resultStorageKey, JSON.stringify({ ...resultSnapshot(place, place.createdAt), counted: true }));
  } catch {}
}
