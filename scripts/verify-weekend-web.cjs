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
  const events = [];
  const output = path.resolve(__dirname, '../.vercel/verification');
  fs.mkdirSync(output, { recursive: true });
  const watch = target => {
    target.on('pageerror', error => errors.push(error.message));
    target.on('request', req => {
      requests.push(req.url());
      if (new URL(req.url()).pathname === '/api/events' && req.method() === 'POST') events.push(req.postDataJSON());
    });
  };
  watch(page);
  const eventAfter = async (target, event, action) => {
    const response = target.waitForResponse(res => new URL(res.url()).pathname === '/api/events' &&
      res.request().method() === 'POST' && res.request().postDataJSON().event === event);
    await action();
    const received = await response;
    assert.equal(received.status(), 200, 'Event endpoint must accept the browser payload');
    return received.request().postDataJSON();
  };

  const { questions } = await import('../public/web/questions.mjs');
  const { origins } = await import('../public/web/flow.mjs');
  const answerQuestions = async (target, start = 0, allowEmpty = false, reveal = true) => {
    for (const question of questions.slice(start)) {
      await target.locator(`[data-question="${question.id}"]`).first().click();
      if (question === questions.at(-1)) {
        await target.waitForFunction(() => document.body.dataset.flow === 'review');
        assert.equal(await target.locator('.result-card').count(), 0, 'The final choice must not expose any result');
        if (!allowEmpty && reveal) {
          await target.locator('#reveal-result').click();
          await target.waitForURL('**/recommendation/');
          await target.waitForSelector('.result-card');
        }
      }
      else await target.waitForFunction(id => document.querySelector('[data-question]')?.dataset.question !== id, question.id);
    }
  };
  const startFlow = async (target, originId = 'seoul') => {
    await target.locator('#start').click();
    await target.locator('#choose-region').click();
    await target.locator(`[data-origin="${originId}"]`).click();
    await target.waitForSelector('[data-question]');
  };
  const completeFlow = async target => { await startFlow(target); await answerQuestions(target); };

  const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const imagesLoaded = async (target = page) => {
    await target.locator('img').evaluateAll(images => images.forEach(img => img.loading = 'eager'));
    await target.waitForFunction(() => [...document.images].every(img => img.complete), null, { timeout: 20000 });
    return target.locator('img').evaluateAll(images => images.every(img => img.naturalWidth > 0));
  };
  try {
    assert.deepEqual(await eventAfter(page, 'visit', () => page.goto(base, { referer: 'https://www.google.com/search?q=weekend' })),
      { event: 'visit', source: 'search' });

    await noOverflow();
    assert.equal(await imagesLoaded(), true, 'All three miniapp intro photos must load');
    await page.screenshot({ path: path.join(output, 'desktop-home.png'), fullPage: true });
    await page.locator('.guide-nav').click();
    await page.waitForFunction(() => scrollY > 0 && document.querySelector('#guides').getBoundingClientRect().top < innerHeight / 2);
    await page.goBack();
    assert.equal((await eventAfter(page, 'result', () => completeFlow(page))).source, 'search');
    assert.equal(await page.locator('.result-card').count(), 1, 'Show one recommendation, not a candidate grid');
    assert.equal(await imagesLoaded(), true, 'Result photo must load');
    await noOverflow();
    await page.screenshot({ path: path.join(output, 'desktop-results.png'), fullPage: true });

    await page.locator('#flow-back').click();
    await page.waitForSelector('#start');
    await startFlow(page);
    await answerQuestions(page, 0, false, false);
    await page.screenshot({ path: path.join(output, 'desktop-review.png'), fullPage: true });
    await page.locator('[data-edit="5"]').click();
    await page.waitForSelector(`[data-question="${questions[5].id}"]`);
    assert.equal(await page.locator('[data-answer][aria-pressed="true"]').count(), 1, 'Back preserves the selected answer');
    await page.goBack();
    await page.waitForSelector('.review-screen');
    await page.locator('[data-edit="4"]').click();
    await page.locator('[data-answer]').nth(1).click();
    await page.waitForSelector(`[data-question="${questions[5].id}"]`);
    assert.equal(await page.locator('[data-answer][aria-pressed="true"]').count(), 0, 'Changing an answer clears later selections');
    await answerQuestions(page, 5);

    const selected = await page.locator('[data-result-place]').getAttribute('data-result-place');
    assert.match(await page.locator('#map').getAttribute('href'), /^https:\/\/map.naver.com\/p\/search\//);
    assert.equal((await eventAfter(page, 'save', () => page.locator('#save').click())).source, 'search');
    assert.equal(await page.locator('#save').getAttribute('aria-pressed'), 'true');
    await context.route('https://map.naver.com/**', route => route.fulfill({ status: 200, body: '<title>Map target</title>' }));
    const mapWindow = page.waitForEvent('popup');
    assert.equal((await eventAfter(page, 'map', () => page.locator('#map').click())).source, 'search');
    await (await mapWindow).close();
    await page.locator('#saved-button').click();
    assert.equal(await page.locator('#saved-dialog .saved-row').count(), 1);
    await page.locator('#close-saved').click();
    await page.locator('#save').click();
    await page.locator('#saved-button').click();
    assert.equal(await page.locator('#saved-dialog .saved-row').count(), 0, 'Second tap removes the bookmark');
    await page.locator('#close-saved').click();
    await page.locator('#save').click();
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
    assert.equal(await page.locator('#save').getAttribute('aria-pressed'), 'false');
    await page.evaluate(() => localStorage.setItem('weekend-saved-v1', '{broken'));
    await page.locator('#saved-button').click();
    assert.equal(await page.locator('.saved-row').count(), 0);
    await page.locator('#close-saved').click();

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(base);
      await imagesLoaded();
      await noOverflow();
      await page.screenshot({ path: path.join(output, `mobile-${width}-home.png`), fullPage: true });
      await page.locator('#start').click();
      await noOverflow();
      await page.screenshot({ path: path.join(output, `mobile-${width}-origin.png`), fullPage: true });
      await page.locator('#choose-region').click();
      assert.equal(await page.locator('#region-dialog [data-origin]').count(), 11);
      await page.screenshot({ path: path.join(output, `mobile-${width}-regions.png`), fullPage: true });
      await page.locator('[data-origin="seoul"]').click();
      await noOverflow();
      await page.screenshot({ path: path.join(output, `mobile-${width}-question.png`), fullPage: true });
      assert.equal(await page.locator('.option-card').count(), 2);
      // A rapid second tap must never advance two questions.
      await page.locator('[data-answer]').first().evaluate(button => { button.click(); button.click(); });
      await page.waitForSelector(`[data-question="${questions[1].id}"]`);
      assert.equal(await page.locator('#step-counter').textContent(), '2 / 6');
      await answerQuestions(page, 1, false, false);
      await noOverflow();
      await page.screenshot({ path: path.join(output, `mobile-${width}-review.png`), fullPage: true });
      await page.locator('#reveal-result').click();
      await page.waitForSelector('.result-card');
      assert.equal(await imagesLoaded(), true);
      await noOverflow();
      assert.equal(await page.locator('.share-disclosure').evaluate(el => el.scrollHeight <= 22), true, 'Share notice stays on one line');
      const spacing = await page.evaluate(() => document.querySelector('#share').getBoundingClientRect().top -
        document.querySelector('.location-summary').getBoundingClientRect().bottom);
      assert.ok(spacing >= 24, 'Share button must not touch the location section');
      assert.equal(await page.locator('.result-actions button, .result-actions a').evaluateAll(elements =>
        elements.every(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)), true);
      await page.screenshot({ path: path.join(output, `mobile-${width}-results.png`), fullPage: true });
      assert.equal(await page.locator('#other-place').count(), 0, 'Candidate cycling is removed');
      await page.locator('#restart').click();
      await page.waitForURL(url => !url.hash);
      assert.equal(await page.locator('#start').count(), 1);
      await startFlow(page);
      assert.equal(await page.locator('[data-answer][aria-pressed="true"]').count(), 0, 'Restart clears the previous answers');
    }

    for (const origin of origins) {
      await page.goto(base);
      await startFlow(page, origin.id);
      assert.match(await page.locator('.origin-chip').textContent(), new RegExp(origin.label));
    }
    await page.goto(base);
    const beforeEmpty = events.filter(event => event.event === 'result').length;
    await startFlow(page, 'gyeongnam');
    await answerQuestions(page, 0, true);
    assert.equal(await page.locator('.empty-screen').count(), 1);
    assert.equal(events.filter(event => event.event === 'result').length, beforeEmpty, 'No recommendation is not counted as a successful result');
    await page.locator('#change-origin').click();
    await page.waitForURL(url => url.hash === '#origin');
    assert.equal(await page.locator('#use-current-location').count(), 1);

    const located = await browser.newContext({ viewport: { width: 390, height: 844 },
      permissions: ['geolocation'], geolocation: { latitude: 37.5691701546, longitude: 126.8360015625, accuracy: 25 } });
    try {
      await located.addInitScript(() => {
        window.__locationCalls = 0;
        const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
        navigator.geolocation.getCurrentPosition = (...args) => { window.__locationCalls++; return original(...args); };
      });
      const geoPage = await located.newPage();
      watch(geoPage);
      await geoPage.goto(base);
      assert.equal(await geoPage.evaluate(() => window.__locationCalls), 0);
      await geoPage.locator('#start').click();
      assert.equal(await geoPage.evaluate(() => window.__locationCalls), 0, 'Opening the origin screen must not request permission');
      await geoPage.locator('#use-current-location').click();
      await geoPage.waitForSelector('[data-question]');
      assert.equal(await geoPage.evaluate(() => window.__locationCalls), 1);
      assert.match(await geoPage.locator('.origin-chip').textContent(), /현재 위치/);
      await answerQuestions(geoPage);
      assert.equal(await geoPage.locator('[data-result-place]').getAttribute('data-result-place'), 'botanic');
      assert.match(await geoPage.locator('.travel-note').textContent(), /내 현재 위치 기준 자동차 왕복 약 0분/);
      assert.doesNotMatch(await geoPage.locator('.travel-note').textContent(), /시청/);
      assert.equal(await imagesLoaded(geoPage), true, 'Current-location result photo and icons must load');
      await geoPage.screenshot({ path: path.join(output, 'mobile-current-location-result.png'), fullPage: true });
      const privateState = await geoPage.evaluate(() => ({
        history: JSON.stringify(history.state),
        session: JSON.stringify(Object.entries(sessionStorage)),
        local: JSON.stringify(Object.entries(localStorage)),
      }));
      for (const value of Object.values(privateState)) assert.doesNotMatch(value, /37\.5691701546|126\.8360015625|"lat"|"lng"|"accuracy"/);
      await geoPage.goBack();
      await geoPage.waitForSelector('#start');
      await geoPage.goForward();
      await geoPage.waitForSelector('.result-card');
      assert.match(await geoPage.locator('.travel-note').textContent(), /왕복 약 0분/);
      assert.equal(await geoPage.evaluate(() => window.__locationCalls), 0, 'Result reads the presentation, never requests location again');
      await geoPage.reload();
      assert.equal(await geoPage.locator('.result-card').count(), 1, 'Reload may restore only the unexpired result');
      assert.equal(await geoPage.evaluate(() => window.__locationCalls), 0, 'Reload must not restore or request a location');
    } finally { await located.close(); }

    for (const mode of ['denied', 'unsupported', 'timeout', 'late']) {
      const locationFailure = await browser.newContext({ viewport: { width: 320, height: 844 } });
      try {
        await locationFailure.addInitScript(mode => {
          window.__locationCalls = 0;
          if (mode === 'unsupported') Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });
          else {
            Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition(success, failure) {
              window.__locationCalls++;
              if (mode === 'denied') failure({ code: 1 });
              else window.__lateLocation = success;
            } }, configurable: true });
            if (mode === 'timeout') {
              const originalTimer = window.setTimeout.bind(window);
              window.setTimeout = (callback, delay, ...args) => originalTimer(callback, delay === 12000 ? 50 : delay, ...args);
            }
          }
        }, mode);
        const failedPage = await locationFailure.newPage();
        watch(failedPage);
        await failedPage.goto(base);
        await failedPage.locator('#start').click();
        await failedPage.locator('#use-current-location').click();
        if (mode === 'late') {
          assert.equal(await failedPage.locator('#use-current-location').isDisabled(), true);
          await failedPage.locator('#use-current-location').evaluate(button => button.onclick());
          assert.equal(await failedPage.evaluate(() => window.__locationCalls), 1);
        } else {
          await failedPage.waitForFunction(() => !document.querySelector('#use-current-location').disabled);
          assert.match(await failedPage.locator('#location-status').textContent(), /권한|지원|초과/);
          assert.equal(await failedPage.locator('[data-question]:visible').count(), 0, 'Failure must not substitute a city origin');
          await failedPage.screenshot({ path: path.join(output, `mobile-location-${mode}.png`), fullPage: true });
        }
        await failedPage.locator('#choose-region').click();
        await failedPage.locator('[data-origin="seoul"]').click();
        await failedPage.waitForSelector('[data-question]');
        if (mode === 'late') {
          await failedPage.evaluate(() => window.__lateLocation({ coords: { latitude: 35.1796, longitude: 129.0756, accuracy: 20 } }));
          assert.equal(await failedPage.locator('#step-counter').textContent(), '1 / 6');
          assert.match(await failedPage.locator('.origin-chip').textContent(), /서울\/수도권/);
          await failedPage.goBack();
          await failedPage.waitForSelector('#use-current-location');
          await failedPage.locator('#use-current-location').click();
          await failedPage.locator('#flow-back').click();
          await failedPage.waitForSelector('#start');
          await failedPage.evaluate(() => window.__lateLocation({ coords: { latitude: 37.5665, longitude: 126.978, accuracy: 20 } }));
          assert.equal(await failedPage.locator('#start').count(), 1, 'Late response after navigation cannot reopen questions');
        }
      } finally { await locationFailure.close(); }
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
    const sharedPage = await context.newPage();
    watch(sharedPage);
    const shareStart = events.filter(event => event.event === 'share_visit').length;
    assert.deepEqual(await eventAfter(sharedPage, 'share_visit', () => sharedPage.goto(`${base}/places/${selected}/?from=share`)),
      { event: 'share_visit', source: 'share' });
    assert.deepEqual(await eventAfter(sharedPage, 'visit', () => sharedPage.locator('.brand').click()),
      { event: 'visit', source: 'share' });
    assert.equal(events.filter(event => event.event === 'share_visit').length, shareStart + 1);
    await sharedPage.close();
    for (const mode of ['dnt', 'blocked-storage']) {
      const isolated = await browser.newContext({ viewport: { width: 390, height: 844 } });
      try {
        await isolated.addInitScript(mode => {
          if (mode === 'dnt') Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
          else Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
        }, mode);
        const isolatedPage = await isolated.newPage();
        watch(isolatedPage);
        const eventStart = events.length;
        await isolatedPage.goto(base);
        if (mode === 'blocked-storage') {
          await startFlow(isolatedPage);
          await answerQuestions(isolatedPage, 0, false, false);
          await isolatedPage.locator('#reveal-result').click();
          assert.match(await isolatedPage.locator('#review-message').textContent(), /저장소/);
          assert.equal(await isolatedPage.locator('.result-card').count(), 0);
          assert.equal(await isolatedPage.locator('#reveal-result').isEnabled(), true);
          assert.ok(events.length > eventStart, 'Blocked storage must not stop the event sender');
          continue;
        }
        await completeFlow(isolatedPage);
        assert.equal(await isolatedPage.locator('.result-card').count(), 1);
        await isolatedPage.waitForFunction(() => typeof document.querySelector('#save')?.onclick === 'function');
        if (mode === 'dnt') {
          assert.equal(events.length, eventStart, 'DNT must prevent all analytics events');
          assert.equal(await isolatedPage.evaluate(() => sessionStorage.getItem('weekend-source-v1')), null);
        }
      } finally { await isolated.close(); }
    }
    const unavailable = await browser.newContext({ viewport: { width: 320, height: 844 } });
    try {
      await unavailable.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
        Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('Unavailable'); } }, configurable: true });
      });
      const fallback = await unavailable.newPage();
      watch(fallback);
      await fallback.goto(base);
      await completeFlow(fallback);
      await fallback.locator('#save').click();
      assert.match(await fallback.locator('#result-message').textContent(), /저장 공간/);
      await fallback.locator('#share').click();
      await fallback.waitForSelector('.share-input');
      assert.match(await fallback.locator('.share-input').inputValue(), /\/places\/[^/]+\/\?from=share$/);
      await fallback.reload();
      assert.equal(await fallback.locator('.result-card').count(), 1, 'Reload recovers the result, never private answers');
      assert.equal(await fallback.evaluate(() => JSON.stringify(history.state).includes('answers')), false);
    } finally { await unavailable.close(); }
    assert.ok(events.length > 0);
    for (const payload of events) {
      assert.deepEqual(Object.keys(payload).sort(), ['event', 'source'], 'No identity, referrer or answers in browser payloads');
      assert.ok(['direct', 'search', 'share', 'guide', 'referral'].includes(payload.source));
    }
    assert.equal(requests.some(url => /jbg\.onrender|generativelanguage|\/api\/wherego/.test(url)), false);
    assert.equal(requests.some(url => /googlesyndication|doubleclick/.test(url)), false, 'No paid ad requests in a preview');
    assert.match(await (await context.request.get(base + '/ads.txt')).text(), /^google\.com, pub-\d{16}, DIRECT, f08c47fec0942fa0\n$/);
    const isolatedResult = await browser.newContext();
    try {
      const direct = await isolatedResult.newPage();
      await direct.goto(base + '/recommendation/');
      assert.equal(await direct.locator('.result-card').count(), 0, 'A direct URL must not fabricate a result');
      assert.equal(await direct.locator('#weekend-adsense').count(), 0, 'Empty result pages do not request ads');
      assert.equal(await direct.locator('meta[name="robots"]').getAttribute('content'), 'noindex,follow');
    } finally { await isolatedResult.close(); }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, viewports: [1440, 390, 320], places: catalog.length, guides: guides.length,
      questions: questions.length, flows: ['review-before-reveal', 'back-change', 'double-tap', 'restart', 'one-result-no-carousel', 'bookmark-share-map'],
      location: ['11-regions', 'device-coordinates', 'denied', 'unsupported', 'timeout', 'late-response', 'private-history-storage'],
      attribution: ['search-to-map/save', 'share-entry-once', 'dnt', 'blocked-storage'], aiRequests: 0, browserErrors: errors.length, screenshots: output }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
