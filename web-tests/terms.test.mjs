import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

test('miniapp terms match six questions, first free, uncapped ads and no new sales', () => {
  const service = fs.readFileSync('public/terms/service/index.html', 'utf8');
  const privacy = fs.readFileSync('public/terms/privacy/index.html', 'utf8');
  for (const content of [service, privacy]) {
    assert.match(content, /주말어디/);
    assert.doesNotMatch(content, /여행BTI|7개 여행 취향/);
  }
  assert.match(service, /6문항/);
  assert.match(service, /첫 추천 1회는 광고 없이/);
  assert.match(service, /일일 횟수 제한이 없/);
  assert.match(service, /새로운 유료 AI 추천 이용권을 판매하지 않습니다/);
  assert.match(privacy, /6개 여행 취향/);
});

test('isolated terms build leaves the active web preview untouched', () => {
  const root = process.cwd();
  const output = path.join(root, '.vercel', 'terms-verification', randomUUID());
  const preview = path.join(root, '.vercel', 'output', 'static', 'index.html');
  const before = fs.existsSync(preview) ? fs.readFileSync(preview) : null;
  try {
    const result = spawnSync(process.execPath, ['scripts/build-vercel-terms.cjs', output], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const service = fs.readFileSync(path.join(output, 'static', 'terms', 'service', 'index.html'), 'utf8');
    assert.match(service, /6문항/);
    const config = JSON.parse(fs.readFileSync(path.join(output, 'config.json'), 'utf8'));
    assert.ok(config.routes.some(route => route.src === '^/terms/privacy/?$'));
    if (before) assert.deepEqual(fs.readFileSync(preview), before);
  } finally {
    assert.ok(output.startsWith(path.join(root, '.vercel', 'terms-verification') + path.sep));
    fs.rmSync(output, { recursive: true, force: true });
  }
});

test('terms builds reject output paths outside the generated workspace directory', () => {
  for (const output of ['.', '.vercel', path.join('..', 'outside-terms-output')]) {
    const result = spawnSync(process.execPath, ['scripts/build-vercel-terms.cjs', output], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must stay inside/);
  }
});
