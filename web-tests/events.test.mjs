import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import handler from '../web-server/events.cjs';

test('event endpoint enforces request boundaries and strips private fields', async () => {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = (body, origin = base) => fetch(base, { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body });
  const log = console.info;
  const logs = [];
  console.info = event => logs.push(JSON.parse(event));
  try {
    const valid = await send(JSON.stringify({ event: 'map', source: 'share', user: 'private-value' }));
    assert.equal(valid.status, 200);
    assert.equal(valid.headers.get('cache-control'), 'no-store');
    assert.deepEqual(logs, [{ experiment: 'weekend-rules-v1', event: 'map', source: 'share' }]);
    assert.equal((await fetch(base)).status, 405);
    assert.equal((await send('{')).status, 400);
    assert.equal((await send('{}')).status, 400);
    assert.equal((await send('{"event":"visit"}', 'https://other.example')).status, 403);
    assert.equal((await send(JSON.stringify({ event: 'visit', excess: 'x'.repeat(600) }))).status, 413);
    assert.equal(logs.length, 1);
  } finally {
    console.info = log;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
