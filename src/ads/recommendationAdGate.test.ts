import { adRewardLimitReached, advanceAdGate, initialAdGate, recommendationUsageLabel, resultAccessForReservation, type AdGateEvent } from './recommendationAdGate';
import type { WheregoUsage } from '../api/wheregoApi';

describe('AI recommendation ad gate', () => {
  it('uses the server reservation to bypass the ad only for the daily free or paid result', () => {
    expect(resultAccessForReservation({ adFree: true, creditSource: 'base' })).toBe('free');
    expect(resultAccessForReservation({ adFree: false, creditSource: 'base' })).toBe('ad');
    expect(resultAccessForReservation({ creditSource: 'paid' })).toBe('paid');
    expect(resultAccessForReservation({ creditSource: 'ad', adFree: false })).toBe('rewarded');
    expect(resultAccessForReservation({ creditSource: 'share' })).toBe('ad');
    expect(resultAccessForReservation({})).toBe('ad');
  });
  const run = (events: AdGateEvent[]) => events.reduce(advanceAdGate, initialAdGate());
  it('requires both an impression and dismissal', () => {
    expect(run(['show']).allowed).toBe(false);
    expect(run(['show', 'impression']).allowed).toBe(false);
    expect(run(['show', 'dismissed']).allowed).toBe(false);
    expect(run(['impression', 'dismissed']).allowed).toBe(true);
  });
  it.each<AdGateEvent>(['failedToShow', 'error', 'timeout'])('does not grant AI access on %s', event => {
    expect(run([event]).allowed).toBe(false);
    expect(run(['impression', event]).allowed).toBe(false);
    expect(run([event, 'impression', 'dismissed']).allowed).toBe(false);
  });
  it('ignores late callbacks and grants at most one terminal transition', () => {
    const completed = run(['impression', 'dismissed']);
    expect(advanceAdGate(completed, 'error')).toBe(completed);
    expect(advanceAdGate(completed, 'dismissed')).toBe(completed);
  });
  it('does not treat an uncapped reward limit as zero', () => {
    expect(adRewardLimitReached({ adRewardsUsed: 25, adRewardsLimit: null })).toBe(false);
    expect(adRewardLimitReached({ adRewardsUsed: 2, adRewardsLimit: 2 })).toBe(true);
    expect(adRewardLimitReached({ adRewardsUsed: 1, adRewardsLimit: 2 })).toBe(false);
    expect(adRewardLimitReached(null)).toBe(false);
  });
  it('describes the free first result and continued ad access without a daily remaining limit', () => {
    const usage: WheregoUsage = {
      date: '2026-10-01', remaining: 1, dailyRemaining: 1, baseDailyLimit: 1,
      baseUsed: 0, baseRemaining: 1, adRewardsUsed: 0, adRewardsLimit: null,
      adCreditsRemaining: 0, shareRewardUsed: false, shareCreditsRemaining: 0,
      paidCreditsRemaining: 0, nextResetAt: '2026-10-02T00:00:00+09:00', limitEnabled: true,
    };
    expect(recommendationUsageLabel(usage, false)).toBe('오늘 첫 추천은 광고 없이');
    const exhausted = { ...usage, remaining: 0, dailyRemaining: 0, baseUsed: 1, baseRemaining: 0 };
    expect(recommendationUsageLabel(exhausted, false)).toBe('광고 보고 횟수 제한 없이 추천');
    expect(recommendationUsageLabel({ ...exhausted, remaining: 1, adCreditsRemaining: 1 }, false)).toBe('광고 확인 완료 · 추천 바로 시작');
    expect(recommendationUsageLabel({ ...exhausted, remaining: 3, paidCreditsRemaining: 3 }, false)).toBe('이용권 3회 · 광고 없이 추천');
    expect(recommendationUsageLabel(null, true)).toBe('추천 준비 중');
    expect(recommendationUsageLabel({ ...exhausted, adRewardsLimit: 2 }, false)).toBe('광고 보고 계속 추천받아요');
  });
});
