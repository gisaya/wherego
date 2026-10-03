const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const root = path.resolve(__dirname, '../.vercel/output/static');
  const origin = 'https://wherego-lake.vercel.app';
  const { publisherId } = await import('./weekend-monetization.mjs');
  const { catalog } = await import('../public/web/catalog.mjs');
  const { guides } = await import('../public/web/guides.mjs');
  const { resultSnapshot, resultStorageKey } = await import('../public/web/recommendation.mjs');
  const mime = { '.mjs': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml' };
  let adRequests = 0;
  const errors = [];
  try {
    for (const failAds of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 320, height: 844 } });
      try {
        await context.route('**/*', async route => {
          const url = new URL(route.request().url());
          if (url.hostname === 'pagead2.googlesyndication.com') {
            adRequests++;
            if (failAds) return route.abort();
            return route.fulfill({ contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: `
              window.googlefc.showRevocationMessage = () => { window.__revocations = (window.__revocations || 0) + 1; };
              const callbacks = window.googlefc.callbackQueue;
              window.googlefc.callbackQueue = { push(callback) { callback.CONSENT_API_READY?.(); } };
              for (const callback of callbacks) callback.CONSENT_API_READY?.();
            ` });
          }
          if (url.origin !== origin) return route.abort();
          if (url.pathname === '/api/events') return route.fulfill({ contentType: 'application/json', body: '{"ok":true}' });
          if (url.pathname === '/web/monetization.json') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
            enabled: true, clientId: publisherId, hosts: [url.hostname], displaySlot: '1234567890',
          }) });
          let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
          assert.ok(file === root || file.startsWith(root + path.sep));
          if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
          if (!fs.existsSync(file)) return route.fulfill({ status: 404 });
          return route.fulfill({ contentType: mime[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(origin);
        await page.locator('#start').click();
        await page.locator('#choose-region').click();
        await page.locator('[data-origin="seoul"]').click();
        assert.equal(await page.locator('#weekend-adsense').count(), 0, 'Live config cannot put ads in questions');
        await page.goto(origin + '/recommendation/');
        assert.equal(await page.locator('.result-card').count(), 0);
        assert.equal(await page.locator('#weekend-adsense').count(), 0, 'No ads in an empty result');
        const before = adRequests;
        await page.goto(origin + '/ideas/' + guides[0].slug + '/');
        await page.waitForSelector('#weekend-adsense', { state: 'attached' });
        if (failAds) {
          await page.waitForFunction(() => document.querySelector('[data-display-ad]').hidden);
          assert.equal(await page.locator('#ad-privacy').isVisible(), false);
        } else {
          await page.waitForFunction(() => window.adsbygoogle?.length === 1);
          await page.locator('#ad-privacy').click();
          assert.equal(await page.evaluate(() => window.__revocations), 1);
          await page.evaluate(async () => (await import('/web/adsense.mjs')).setupAds('guide'));
          assert.equal(adRequests, before + 1, 'No duplicate ad request on rerender');
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          await page.locator('ins.adsbygoogle').evaluate(ad => ad.setAttribute('data-ad-status', 'unfilled'));
          await page.waitForFunction(() => document.querySelector('[data-display-ad]').hidden);
        }
        await page.evaluate(({ key, value }) => sessionStorage.setItem(key, value), {
          key: resultStorageKey, value: JSON.stringify(resultSnapshot(catalog[0])),
        });
        await page.goto(origin + '/recommendation/');
        await page.waitForSelector('.result-card');
        await page.waitForSelector('#weekend-adsense', { state: 'attached' });
        if (failAds) await page.waitForFunction(() => document.querySelector('[data-display-ad]').hidden);
        assert.equal(await page.locator('#map').isVisible(), true, 'Ad failure does not break navigation');
        assert.equal(await page.locator('#other-place').count(), 0);
      } finally { await context.close(); }
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, mode: 'intercepted-fixtures-only', actualAdRequests: 0,
      adRequestsMocked: adRequests, cases: ['live-host', 'no-question-ads', 'no-empty-page-ads', 'script-once',
        'consent-entrypoint', 'unfilled-hidden', 'ad-block-failure', 'result-navigation'], browserErrors: 0 }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
