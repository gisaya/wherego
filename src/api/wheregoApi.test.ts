import { fetchWheregoQuestionSet, fetchWheregoUsage, grantWheregoReward, grantWheregoResultPromotion, prepareWheregoCandidates, prepareWheregoSelection, recommendWheregoDestination, WheregoApiError } from './wheregoApi';

describe('unlimited usage API contract', () => {
  const originalFetch = global.fetch;
  const origin = { type: 'selected_region' as const, label: 'test', description: '', lat: 37.5, lng: 127, areaCodes: [] };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ usage: { adRewardsLimit: null } }) });
    global.fetch = fetchMock;
  });

  afterEach(() => { global.fetch = originalFetch; });

  it('requests the modern contract on every usage-bearing request', async () => {
    await fetchWheregoUsage({ anonymousUserKey: 'synthetic-user' });
    await grantWheregoReward({ source: 'ad', grantId: 'synthetic-ad' });
    await prepareWheregoCandidates({ origin, answers: [] });
    await recommendWheregoDestination({ origin, answers: [] });
    for (const [url] of fetchMock.mock.calls) {
      expect(url).toContain('?usagePolicy=uncapped-v1');
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('preserves null in quota errors so the ad retry remains available', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({ detail: { code: 'wherego_quota_exceeded', usage: { adRewardsLimit: null } } }) });
    await expect(fetchWheregoUsage({})).rejects.toMatchObject({ name: WheregoApiError.name, usage: { adRewardsLimit: null } });
  });

  it('separates AI-free preview and private selection preparation from result retrieval', async () => {
    await prepareWheregoCandidates({ origin, answers: [], previewOnly: true, sessionId: 'synthetic-session' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ previewOnly: true });
    await prepareWheregoSelection({ origin, answers: [], candidateSet: { candidates: [] }, sessionId: 'synthetic-session' });
    expect(fetchMock.mock.calls[1][0]).toContain('/api/wherego/prepare-selection?usagePolicy=uncapped-v1');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ sessionId: 'synthetic-session', candidateSet: { candidates: [] } });
  });
});

describe('API deadlines cover the full response', () => {
  const originalFetch = global.fetch;
  const origin = { type: 'selected_region' as const, label: 'test', description: '', lat: 37.5, lng: 127, areaCodes: [] };
  const requests = [
    ['questions', 8000, () => fetchWheregoQuestionSet({ origin })],
    ['candidates', 25000, () => prepareWheregoCandidates({ origin, answers: [] })],
    ['recommendation', 45000, () => recommendWheregoDestination({ origin, answers: [] })],
    ['usage', 8000, () => fetchWheregoUsage({})],
    ['reward', 8000, () => grantWheregoReward({ source: 'ad', grantId: 'synthetic-ad' })],
    ['preparation', 8000, () => prepareWheregoSelection({ origin, answers: [], candidateSet: { candidates: [] }, sessionId: 'synthetic-session' })],
    ['promotion', 25000, () => grantWheregoResultPromotion({ anonymousUserKey: 'synthetic-user', promotionCode: 'synthetic-promotion' })],
  ] as const;

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

  it.each(requests)('%s times out while a successful JSON body stalls', async (_, timeout, request) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => {}) });
    const result = request().then(() => 'unexpected-success', error => error);
    await jest.advanceTimersByTimeAsync(timeout);
    expect(await result).toMatchObject({ name: 'WheregoApiError', status: 408 });
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(requests)('%s times out while an error JSON body stalls', async (_, timeout, request) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: () => new Promise(() => {}) });
    const result = request().then(() => 'unexpected-success', error => error);
    await jest.advanceTimersByTimeAsync(timeout);
    expect(await result).toMatchObject({ name: 'WheregoApiError', status: 408 });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('aborts a stalled request and does not turn a timeout into a late success', async () => {
    let complete: (value: unknown) => void = () => { throw new Error('Missing request'); };
    const fetchMock = jest.fn().mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    global.fetch = fetchMock;
    const result = fetchWheregoUsage({}).then(() => 'unexpected-success', error => error);
    await jest.advanceTimersByTimeAsync(8000);
    expect(await result).toMatchObject({ status: 408 });
    expect(fetchMock.mock.calls[0]?.[1].signal.aborted).toBe(true);
    complete({ ok: true, json: async () => ({ usage: {} }) });
    await Promise.resolve();
    expect(await result).toMatchObject({ status: 408 });
  });

  it('clears the deadline after a complete response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ usage: { remaining: 1 } }) });
    await expect(fetchWheregoUsage({})).resolves.toMatchObject({ remaining: 1 });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('still enforces the deadline when the native abort API is unavailable', async () => {
    const original = global.AbortController;
    Object.defineProperty(global, 'AbortController', { value: undefined, configurable: true, writable: true });
    try {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => {}) });
      const result = fetchWheregoUsage({}).then(() => 'unexpected-success', error => error);
      await jest.advanceTimersByTimeAsync(8000);
      expect(await result).toMatchObject({ status: 408 });
    } finally {
      Object.defineProperty(global, 'AbortController', { value: original, configurable: true, writable: true });
    }
  });
});
