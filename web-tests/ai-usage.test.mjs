import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeAiUsage } from '../scripts/report-miniapp-ai-usage.mjs';

const call = {
  event: 'wherego_gemini_call', model: 'gemini-3.1-flash-lite',
  promptVersion: '2026-09-30-six-question-v1', requestCount: 1,
  inputTokens: 4000, outputTokens: 250, thoughtTokens: 0, totalTokens: 4250, elapsedMs: 1500,
};

test('AI usage report aggregates both supported log formats without private fields', () => {
  const report = summarizeAiUsage([
    JSON.stringify({ ...call, userHash: 'private-user', apiKey: 'private-key' }),
    JSON.stringify({ event: 'log', message: JSON.stringify({ ...call, elapsedMs: 2500 }), sessionId: 'private-session' }),
  ]);
  const group = report.models[call.model];
  assert.equal(report.observedSuccessfulCalls, 2);
  assert.equal(group.calls, 2);
  assert.deepEqual(group.promptVersions, { [call.promptVersion]: 2 });
  assert.deepEqual(group.tokens.inputTokens, { observedTokens: 8000, measuredCalls: 2, missingCalls: 0 });
  assert.deepEqual(group.tokens.thoughtTokens, { observedTokens: 0, measuredCalls: 2, missingCalls: 0 });
  assert.equal(group.p95CallMs, 2500);
  assert.doesNotMatch(JSON.stringify(report), /private|userHash|sessionId|apiKey/);
});

test('unknown token values are not silently treated as measured zeroes', () => {
  const report = summarizeAiUsage([JSON.stringify({ ...call, inputTokens: null, thoughtTokens: undefined, elapsedMs: null })]);
  const group = report.models[call.model];
  assert.deepEqual(group.tokens.inputTokens, { observedTokens: 0, measuredCalls: 0, missingCalls: 1 });
  assert.deepEqual(group.tokens.thoughtTokens, { observedTokens: 0, measuredCalls: 0, missingCalls: 1 });
  assert.equal(group.measuredLatencyCalls, 0);
  assert.equal(group.p95CallMs, null);
});

test('invalid or unrelated exports are counted without echoing their contents', () => {
  const report = summarizeAiUsage([
    '', '{invalid-private', JSON.stringify({ event: 'other' }),
    JSON.stringify({ ...call, model: 'private-model' }),
    JSON.stringify({ ...call, promptVersion: 'private-version' }),
    JSON.stringify({ ...call, requestCount: 0 }),
  ]);
  assert.deepEqual(report, { observedSuccessfulCalls: 0, ignored: 5, models: {} });
});

test('negative, string and fractional tokens remain unmeasured', () => {
  const report = summarizeAiUsage([JSON.stringify({ ...call, inputTokens: -1, outputTokens: '250', totalTokens: 1.5 })]);
  for (const field of ['inputTokens', 'outputTokens', 'totalTokens']) {
    assert.equal(report.models[call.model].tokens[field].missingCalls, 1);
  }
});

test('model versions are summarized separately', () => {
  const report = summarizeAiUsage([
    JSON.stringify(call),
    JSON.stringify({ ...call, model: 'gemini-2.5-flash-lite', promptVersion: '2026-09-01-v1' }),
  ]);
  assert.equal(Object.keys(report.models).length, 2);
  assert.equal(report.models['gemini-2.5-flash-lite'].calls, 1);
});
