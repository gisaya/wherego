import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../public/web/catalog.mjs';
import { questions, questionBankVersion } from '../public/web/questions.mjs';
import { origins, recommendFromAnswers, transitionFlow, initialFlow, estimateTravel } from '../public/web/flow.mjs';

const answers = keys => Object.fromEntries(questions.map((question, i) => [question.id, keys[i]]));

test('six miniapp questions have unique themes and 3 source + 3 general provenance', () => {
  assert.equal(questions.length, 6);
  assert.equal(questions.filter(q => q.type === 'source').length, 3);
  assert.equal(new Set(questions.map(q => q.theme)).size, 6);
  assert.match(questionBankVersion.sourceDigest, /^[a-f0-9]{64}$/);
  assert.equal(questions[0].question, '오늘은 가볍게 갈까요, 멀리 제대로 갈까요?');
  for (const question of questions) assert.equal(new Set(question.options.map(o => o.key)).size, question.options.length);
});

test('all six answers are required and client metadata is never trusted', () => {
  const complete = answers(['A', 'A', 'A', 'A', 'A', 'A']);
  assert.ok(recommendFromAnswers(catalog, origins[0].id, complete).length);
  assert.deepEqual(recommendFromAnswers(catalog, origins[0].id, { ...complete, [questions[2].id]: 'invalid' }), []);
  assert.deepEqual(recommendFromAnswers(catalog, 'unknown', complete), []);
  delete complete[questions[4].id];
  assert.deepEqual(recommendFromAnswers(catalog, origins[0].id, complete), []);
});

test('every answer combination respects indoor, movement and culture requirements', () => {
  for (const origin of origins) for (let combination = 0; combination < 64; combination++) {
    const chosen = questions.map((q, i) => q.options[(combination >> i) & 1].key);
    const selected = answers(chosen);
    const result = recommendFromAnswers(catalog, origin.id, selected);
    assert.ok(result.length <= 3);
    assert.equal(new Set(result.map(p => p.id)).size, result.length);
    for (const place of result) {
      if (chosen[0] === 'A') assert.ok(place.travel?.roundTripMinutes <= 120);
      if (chosen[2] === 'B') assert.ok(place.interests.includes('culture'));
      if (chosen[3] === 'A') assert.ok(place.environments.includes('indoor'));
      assert.ok(place.reasons.length >= 2);
    }
    assert.deepEqual(result, recommendFromAnswers(catalog, origin.id, selected));
  }
});

test('photo and energy answers affect scoring, not fabricated venue facts', () => {
  const base = ['B', 'A', 'A', 'B', 'A', 'A'];
  const original = recommendFromAnswers(catalog, origins[0].id, answers(base));
  const revised = recommendFromAnswers(catalog, origins[0].id, answers(['B', 'A', 'A', 'B', 'B', 'B']));
  assert.notDeepEqual(original.map(p => [p.id, p.score]), revised.map(p => [p.id, p.score]));
  for (const place of [...original, ...revised]) assert.doesNotMatch(place.reasons.join(' '), /실시간|한산함 보장|무장애|AI/);
});

test('missing or out-of-region coordinates are not used to claim travel times', () => {
  assert.equal(estimateTravel(origins[0], { region: 'incheon', lat: 36.444, lng: 128.254 }), null);
  assert.equal(estimateTravel(origins[0], {}), null);
  assert.equal(estimateTravel(origins[0], { region: 'seoul', lat: origins[0].lat, lng: origins[0].lng }).roundTripMinutes, 0);
  const noCoordinates = catalog.map(p => ({ ...p, lat: undefined, lng: undefined }));
  assert.deepEqual(recommendFromAnswers(noCoordinates, origins[0].id, answers(['A', 'A', 'A', 'A', 'A', 'A'])), []);
});

test('back preserves earlier answers and a changed answer clears only later answers', () => {
  let state = transitionFlow(initialFlow(), { type: 'start' });
  state = transitionFlow(state, { type: 'origin', id: origins[0].id });
  for (const question of questions) state = transitionFlow(state, { type: 'answer', questionId: question.id, key: 'A' });
  assert.equal(state.step, 'review');
  state = transitionFlow(state, { type: 'back' });
  assert.equal(state.index, 5);
  assert.equal(Object.keys(state.answers).length, 6);
  state = transitionFlow(state, { type: 'back' });
  state = transitionFlow(state, { type: 'answer', questionId: questions[4].id, key: 'B' });
  assert.equal(state.index, 5);
  assert.equal(state.answers[questions[4].id], 'B');
  assert.equal(state.answers[questions[5].id], undefined);
  assert.equal(state.answers[questions[3].id], 'A');
  assert.deepEqual(transitionFlow(state, { type: 'home' }), initialFlow());
});

test('invalid, stale and repeated clicks do not skip a question', () => {
  const state = transitionFlow(transitionFlow(initialFlow(), { type: 'start' }), { type: 'origin', id: origins[0].id });
  assert.equal(transitionFlow(state, { type: 'answer', questionId: questions[5].id, key: 'A' }), state);
  assert.equal(transitionFlow(state, { type: 'answer', questionId: questions[0].id, key: 'unknown' }), state);
  const next = transitionFlow(state, { type: 'answer', questionId: questions[0].id, key: 'A' });
  assert.equal(transitionFlow(next, { type: 'answer', questionId: questions[0].id, key: 'A' }), next);
});
