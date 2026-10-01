import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const tokenFields = ['inputTokens', 'outputTokens', 'thoughtTokens', 'totalTokens'];
const counter = () => ({ observedTokens: 0, measuredCalls: 0, missingCalls: 0 });
const isCount = value => Number.isSafeInteger(value) && value >= 0;

export function summarizeAiUsage(lines) {
  const report = { observedSuccessfulCalls: 0, ignored: 0, models: {} };
  const timings = new Map();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      const event = row.event === 'wherego_gemini_call' ? row : typeof row.message === 'string' ? JSON.parse(row.message) : null;
      if (event?.event !== 'wherego_gemini_call' || event.requestCount !== 1
        || typeof event.model !== 'string' || !/^gemini-[a-z0-9.-]{1,64}$/.test(event.model)
        || typeof event.promptVersion !== 'string' || !/^20\d{2}-\d{2}-\d{2}(?:-[a-z0-9]+){0,12}$/.test(event.promptVersion)) {
        report.ignored++;
        continue;
      }
      report.observedSuccessfulCalls++;
      report.models[event.model] ??= {
        calls: 0,
        promptVersions: {},
        tokens: Object.fromEntries(tokenFields.map(field => [field, counter()])),
        measuredLatencyCalls: 0,
        p95CallMs: null,
      };
      const group = report.models[event.model];
      group.calls++;
      group.promptVersions[event.promptVersion] = (group.promptVersions[event.promptVersion] || 0) + 1;
      for (const field of tokenFields) {
        const count = group.tokens[field];
        if (isCount(event[field])) {
          count.observedTokens += event[field];
          count.measuredCalls++;
        } else count.missingCalls++;
      }
      if (isCount(event.elapsedMs)) {
        if (!timings.has(event.model)) timings.set(event.model, []);
        timings.get(event.model).push(event.elapsedMs);
      }
    } catch { report.ignored++; }
  }
  for (const [model, values] of timings) {
    values.sort((a, b) => a - b);
    report.models[model].measuredLatencyCalls = values.length;
    report.models[model].p95CallMs = values[Math.ceil(values.length * 0.95) - 1];
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/report-miniapp-ai-usage.mjs <exported-log.ndjson>');
    process.exitCode = 1;
  } else {
    try {
      console.log(JSON.stringify(summarizeAiUsage(fs.readFileSync(file, 'utf8').split(/\r?\n/)), null, 2));
    } catch {
      console.error('Could not read AI usage export.');
      process.exitCode = 1;
    }
  }
}
