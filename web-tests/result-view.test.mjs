import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../public/web/catalog.mjs';
import { resultMarkup } from '../public/web/result-view.mjs';

test('single place view shares no answers and makes no AI claim', () => {
  const html = resultMarkup(catalog[0]);
  assert.equal((html.match(/data-result-place=/g) || []).length, 1);
  assert.match(html, /장소 이름과 위치만 공유해요\./);
  assert.match(html, /aria-pressed="false"/);
  assert.doesNotMatch(html, /AI 판단|실시간|답변 공유/);
});

test('result text and rule reasons are escaped, including generated caution fields', () => {
  const html = resultMarkup({ ...catalog[0], name: '<script>bad</script>', reasons: ['<b>bad</b>'], cautions: ['<img onerror=bad>'] });
  assert.doesNotMatch(html, /<script>|<b>bad|<img onerror/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img onerror/);
});
