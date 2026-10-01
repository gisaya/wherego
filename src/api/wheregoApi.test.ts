import { fetchWheregoUsage, grantWheregoReward, prepareWheregoCandidates, prepareWheregoSelection, recommendWheregoDestination, WheregoApiError } from './wheregoApi';

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
