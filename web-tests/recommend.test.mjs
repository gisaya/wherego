import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { catalog } from '../public/web/catalog.mjs';
import { guides } from '../public/web/guides.mjs';
import { recommend, shareUrl, escapeHtml } from '../public/web/core.mjs';
import events from '../web-server/events.cjs';

test('all 72 preference combinations respect region and indoor/outdoor conditions', () => {
  for (const region of ['seoul', 'gyeonggi', 'incheon']) for (const environment of ['any', 'indoor', 'outdoor'])
    for (const interest of ['nature', 'culture', 'water', 'any']) for (const walking of ['light', 'active']) {
      const result = recommend(catalog, { region, environment, interest, walking });
      assert.ok(result.length > 0 && result.length <= 3);
      assert.equal(new Set(result.map(p => p.id)).size, result.length);
      assert.ok(result.every(p => p.region === region && (environment === 'any' || p.environments.includes(environment))));
      assert.deepEqual(result, recommend(catalog, { region, environment, interest, walking }));
    }
});
test('preferences change the ranking and unmet soft preferences have a caveat', () => {
  const base = { region: 'gyeonggi', environment: 'any', walking: 'active' };
  assert.notEqual(recommend(catalog, { ...base, interest: 'culture' })[0].id, recommend(catalog, { ...base, interest: 'water' })[0].id);
  assert.ok(recommend(catalog, { ...base, environment: 'outdoor', interest: 'culture', walking: 'light' }).find(p => p.id === 'fortress').tradeoff);
  assert.deepEqual(recommend(catalog, { ...base, interest: '<script>' }), []);
});
test('shared links only contain a public catalog ID', () => {
  const value = shareUrl({ ...catalog[0], answer: 'secret', user: 'private', lat: 37 }, 'https://example.com');
  assert.equal(value, 'https://example.com/places/forest/?from=share');
});
test('catalog IDs, guides and public sources are valid', () => {
  assert.equal(new Set(catalog.map(p => p.id)).size, catalog.length);
  assert.equal(guides.length, 10);
  for (const p of catalog) { assert.match(p.image, /^https:\/\//); assert.match(p.url, /^https:\/\/(english.visitseoul.net|english.visitkorea.or.kr)\//); }
  for (const g of guides) assert.ok(g.picks.every(id => catalog.some(p => p.id === id)));
});
test('event ingestion strips all identity and free-text values', () => {
  assert.deepEqual(events.cleanEvent({ event: 'map', source: 'search', user: 'secret', ip: 'secret', answers: ['secret'] }), { experiment: 'weekend-rules-v1', event: 'map', source: 'search' });
  assert.equal(events.cleanEvent({ event: 'unknown' }), null);
  assert.equal(events.cleanEvent({ event: 'visit', source: 'private URL' }).source, 'direct');
});
test('browser code contains no AI or backend recommendation requests', () => {
  const app = fs.readFileSync(new URL('../public/web/app.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /jbg\.onrender|gemini|\/api\/wherego|\/api\/web/);
  assert.equal((app.match(/fetch\(/g) || []).length, 1);
});
test('external strings are escaped', () => {
  assert.equal(escapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
});
