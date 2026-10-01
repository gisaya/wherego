const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const base = process.env.WEB_BASE_URL || 'http://127.0.0.1:4173';
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
  await context.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  const output = path.resolve(__dirname, '../.vercel/verification');
  fs.mkdirSync(output, { recursive: true });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => requests.push(req.url()));
  const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const imagesLoaded = async () => {
    await page.locator('img').evaluateAll(images => images.forEach(img => img.loading = 'eager'));
    await page.waitForFunction(() => [...document.images].every(img => img.complete), { timeout: 20000 });
    return page.locator('img').evaluateAll(images => images.every(img => img.naturalWidth > 0));
  };
  try {
    await page.goto(base);
    await noOverflow();
    await page.screenshot({ path: path.join(output, 'desktop-home.png'), fullPage: true });
    await page.getByRole('button', { name: '나들이 후보 보기' }).click();
    await page.waitForSelector('.place-card');
    assert.equal(await page.locator('.place-card').count(), 3);
    assert.equal(await imagesLoaded(), true, 'Result photos must load');
    await noOverflow();
    await page.screenshot({ path: path.join(output, 'desktop-results.png'), fullPage: true });
    await page.getByRole('link', { name: '장소 자세히 보기' }).first().click();
    const selected = await page.locator('body').getAttribute('data-place');
    assert.equal(await imagesLoaded(), true);
    assert.match(await page.locator('#map').getAttribute('href'), /^https:\/\/map.naver.com\/p\/search\//);
    await page.locator('#save').click();
    await page.locator('#saved-button').click();
    assert.equal(await page.locator('#saved-dialog .saved-row').count(), 1);
    await page.locator('#close-saved').click();
    await page.locator('#save').click();
    await page.locator('#saved-button').click();
    assert.equal(await page.locator('#saved-dialog .saved-row').count(), 1, 'Saving twice must not duplicate');
    await page.locator('#close-saved').click();
    await page.locator('#share').click();
    await page.waitForFunction(() => document.querySelector('#result-message').textContent.includes('복사했어요'));
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert.equal(copied, `${base}/places/${selected}/?from=share`);
    await page.goto(copied);
    assert.equal(await page.locator('body').getAttribute('data-place'), selected);
    await page.locator('#saved-button').click();
    await page.locator('[data-remove]').click();
    assert.equal(await page.locator('.saved-row').count(), 0);
    await page.locator('#close-saved').click();
    await page.evaluate(() => localStorage.setItem('weekend-saved-v1', '{broken'));
    await page.locator('#saved-button').click();
    assert.equal(await page.locator('.saved-row').count(), 0);
    await page.locator('#close-saved').click();
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(base);
      await noOverflow();
      await page.screenshot({ path: path.join(output, `mobile-${width}-home.png`), fullPage: true });
      await page.getByRole('button', { name: '나들이 후보 보기' }).click();
      await imagesLoaded();
      await noOverflow();
      await page.screenshot({ path: path.join(output, `mobile-${width}-results.png`), fullPage: true });
      await page.getByRole('link', { name: '장소 자세히 보기' }).first().click();
      await imagesLoaded();
      await noOverflow();
      await page.screenshot({ path: path.join(output, `mobile-${width}-place.png`), fullPage: true });
    }
    const { catalog } = await import('../public/web/catalog.mjs');
    const { guides } = await import('../public/web/guides.mjs');
    const failedImages = [];
    for (const p of catalog) {
      const response = await page.goto(`${base}/places/${p.id}/`);
      assert.equal(response.status(), 200);
      if (!await imagesLoaded()) failedImages.push(p.id);
      await noOverflow();
    }
    assert.deepEqual(failedImages, [], 'Catalog photos must load');
    for (const g of guides) {
      const response = await page.goto(`${base}/ideas/${g.slug}/`);
      assert.equal(response.status(), 200);
      await noOverflow();
    }
    assert.equal((await page.goto(`${base}/missing-page`)).status(), 404);
    assert.equal(requests.some(url => /jbg\.onrender|generativelanguage|\/api\/wherego/.test(url)), false);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, viewports: [1440, 390, 320], places: catalog.length, guides: guides.length, aiRequests: 0, browserErrors: errors.length, screenshots: output }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
