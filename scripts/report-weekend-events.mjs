import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import ingestion from '../web-server/events.cjs';

export function summarizeEvents(lines) {
  const summary = { accepted: 0, ignored: 0, events: {}, sources: {} };
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      const payload = row.experiment ? row : typeof row.message === 'string' ? JSON.parse(row.message) : null;
      const event = payload?.experiment === 'weekend-rules-v1' ? ingestion.cleanEvent(payload) : null;
      if (!event) { summary.ignored++; continue; }
      summary.accepted++;
      summary.events[event.event] = (summary.events[event.event] || 0) + 1;
      summary.sources[event.source] ??= {};
      summary.sources[event.source][event.event] = (summary.sources[event.source][event.event] || 0) + 1;
    } catch { summary.ignored++; }
  }
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) { console.error('Usage: node scripts/report-weekend-events.mjs <exported-log.ndjson>'); process.exitCode = 1; }
  else console.log(JSON.stringify(summarizeEvents(fs.readFileSync(file, 'utf8').split(/\r?\n/)), null, 2));
}
