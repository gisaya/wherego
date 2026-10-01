export type SavedPlace = { place: string; address: string; region: string };
export const SAVED_PLACES_KEY = 'weekend-saved-places-v1';
export const MAX_SAVED_PLACES = 20;

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, limit) : '';
}

export function publicPlace(value: unknown): SavedPlace | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const place = text(row.place, 100);
  if (!place) return null;
  return { place, address: text(row.address, 180), region: text(row.region, 60) };
}

export function placeKey(place: SavedPlace) { return JSON.stringify([place.place, place.address]); }

export function readSavedPlaces(raw: string | null | undefined): SavedPlace[] {
  try {
    if (!raw || raw.length > 30000) return [];
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values)) return [];
    const result: SavedPlace[] = [];
    for (const value of values) {
      const place = publicPlace(value);
      if (place && !result.some(p => placeKey(p) === placeKey(place))) result.push(place);
      if (result.length === MAX_SAVED_PLACES) break;
    }
    return result;
  } catch { return []; }
}

export function addSavedPlace(places: SavedPlace[], value: unknown): SavedPlace[] {
  const place = publicPlace(value);
  return place ? [place, ...places.filter(p => placeKey(p) !== placeKey(place))].slice(0, MAX_SAVED_PLACES) : places;
}

export function sharedPlacePath(value: unknown) {
  const place = publicPlace(value);
  if (!place) throw new Error('No public place to share');
  return `intoss://wherego?shared=${encodeURIComponent(JSON.stringify({ v: 1, ...place }))}`;
}

export function parseSharedPlace(params: unknown): SavedPlace | null {
  try {
    const raw = (params as { shared?: unknown } | undefined)?.shared;
    if (raw == null || JSON.stringify(raw).length > 3000) return null;
    // Granite's default query parser may already have decoded the JSON value.
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return (value as { v?: unknown }).v === 1 ? publicPlace(value) : null;
  } catch { return null; }
}

export function publicPlaceMap(place: SavedPlace) {
  return `https://map.naver.com/p/search/${encodeURIComponent(`${place.place} ${place.address || place.region}`)}`;
}
