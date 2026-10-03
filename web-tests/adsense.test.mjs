import test from 'node:test';
import assert from 'node:assert/strict';
import { validAdConfig, canServeAds } from '../public/web/adsense.mjs';
import { monetizationConfig, publisherId } from '../scripts/weekend-monetization.mjs';

const live = { enabled: true, clientId: publisherId, hosts: ['wherego-lake.vercel.app'], displaySlot: '' };

test('publisher ownership verification does not silently activate advertising', () => {
  assert.equal(monetizationConfig({}).enabled, false);
  assert.equal(canServeAds(monetizationConfig({}), 'https://wherego-lake.vercel.app/recommendation/', 'recommendation'), false);
  assert.throws(() => monetizationConfig({ WEB_ADSENSE_ENABLED: 'true' }), /photo rights/);
  assert.equal(monetizationConfig({ WEB_ADSENSE_ENABLED: 'true', WEB_MEDIA_COMMERCIAL_USE_CONFIRMED: 'true' }).enabled, true);
});

test('only substantive content on exact production hosts may request ads', () => {
  for (const page of ['place', 'guide', 'recommendation']) assert.equal(canServeAds(live, 'https://wherego-lake.vercel.app/', page), true);
  for (const page of ['intro', 'origin', 'question', 'review', 'empty', 'privacy', 'loading'])
    assert.equal(canServeAds(live, 'https://wherego-lake.vercel.app/', page), false);
  for (const url of ['http://wherego-lake.vercel.app/', 'http://localhost:4174/', 'https://127.0.0.1/',
    'https://wherego-lake.vercel.app.evil.example/', 'https://preview.vercel.app/', 'malformed'])
    assert.equal(canServeAds(live, url, 'place'), false);
});

test('ad settings reject placeholder IDs, invalid hosts and malformed slots', () => {
  for (const config of [{ ...live, clientId: 'ca-pub-example' }, { ...live, clientId: 'ca-pub-123' },
    { ...live, hosts: ['https://wherego-lake.vercel.app'] }, { ...live, hosts: [] },
    { ...live, displaySlot: 'fake-unit' }, { ...live, enabled: 'true' }]) assert.equal(validAdConfig(config), false);
  assert.throws(() => monetizationConfig({ WEB_ADSENSE_ENABLED: 'true', WEB_MEDIA_COMMERCIAL_USE_CONFIRMED: 'true', WEB_ADSENSE_DISPLAY_SLOT: 'fake' }), /Invalid/);
});
