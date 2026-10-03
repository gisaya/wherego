import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../public/web/core.mjs';

const root = 'https://weekend.example';

test('search attribution survives navigation to a result place', () => {
  const entry = core.trafficAttribution({ url: root, referrer: 'https://www.google.com/search?q=weekend' });
  assert.deepEqual(entry, { source: 'search', sharedEntry: false });
  assert.deepEqual(core.trafficAttribution({ url: root + '/places/forest/', referrer: root, previousSource: entry.source }), entry);
});

test('internal guide links preserve the original acquisition source', () => {
  assert.deepEqual(core.trafficAttribution({ url: root + '/?from=guide', referrer: root + '/ideas/walk/', previousSource: 'search' }),
    { source: 'search', sharedEntry: false });
  assert.deepEqual(core.trafficAttribution({ url: root + '/?from=guide' }), { source: 'guide', sharedEntry: false });
});

test('only a shared entry is counted, not every page in the shared visit', () => {
  assert.deepEqual(core.trafficAttribution({ url: root + '/places/forest/?from=share' }), { source: 'share', sharedEntry: true });
  assert.deepEqual(core.trafficAttribution({ url: root, referrer: root + '/places/forest/', previousSource: 'share' }),
    { source: 'share', sharedEntry: false });
  assert.equal(core.trafficAttribution({ url: root + '/places/forest/?from=share', referrer: root }).sharedEntry, false);
});

test('query text, similar domains and news portals are not search evidence', () => {
  for (const referrer of ['https://example.com/?from=google', 'https://www.google.com.example/path',
    'https://evilnaver.com/', 'https://news.naver.com/', 'malformed-private-referrer']) {
    assert.deepEqual(core.trafficAttribution({ url: root, referrer }), { source: 'referral', sharedEntry: false });
  }
  assert.equal(core.trafficAttribution({ url: root, referrer: 'https://search.naver.com/search.naver' }).source, 'search');
});

test('a new external or direct entry replaces stored attribution without leaking raw data', () => {
  assert.equal(core.trafficAttribution({ url: root, referrer: 'https://www.bing.com/search', previousSource: 'share' }).source, 'search');
  assert.equal(core.trafficAttribution({ url: root, previousSource: 'share' }).source, 'direct');
  const result = core.trafficAttribution({ url: root + '/?from=private', referrer: root, previousSource: 'private-session' });
  assert.deepEqual(result, { source: 'direct', sharedEntry: false });
  assert.doesNotMatch(JSON.stringify(result), /private|weekend\.example/);
});
