import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeEvents } from '../scripts/report-weekend-events.mjs';

test('reports anonymous action counts without identity or raw logs', () => {
  const report = summarizeEvents([
    JSON.stringify({ experiment: 'weekend-rules-v1', event: 'map', source: 'share', user: 'private' }),
    JSON.stringify({ message: JSON.stringify({ experiment: 'weekend-rules-v1', event: 'map', source: 'share' }), requestId: 'private' }),
    '{invalid',
    JSON.stringify({ event: 'map', source: 'share' }),
    JSON.stringify({ experiment: 'weekend-rules-v1', event: 'unknown' }),
  ]);
  assert.deepEqual(report, { accepted: 2, ignored: 3, events: { map: 2 }, sources: { share: { map: 2 } } });
  assert.doesNotMatch(JSON.stringify(report), /private|user|requestId/);
});
