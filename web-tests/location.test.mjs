import test from 'node:test';
import assert from 'node:assert/strict';
import { currentOrigin, requestCurrentOrigin } from '../public/web/location.mjs';
import { origins, resolveOrigin, initialFlow, transitionFlow, estimateTravel, recommendFromAnswers } from '../public/web/flow.mjs';
import { catalog } from '../public/web/catalog.mjs';
import { questions } from '../public/web/questions.mjs';

const position = { coords: { latitude: 37.5691701546, longitude: 126.8360015625, accuracy: 25 } };
const answers = Object.fromEntries(questions.map(question => [question.id, 'A']));

test('manual departures match all eleven miniapp regions, including north and south Gyeonggi', () => {
  assert.equal(origins.length, 11);
  assert.deepEqual(origins.map(origin => origin.label), ['서울/수도권', '경기 남부', '경기 북부', '인천', '대전/충청', '강원', '전북', '광주/전남', '대구/경북', '부산/경남', '제주']);
  assert.ok(origins.every(origin => origin.type === 'selected_region' && origin.description && origin.areaCodes.length));
});

test('current departure preserves the received coordinates instead of snapping to a region center', () => {
  const origin = currentOrigin(position);
  assert.equal(origin.lat, position.coords.latitude);
  assert.equal(origin.lng, position.coords.longitude);
  assert.equal(origin.type, 'current_location');
  assert.equal(origin.accuracy, 25);
  const state = transitionFlow(transitionFlow(initialFlow(), { type: 'start' }), { type: 'origin', origin });
  assert.equal(state.step, 'question');
  assert.equal(state.origin.lat, position.coords.latitude);
  const botanical = catalog.find(place => place.id === 'botanic');
  assert.equal(estimateTravel(origin, botanical).roundTripMinutes, 0);
  assert.ok(estimateTravel(origins[0], botanical).roundTripMinutes > 0);
  assert.equal(recommendFromAnswers(catalog, origin, answers).find(place => place.id === 'botanic').travel.anchor, '내 현재 위치');
});

test('selected region metadata is canonical and invalid coordinates never become an origin', () => {
  assert.equal(resolveOrigin({ type: 'selected_region', id: 'seoul', lat: 0, lng: 0 }), origins[0]);
  for (const lat of [NaN, Infinity, '37', 91]) {
    assert.throws(() => currentOrigin({ coords: { latitude: lat, longitude: 127 } }));
    assert.equal(resolveOrigin({ type: 'current_location', lat, lng: 127 }), null);
  }
  const state = transitionFlow(initialFlow(), { type: 'start' });
  assert.equal(transitionFlow(state, { type: 'origin', origin: { type: 'current_location', lat: NaN, lng: 127 } }), state);
});

test('browser location is fresh and requested only when explicitly called', async () => {
  let calls = 0;
  const geolocation = { getCurrentPosition(success, failure, options) {
    calls++;
    assert.deepEqual(options, { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
    success(position);
  } };
  assert.equal(calls, 0);
  const origin = await requestCurrentOrigin({ geolocation });
  assert.equal(calls, 1);
  assert.equal(origin.lat, position.coords.latitude);
});

test('permission denial, unavailable position, unsupported and insecure contexts never use a city fallback', async () => {
  for (const code of [1, 2, 3]) await assert.rejects(requestCurrentOrigin({
    geolocation: { getCurrentPosition(success, failure) { failure({ code }); } },
  }), /지역을 직접 선택/);
  await assert.rejects(requestCurrentOrigin({ geolocation: {} }), /지원하지 않아요/);
  await assert.rejects(requestCurrentOrigin({ geolocation: {}, secureContext: false }), /보안 연결/);
});

test('an unanswered location request times out and a late response is ignored', async () => {
  let lateSuccess;
  await assert.rejects(requestCurrentOrigin({ timeoutMs: 10,
    geolocation: { getCurrentPosition(success) { lateSuccess = success; } },
  }), /시간이 초과/);
  assert.doesNotThrow(() => lateSuccess(position));
});

test('navigation can cancel location while a browser callback is pending', async () => {
  const controller = new AbortController();
  let lateSuccess;
  const request = requestCurrentOrigin({ signal: controller.signal,
    geolocation: { getCurrentPosition(success) { lateSuccess = success; } },
  });
  controller.abort();
  await assert.rejects(request, error => error.name === 'AbortError');
  assert.doesNotThrow(() => lateSuccess(position));
});

test('out-of-catalog near trips do not silently relocate to Seoul or invent a mainland drive from Jeju', () => {
  const jeju = origins.find(origin => origin.id === 'jeju');
  assert.deepEqual(recommendFromAnswers(catalog, jeju, answers), []);
  assert.equal(estimateTravel(jeju, catalog[0]), null);
  const busan = origins.find(origin => origin.id === 'gyeongnam');
  assert.deepEqual(recommendFromAnswers(catalog, busan, answers), []);
});
