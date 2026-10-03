import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../public/web/catalog.mjs';
import { questions } from '../public/web/questions.mjs';
import { origins, initialFlow, transitionFlow, recommendFromAnswers } from '../public/web/flow.mjs';
import { resultSnapshot, saveRecommendation, readRecommendation, markRecommendationCounted,
  resultStorageKey, resultLifetimeMs } from '../public/web/recommendation.mjs';

const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
const answers = Object.fromEntries(questions.map(question => [question.id, 'A']));
const selected = recommendFromAnswers(catalog, origins[0], answers)[0];

test('six answers end at review, never an automatic result or candidate carousel', () => {
  let state = transitionFlow(transitionFlow(initialFlow(), { type: 'start' }), { type: 'origin', id: origins[0].id });
  for (const question of questions) state = transitionFlow(state, { type: 'answer', questionId: question.id, key: 'A' });
  assert.equal(state.step, 'review');
  assert.equal(transitionFlow(state, { type: 'answer', questionId: questions[5].id, key: 'A' }), state);
  assert.equal(transitionFlow(state, { type: 'back' }).index, 5);
});

test('snapshot keeps only a public result and derived presentation, not raw private input', () => {
  const snapshot = resultSnapshot({ ...selected, lat: 37.123456789, lng: 127.987654321,
    answers, userId: 'private-user', origin: { lat: 37.123456789 }, image: 'javascript:unsafe' });
  assert.deepEqual(Object.keys(snapshot).sort(), ['cautions', 'counted', 'createdAt', 'id', 'reasons', 'travel']);
  assert.doesNotMatch(JSON.stringify(snapshot), /37\.123456789|127\.987654321|"lat"|"lng"|answers|userId|unsafe/);
});

test('a single result round-trips; catalog photos and addresses cannot be replaced in storage', () => {
  const store = storage();
  assert.equal(saveRecommendation(store, selected), true);
  const data = JSON.parse(store.getItem(resultStorageKey));
  store.setItem(resultStorageKey, JSON.stringify({ ...data, name: 'modified', image: 'https://evil.example', area: 'wrong' }));
  const result = readRecommendation(store);
  assert.equal(result.name, selected.name);
  assert.equal(result.image, selected.image);
  assert.deepEqual(result.travel, { anchor: selected.travel.anchor, roundTripMinutes: selected.travel.roundTripMinutes });
  assert.deepEqual(result.reasons, selected.reasons);
  markRecommendationCounted(store);
  assert.equal(readRecommendation(store).counted, true);
  saveRecommendation(store, catalog[1]);
  assert.equal(readRecommendation(store).id, catalog[1].id);
  assert.equal(readRecommendation(store).counted, false);
});

test('missing, malformed, expired, future and unknown results never yield a recommendation', () => {
  const store = storage();
  assert.equal(readRecommendation(store), null);
  for (const value of ['{', 'null', '{"id":"not-registered","createdAt":1000}', '{"id":"craft","createdAt":"1000"}']) {
    store.setItem(resultStorageKey, value);
    assert.equal(readRecommendation(store, 1000), null);
  }
  saveRecommendation(store, selected, 1000);
  assert.equal(readRecommendation(store, 999), null);
  saveRecommendation(store, selected, 1000);
  assert.ok(readRecommendation(store, 1000 + resultLifetimeMs - 1));
  assert.equal(readRecommendation(store, 1000 + resultLifetimeMs), null);
  assert.equal(store.getItem(resultStorageKey), null);
});

test('invalid travel anchors and unbounded text do not enter the result presentation', () => {
  const result = resultSnapshot({ ...selected, travel: { anchor: 'exact coordinates', roundTripMinutes: -1 },
    reasons: [null, 'x'.repeat(201), 'one', 'two', 'three', 'four', 'five'] });
  assert.equal(result.travel, undefined);
  assert.deepEqual(result.reasons, ['one', 'two', 'three', 'four']);
});

test('blocked storage is recoverable and never claims a result was handed off', () => {
  const blocked = { getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Blocked'); } };
  assert.equal(saveRecommendation(blocked, selected), false);
  assert.equal(readRecommendation(blocked), null);
});

test('inaccurate location keeps a caution but never persists the measured accuracy', () => {
  const store = storage();
  saveRecommendation(store, { ...selected, travel: { ...selected.travel, accuracy: 345, originType: 'current_location' } });
  assert.equal(readRecommendation(store).travel.approximateLocation, true);
  assert.doesNotMatch(store.getItem(resultStorageKey), /"accuracy"|345|"lat"|"lng"/);
});
