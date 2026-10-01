import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { appLogin, IAP, isMinVersionSupported, Storage } from '@apps-in-toss/framework';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { WheregoApp } from './WheregoApp';
import { fetchWheregoIapConfig, fetchWheregoUsage, grantWheregoIapPurchase, grantWheregoReward, linkWheregoGuestUsage, prepareWheregoCandidates, prepareWheregoSelection, recommendWheregoDestination, WheregoApiError, type WheregoUsage } from './api/wheregoApi';

const mockLoadAd = jest.fn();
const mockShowAd = jest.fn();
let mockAdEvents: { onEvent: (event: { type: string }) => void; onError: (error: Error) => void };
const mockBackEvent = { addEventListener: jest.fn(), removeEventListener: jest.fn() };

jest.mock('@apps-in-toss/framework', () => ({
  Accuracy: { Balanced: 'balanced' },
  appLogin: jest.fn(),
  getAnonymousKey: jest.fn(async () => ({ type: 'HASH', hash: 'test-identity' })),
  getCurrentLocation: jest.fn(async () => ({ coords: { latitude: 37.5, longitude: 127.0 } })),
  isMinVersionSupported: jest.fn(() => false),
  loadFullScreenAd: Object.assign((options: unknown) => mockLoadAd(options), { isSupported: () => true }),
  showFullScreenAd: Object.assign((options: unknown) => mockShowAd(options), { isSupported: () => true }),
  InlineAd: () => null,
  Storage: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
  IAP: {
    createOneTimePurchaseOrder: jest.fn(),
    getProductItemList: jest.fn(),
    getPendingOrders: jest.fn(async () => ({ orders: [] })),
    getCompletedOrRefundedOrders: jest.fn(async () => ({ orders: [], hasNext: false })),
    completeProductGrant: jest.fn(async () => true),
  },
}));
jest.mock('@granite-js/react-native', () => ({
  useBackEvent: () => mockBackEvent,
  closeView: jest.fn(async () => undefined),
  openURL: jest.fn(async () => undefined),
}));
jest.mock('@toss/tds-react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Text,
    TDSProvider: ({ children }: { children: React.ReactNode }) => children,
    Button: ({ children, viewStyle, ...props }: { children: React.ReactNode; viewStyle: object }) =>
      React.createElement(Pressable, { ...props, style: viewStyle }, React.createElement(Text, null, children)),
  };
});
jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { __esModule: true, default: View, ClipPath: View, Defs: View, G: View, Image: View, Rect: View, Text: View };
});
jest.mock('./analytics/SafeAnalytics', () => ({
  SafeAnalyticsImpression: ({ children }: { children: React.ReactNode }) => children,
  SafeAnalyticsPress: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('./review/resultReview', () => ({ recordSuccessfulResultForReview: jest.fn(async () => false) }));
jest.mock('./api/wheregoApi', () => {
  const actual = jest.requireActual<typeof import('./api/wheregoApi')>('./api/wheregoApi');
  return {
    ...actual,
    fetchWheregoUsage: jest.fn(),
    fetchWheregoIapConfig: jest.fn(async () => ({ enabled: false, products: [] })),
    fetchWheregoQuestionSet: jest.fn(async () => ({
      questionSetId: 'test-session',
      questions: Array.from({ length: 6 }, (_, index) => ({
        id: `question-${index}`, type: index < 3 ? 'source' : 'general',
        question: `질문 ${index}`, tags: [`theme-${index}`], layout: 'two',
        options: [{ label: `선택 ${index}`, caption: '선택' }, { label: `다른 선택 ${index}`, caption: '선택' }],
      })),
    })),
    grantWheregoReward: jest.fn(),
    grantWheregoIapPurchase: jest.fn(),
    linkWheregoGuestUsage: jest.fn(),
    prepareWheregoCandidates: jest.fn(),
    prepareWheregoSelection: jest.fn(),
    recommendWheregoDestination: jest.fn(),
  };
});

const dailyUsage: WheregoUsage = {
  date: '2026-10-01', remaining: 1, dailyRemaining: 1, baseDailyLimit: 1,
  baseUsed: 0, baseRemaining: 1, adRewardsUsed: 0, adRewardsLimit: null,
  adCreditsRemaining: 0, shareRewardUsed: false, shareCreditsRemaining: 0,
  paidCreditsRemaining: 0, nextResetAt: '2026-10-02T00:00:00+09:00', limitEnabled: true,
};
const usedDailyUsage = { ...dailyUsage, remaining: 0, dailyRemaining: 0, baseUsed: 1, baseRemaining: 0 };

describe('daily free and ongoing ad recommendation flow', () => {
  let renderer: ReactTestRenderer;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.mocked(isMinVersionSupported).mockReturnValue(false);
    jest.mocked(Storage.getItem).mockResolvedValue(null);
    jest.mocked(fetchWheregoIapConfig).mockResolvedValue({ enabled: false, restorationEnabled: false, products: [] });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    mockLoadAd.mockImplementation(({ onEvent }) => { onEvent({ type: 'loaded' }); return jest.fn(); });
    mockShowAd.mockImplementation(options => { mockAdEvents = options; return jest.fn(); });
    jest.mocked(fetchWheregoUsage).mockResolvedValue(dailyUsage);
    jest.mocked(grantWheregoReward).mockResolvedValue({ ...usedDailyUsage, remaining: 1, adCreditsRemaining: 1 });
    jest.mocked(prepareWheregoCandidates).mockImplementation(async params => params.previewOnly
      ? { candidates: [] }
      : { candidates: [], creditSource: 'ad', adFree: false, usage: usedDailyUsage });
    jest.mocked(prepareWheregoSelection).mockResolvedValue({ status: 'preparing' });
    jest.mocked(recommendWheregoDestination).mockResolvedValue({
      personaTitle: '예시 여행', oneLine: '예시 추천',
      recommendedPlaces: [{ contentId: 'sample-1', title: '예시 공원', address: '예시시 예시구' }],
    });
  });

  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  async function openApp(entryMode: 'general' | 'promotion' = 'general') {
    await act(async () => { renderer = create(<WheregoApp entryMode={entryMode} />); });
  }

  async function press(label: string) {
    const button = renderer.root.findAll(node => node.props.children === label && typeof node.props.onPress === 'function')[0];
    if (!button) throw new Error(`Missing button: ${label}`);
    expect(button.props.disabled).not.toBe(true);
    await act(async () => { button.props.onPress(); });
  }

  async function answerQuestions() {
    await press('AI 추천 시작하기');
    await press('현재 위치로 추천');
    for (let index = 0; index < 6; index += 1) {
      const option = renderer.root.findAll(node => node.props.option?.label === `선택 ${index}`)[0];
      if (!option) throw new Error(`Missing question option: ${index}`);
      await act(async () => { option.props.onPress(); });
      await act(async () => { jest.advanceTimersByTime(250); });
    }
  }

  it.each(['general', 'promotion'] as const)('removes new purchases and product SDK calls from the %s entry', async entryMode => {
    jest.mocked(isMinVersionSupported).mockReturnValue(true);
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    await openApp(entryMode);
    expect(renderer.root.findAll(node => typeof node.props.children === 'string' && /구매|495원|토스로 로그인/.test(node.props.children))).toHaveLength(0);
    expect(fetchWheregoIapConfig).not.toHaveBeenCalled();
    expect(IAP.getProductItemList).not.toHaveBeenCalled();
    expect(IAP.createOneTimePurchaseOrder).not.toHaveBeenCalled();
    expect(appLogin).not.toHaveBeenCalled();
  });

  it('keeps existing paid credits usable without a new purchase or ad', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue({ ...usedDailyUsage, remaining: 2, paidCreditsRemaining: 2 });
    jest.mocked(prepareWheregoCandidates).mockResolvedValue({ creditSource: 'paid', adFree: false, usage: usedDailyUsage } as never);
    await openApp();
    await answerQuestions();
    await press('이용권으로 결과 보기');
    expect(recommendWheregoDestination).toHaveBeenCalledTimes(1);
    expect(mockShowAd).not.toHaveBeenCalled();
    expect(IAP.createOneTimePurchaseOrder).not.toHaveBeenCalled();
    expect(appLogin).not.toHaveBeenCalled();
  });

  it('restores already-paid pending orders with a saved session even though new sales are disabled', async () => {
    jest.mocked(isMinVersionSupported).mockReturnValue(true);
    const storedSession = { anonymousUserKey: 'toss-login-test-identity', sessionToken: 'test-saved-session-token-long-enough', expiresAt: '2030-01-01T00:00:00Z' };
    jest.mocked(Storage.getItem).mockImplementation(async key => key === 'wherego.toss-login-session.v1' ? JSON.stringify(storedSession) : null);
    jest.mocked(linkWheregoGuestUsage).mockResolvedValue(usedDailyUsage);
    jest.mocked(fetchWheregoIapConfig).mockResolvedValue({ enabled: false, restorationEnabled: true, products: [{ sku: 'test-sku', credits: 3 }] });
    jest.mocked(IAP.getPendingOrders).mockResolvedValueOnce({ orders: [{ orderId: 'test-order', sku: 'test-sku' }] } as never);
    jest.mocked(grantWheregoIapPurchase).mockResolvedValue({ usage: { ...usedDailyUsage, remaining: 3, paidCreditsRemaining: 3 }, grantedCredits: 3 } as never);
    await openApp();
    expect(grantWheregoIapPurchase).toHaveBeenCalledTimes(1);
    expect(IAP.completeProductGrant).toHaveBeenCalledWith({ params: { orderId: 'test-order' } });
    expect(appLogin).not.toHaveBeenCalled();
    expect(IAP.getProductItemList).not.toHaveBeenCalled();
    expect(IAP.createOneTimePurchaseOrder).not.toHaveBeenCalled();
  });

  it('recovers from a missing ad load callback and ignores a late callback', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    let lateLoad: ((event: { type: string }) => void) | undefined;
    mockLoadAd.mockImplementation(({ onEvent }) => { lateLoad = onEvent; return jest.fn(); });
    await openApp();
    await answerQuestions();
    await act(async () => { jest.advanceTimersByTime(15000); });
    if (!lateLoad) throw new Error('Missing ad load request');
    await act(async () => { lateLoad!({ type: 'loaded' }); });
    mockLoadAd.mockImplementation(({ onEvent }) => { onEvent({ type: 'loaded' }); return jest.fn(); });
    await press('광고 다시 준비하기');
    await press('광고 보고 추천받기');
    expect(mockShowAd).toHaveBeenCalledTimes(1);
    expect(grantWheregoReward).not.toHaveBeenCalled();
  });

  it('recovers from an ad that never starts without granting a credit', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    await openApp();
    await answerQuestions();
    await press('광고 보고 추천받기');
    const lateEvents = mockAdEvents;
    await act(async () => { jest.advanceTimersByTime(8000); });
    await act(async () => { lateEvents.onEvent({ type: 'userEarnedReward' }); });
    expect(grantWheregoReward).not.toHaveBeenCalled();
    expect(recommendWheregoDestination).not.toHaveBeenCalled();
    await press('광고 다시 준비하기');
  });

  it('does not cut off a playing ad after the start timeout', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    jest.mocked(grantWheregoReward).mockResolvedValue({ ...usedDailyUsage, remaining: 1, dailyRemaining: 1, adCreditsRemaining: 1 });
    await openApp();
    await answerQuestions();
    await press('광고 보고 추천받기');
    await act(async () => { mockAdEvents.onEvent({ type: 'show' }); });
    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(prepareWheregoSelection).not.toHaveBeenCalled();
    expect(grantWheregoReward).not.toHaveBeenCalled();
    await act(async () => { mockAdEvents.onEvent({ type: 'userEarnedReward' }); });
    await act(async () => { mockAdEvents.onEvent({ type: 'dismissed' }); });
    expect(grantWheregoReward).toHaveBeenCalledTimes(1);
    expect(recommendWheregoDestination).toHaveBeenCalledTimes(1);
  });

  it('runs the first daily recommendation without showing an ad and spaces the share action', async () => {
    jest.mocked(prepareWheregoCandidates).mockResolvedValue({ creditSource: 'base', adFree: true, usage: usedDailyUsage } as never);
    await openApp();
    await answerQuestions();
    await press('오늘 첫 추천 무료로 보기');

    expect(mockShowAd).not.toHaveBeenCalled();
    expect(mockLoadAd).not.toHaveBeenCalled();
    expect(recommendWheregoDestination).toHaveBeenCalledTimes(1);
    const shareButton = renderer.root.findAll(node => node.props.label === '친구에게 여기 어때?')[0];
    if (!shareButton) throw new Error('Missing share button');
    expect(StyleSheet.flatten(shareButton.props.viewStyle).marginTop).toBe(16);
    const note = renderer.root.findAll(node => node.props.children === '장소 이름과 주소만 공유해요.' && node.props.numberOfLines === 1)[0];
    if (!note) throw new Error('Missing one-line share disclosure');
    expect(note.props.adjustsFontSizeToFit).toBe(true);
  });

  it('uses one rewarded ad for one new result without a second interstitial', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    jest.mocked(grantWheregoReward).mockResolvedValue({ ...usedDailyUsage, remaining: 1, dailyRemaining: 1, adRewardsUsed: 21, adCreditsRemaining: 1 });
    jest.mocked(prepareWheregoCandidates).mockResolvedValue({ creditSource: 'ad', adFree: false, usage: { ...usedDailyUsage, adRewardsUsed: 21 } } as never);
    await openApp();
    expect(mockLoadAd).not.toHaveBeenCalled();
    await answerQuestions();
    expect(mockShowAd).not.toHaveBeenCalled();
    expect(prepareWheregoCandidates).toHaveBeenCalledWith(expect.objectContaining({ previewOnly: true }));
    await press('광고 보고 추천받기');
    await act(async () => { mockAdEvents.onEvent({ type: 'userEarnedReward' }); });
    expect(recommendWheregoDestination).toHaveBeenCalledTimes(1);
    expect(renderer.root.findAll(node => node.props.label === '친구에게 여기 어때?')).toHaveLength(0);
    await act(async () => { mockAdEvents.onEvent({ type: 'dismissed' }); });
    expect(renderer.root.findAll(node => node.props.label === '친구에게 여기 어때?')).toHaveLength(1);

    expect(grantWheregoReward).toHaveBeenCalledTimes(1);
    expect(mockShowAd).toHaveBeenCalledTimes(1);
    expect(recommendWheregoDestination).toHaveBeenCalledTimes(1);
  });

  it('does not grant credit or call AI when a rewarded ad closes before earning its reward', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    await openApp();
    await answerQuestions();
    await press('광고 보고 추천받기');
    await act(async () => { mockAdEvents.onEvent({ type: 'dismissed' }); });
    await act(async () => { mockAdEvents.onEvent({ type: 'userEarnedReward' }); });
    expect(grantWheregoReward).not.toHaveBeenCalled();
    expect(prepareWheregoSelection).not.toHaveBeenCalled();
    expect(recommendWheregoDestination).not.toHaveBeenCalled();
  });

  it('ignores duplicate reward and dismissal callbacks', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    jest.mocked(grantWheregoReward).mockResolvedValue({ ...usedDailyUsage, remaining: 1, dailyRemaining: 1, adCreditsRemaining: 1 });
    await openApp();
    await answerQuestions();
    await press('광고 보고 추천받기');
    const events = mockAdEvents;
    await act(async () => {
      events.onEvent({ type: 'userEarnedReward' });
      events.onEvent({ type: 'userEarnedReward' });
    });
    await act(async () => {
      events.onEvent({ type: 'dismissed' });
      events.onEvent({ type: 'dismissed' });
      events.onEvent({ type: 'userEarnedReward' });
    });
    expect(grantWheregoReward).toHaveBeenCalledTimes(1);
    expect(recommendWheregoDestination).toHaveBeenCalledTimes(1);
  });

  it('lets a failed ad retry but never accepts reward callbacks from that failed attempt', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    await openApp();
    await answerQuestions();
    await press('광고 보고 추천받기');
    const failedEvents = mockAdEvents;
    await act(async () => { failedEvents.onEvent({ type: 'failedToShow' }); });
    await press('광고 다시 준비하기');
    await press('광고 보고 추천받기');
    await act(async () => {
      failedEvents.onEvent({ type: 'userEarnedReward' });
      failedEvents.onEvent({ type: 'dismissed' });
    });
    expect(mockShowAd).toHaveBeenCalledTimes(2);
    expect(grantWheregoReward).not.toHaveBeenCalled();
    expect(recommendWheregoDestination).not.toHaveBeenCalled();
  });

  it('keeps all six answers when candidate reservation needs another ad credit', async () => {
    jest.mocked(prepareWheregoCandidates)
      .mockRejectedValueOnce(new WheregoApiError('추가 광고 필요', 429, 'wherego_daily_limit_reached', usedDailyUsage))
      .mockResolvedValue({ creditSource: 'ad', adFree: false, usage: usedDailyUsage } as never);
    jest.mocked(grantWheregoReward).mockResolvedValue({ ...usedDailyUsage, remaining: 1, dailyRemaining: 1, adCreditsRemaining: 1 });
    await openApp();
    await answerQuestions();
    await press('광고 보고 추천받기');
    await act(async () => { mockAdEvents.onEvent({ type: 'userEarnedReward' }); });
    await act(async () => { mockAdEvents.onEvent({ type: 'dismissed' }); });

    expect(recommendWheregoDestination).toHaveBeenCalledTimes(1);
    const call = jest.mocked(recommendWheregoDestination).mock.calls[0];
    if (!call) throw new Error('Missing recommendation request');
    expect(call[0].answers).toHaveLength(6);
    expect(mockShowAd).toHaveBeenCalledTimes(1);
  });

  it('waits for server reward credit before starting AI, even when the ad has closed', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    let grantCredit: (usage: WheregoUsage) => void = () => { throw new Error('Missing reward request'); };
    jest.mocked(grantWheregoReward).mockImplementationOnce(() => new Promise(resolve => { grantCredit = resolve; }));
    await openApp();
    await answerQuestions();
    await press('광고 보고 추천받기');
    await act(async () => { mockAdEvents.onEvent({ type: 'userEarnedReward' }); });
    await act(async () => { mockAdEvents.onEvent({ type: 'dismissed' }); });
    expect(prepareWheregoSelection).not.toHaveBeenCalled();
    expect(recommendWheregoDestination).not.toHaveBeenCalled();
    await act(async () => { grantCredit({ ...usedDailyUsage, remaining: 1, adCreditsRemaining: 1 }); });
    expect(recommendWheregoDestination).toHaveBeenCalledTimes(1);
    expect(renderer.root.findAll(node => node.props.label === '친구에게 여기 어때?')).toHaveLength(1);
  });

  it('never calls AI when server reward credit fails', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    jest.mocked(grantWheregoReward).mockRejectedValueOnce(new Error('보상 반영 실패'));
    await openApp();
    await answerQuestions();
    await press('광고 보고 추천받기');
    await act(async () => { mockAdEvents.onEvent({ type: 'userEarnedReward' }); });
    await act(async () => { mockAdEvents.onEvent({ type: 'dismissed' }); });
    expect(prepareWheregoSelection).not.toHaveBeenCalled();
    expect(recommendWheregoDestination).not.toHaveBeenCalled();
  });

  it('retries an AI failure with the earned credit and no second ad', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    jest.mocked(recommendWheregoDestination).mockRejectedValueOnce(new Error('AI 일시 오류'));
    await openApp();
    await answerQuestions();
    await press('광고 보고 추천받기');
    await act(async () => { mockAdEvents.onEvent({ type: 'userEarnedReward' }); });
    await act(async () => { mockAdEvents.onEvent({ type: 'dismissed' }); });
    await press('추천 다시 시도');
    expect(recommendWheregoDestination).toHaveBeenCalledTimes(2);
    expect(mockShowAd).toHaveBeenCalledTimes(1);
    expect(grantWheregoReward).toHaveBeenCalledTimes(1);
    expect(jest.mocked(recommendWheregoDestination).mock.calls[1]?.[0].answers).toHaveLength(6);
  });

  it('does not start AI for a credit response that arrives after returning home', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    let grantCredit: (usage: WheregoUsage) => void = () => { throw new Error('Missing reward request'); };
    jest.mocked(grantWheregoReward).mockImplementationOnce(() => new Promise(resolve => { grantCredit = resolve; }));
    await openApp();
    await answerQuestions();
    await press('광고 보고 추천받기');
    await act(async () => { mockAdEvents.onEvent({ type: 'userEarnedReward' }); });
    const back = mockBackEvent.addEventListener.mock.calls.at(-1)?.[0];
    await act(async () => { back(); });
    await act(async () => { grantCredit({ ...usedDailyUsage, remaining: 1, adCreditsRemaining: 1 }); });
    expect(prepareWheregoSelection).not.toHaveBeenCalled();
    expect(recommendWheregoDestination).not.toHaveBeenCalled();
    expect(renderer.root.findAll(node => node.props.label === 'AI 추천 시작하기')).toHaveLength(1);
  });

  it('refreshes a stale finite ad cap without losing the selected answers', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValueOnce({ ...usedDailyUsage, adRewardsUsed: 2, adRewardsLimit: 2 })
      .mockResolvedValue({ ...usedDailyUsage, adRewardsUsed: 2 });
    await openApp();
    await answerQuestions();
    expect(mockShowAd).not.toHaveBeenCalled();
    await press('최신 추천 횟수 확인');
    await press('광고 보고 추천받기');
    await act(async () => { mockAdEvents.onEvent({ type: 'userEarnedReward' }); });
    await act(async () => { mockAdEvents.onEvent({ type: 'dismissed' }); });
    expect(recommendWheregoDestination).toHaveBeenCalledTimes(1);
    expect(jest.mocked(recommendWheregoDestination).mock.calls[0]?.[0].answers).toHaveLength(6);
  });

  it('ignores an AI result that finishes after the user returns home', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    let finishRecommendation: (value: unknown) => void = () => { throw new Error('Missing AI request'); };
    jest.mocked(recommendWheregoDestination).mockImplementationOnce(() => new Promise(resolve => { finishRecommendation = resolve as (value: unknown) => void; }));
    await openApp();
    await answerQuestions();
    await press('광고 보고 추천받기');
    await act(async () => { mockAdEvents.onEvent({ type: 'userEarnedReward' }); });
    const back = mockBackEvent.addEventListener.mock.calls.at(-1)?.[0];
    await act(async () => { back(); });
    await act(async () => { mockAdEvents.onEvent({ type: 'dismissed' }); });
    await act(async () => { finishRecommendation({ personaTitle: '늦은 결과', oneLine: '늦은 결과', recommendedPlaces: [] }); });
    expect(renderer.root.findAll(node => node.props.label === '친구에게 여기 어때?')).toHaveLength(0);
    expect(renderer.root.findAll(node => node.props.label === 'AI 추천 시작하기')).toHaveLength(1);
  });

  it('prepares privately at 20 seconds after impression once, then retrieves after reward and shows after close', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    await openApp();
    await answerQuestions();
    expect(prepareWheregoCandidates).toHaveBeenCalledWith(expect.objectContaining({ previewOnly: true }));
    await press('광고 보고 추천받기');
    await act(async () => { mockAdEvents.onEvent({ type: 'impression' }); });
    await act(async () => { jest.advanceTimersByTime(19000); });
    expect(prepareWheregoSelection).not.toHaveBeenCalled();
    await act(async () => { mockAdEvents.onEvent({ type: 'impression' }); jest.advanceTimersByTime(1000); });
    expect(prepareWheregoSelection).toHaveBeenCalledTimes(1);
    expect(jest.mocked(prepareWheregoSelection).mock.calls[0]?.[0].answers).toHaveLength(6);
    expect(grantWheregoReward).not.toHaveBeenCalled();
    expect(recommendWheregoDestination).not.toHaveBeenCalled();
    expect(renderer.root.findAll(node => node.props.label === '친구에게 여기 어때?')).toHaveLength(0);
    await act(async () => { mockAdEvents.onEvent({ type: 'userEarnedReward' }); });
    expect(recommendWheregoDestination).toHaveBeenCalledTimes(1);
    expect(renderer.root.findAll(node => node.props.label === '친구에게 여기 어때?')).toHaveLength(0);
    await act(async () => { mockAdEvents.onEvent({ type: 'dismissed' }); jest.advanceTimersByTime(30000); });
    expect(renderer.root.findAll(node => node.props.label === '친구에게 여기 어때?')).toHaveLength(1);
    expect(prepareWheregoSelection).toHaveBeenCalledTimes(1);
    expect(recommendWheregoDestination).toHaveBeenCalledTimes(1);
  });

  it('a short rewarded ad starts immediately after credit without waiting 20 seconds', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    await openApp();
    await answerQuestions();
    await press('광고 보고 추천받기');
    await act(async () => { mockAdEvents.onEvent({ type: 'impression' }); jest.advanceTimersByTime(5000); });
    await act(async () => { mockAdEvents.onEvent({ type: 'userEarnedReward' }); });
    expect(recommendWheregoDestination).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(30000); });
    expect(prepareWheregoSelection).not.toHaveBeenCalled();
  });

  it.each(['dismissed', 'failedToShow', 'error', 'home', 'unmount'])('cancels the 20-second preparation on %s', async outcome => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    await openApp();
    await answerQuestions();
    await press('광고 보고 추천받기');
    await act(async () => { mockAdEvents.onEvent({ type: 'impression' }); jest.advanceTimersByTime(19000); });
    await act(async () => {
      if (outcome === 'error') mockAdEvents.onError(new Error('synthetic-ad-error'));
      else if (outcome === 'home') mockBackEvent.addEventListener.mock.calls.at(-1)?.[0]();
      else if (outcome === 'unmount') renderer.unmount();
      else mockAdEvents.onEvent({ type: outcome });
    });
    await act(async () => { jest.advanceTimersByTime(30000); });
    expect(prepareWheregoSelection).not.toHaveBeenCalled();
    expect(recommendWheregoDestination).not.toHaveBeenCalled();
    expect(grantWheregoReward).not.toHaveBeenCalled();
  });

  it('does not start speculative AI if the ad closes while public candidates are still loading', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    let finishCandidates: (value: never) => void = () => { throw new Error('Missing candidate request'); };
    jest.mocked(prepareWheregoCandidates).mockImplementationOnce(() => new Promise(resolve => { finishCandidates = resolve; }));
    await openApp();
    await answerQuestions();
    await press('광고 보고 추천받기');
    await act(async () => { mockAdEvents.onEvent({ type: 'impression' }); jest.advanceTimersByTime(20000); });
    await act(async () => { mockAdEvents.onEvent({ type: 'dismissed' }); });
    await act(async () => { finishCandidates({ candidates: [] } as never); });
    expect(prepareWheregoSelection).not.toHaveBeenCalled();
    expect(recommendWheregoDestination).not.toHaveBeenCalled();
  });

  it('falls back to credited AI if speculative preparation is unavailable', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    jest.mocked(prepareWheregoSelection).mockRejectedValueOnce(new WheregoApiError('synthetic-unavailable', 503));
    await openApp();
    await answerQuestions();
    await press('광고 보고 추천받기');
    await act(async () => { mockAdEvents.onEvent({ type: 'impression' }); jest.advanceTimersByTime(20000); });
    expect(recommendWheregoDestination).not.toHaveBeenCalled();
    await act(async () => { mockAdEvents.onEvent({ type: 'userEarnedReward' }); mockAdEvents.onEvent({ type: 'dismissed' }); });
    expect(recommendWheregoDestination).toHaveBeenCalledTimes(1);
    expect(renderer.root.findAll(node => node.props.label === '친구에게 여기 어때?')).toHaveLength(1);
  });

  it('joins the pending preparation acknowledgement instead of racing a second selection', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    let acknowledge: (value: { status: 'preparing' }) => void = () => { throw new Error('Missing preparation request'); };
    jest.mocked(prepareWheregoSelection).mockImplementationOnce(() => new Promise(resolve => { acknowledge = resolve; }));
    await openApp();
    await answerQuestions();
    await press('광고 보고 추천받기');
    await act(async () => { mockAdEvents.onEvent({ type: 'impression' }); jest.advanceTimersByTime(20000); });
    await act(async () => { mockAdEvents.onEvent({ type: 'userEarnedReward' }); mockAdEvents.onEvent({ type: 'dismissed' }); });
    expect(recommendWheregoDestination).not.toHaveBeenCalled();
    await act(async () => { acknowledge({ status: 'preparing' }); });
    expect(recommendWheregoDestination).toHaveBeenCalledTimes(1);
    expect(prepareWheregoSelection).toHaveBeenCalledTimes(1);
  });

  it('never retrieves a privately prepared result when server credit fails', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    jest.mocked(grantWheregoReward).mockRejectedValueOnce(new Error('synthetic-credit-failure'));
    await openApp();
    await answerQuestions();
    await press('광고 보고 추천받기');
    await act(async () => { mockAdEvents.onEvent({ type: 'impression' }); jest.advanceTimersByTime(20000); });
    await act(async () => { mockAdEvents.onEvent({ type: 'userEarnedReward' }); mockAdEvents.onEvent({ type: 'dismissed' }); });
    expect(prepareWheregoSelection).toHaveBeenCalledTimes(1);
    expect(recommendWheregoDestination).not.toHaveBeenCalled();
    expect(renderer.root.findAll(node => node.props.label === '친구에게 여기 어때?')).toHaveLength(0);
  });

  it('reuses the private preparation after a later rewarded ad rather than spending AI twice', async () => {
    jest.mocked(fetchWheregoUsage).mockResolvedValue(usedDailyUsage);
    await openApp();
    await answerQuestions();
    await press('광고 보고 추천받기');
    await act(async () => { mockAdEvents.onEvent({ type: 'impression' }); jest.advanceTimersByTime(20000); });
    await act(async () => { mockAdEvents.onEvent({ type: 'dismissed' }); });
    await press('광고 보고 추천받기');
    await act(async () => { mockAdEvents.onEvent({ type: 'impression' }); jest.advanceTimersByTime(20000); });
    await act(async () => { mockAdEvents.onEvent({ type: 'userEarnedReward' }); mockAdEvents.onEvent({ type: 'dismissed' }); });
    expect(prepareWheregoSelection).toHaveBeenCalledTimes(1);
    expect(recommendWheregoDestination).toHaveBeenCalledTimes(1);
    expect(prepareWheregoCandidates).toHaveBeenCalledTimes(1);
  });
});
