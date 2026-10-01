import type { WheregoUsage } from '../api/wheregoApi';

export type AdGateState = { impression: boolean; finished: boolean; allowed: boolean };
export type AdGateEvent = 'show' | 'impression' | 'dismissed' | 'failedToShow' | 'error' | 'timeout';
export const initialAdGate = (): AdGateState => ({ impression: false, finished: false, allowed: false });

export function resultAccessForReservation(reservation: { adFree?: boolean; creditSource?: string }): 'free' | 'paid' | 'rewarded' | 'ad' {
  if (reservation.adFree === true) return 'free';
  if (reservation.creditSource === 'paid') return 'paid';
  if (reservation.creditSource === 'ad') return 'rewarded';
  return 'ad';
}

export function adRewardLimitReached(usage: Pick<WheregoUsage, 'adRewardsUsed' | 'adRewardsLimit'> | null): boolean {
  return usage != null && usage.adRewardsLimit != null && usage.adRewardsUsed >= usage.adRewardsLimit;
}

export function recommendationUsageLabel(usage: WheregoUsage | null, loading: boolean): string {
  if (loading) return '추천 준비 중';
  if (!usage || !usage.limitEnabled) return 'AI 추천 바로 시작';
  if (usage.baseRemaining > 0) return '오늘 첫 추천은 광고 없이';
  if (usage.adCreditsRemaining > 0) return '광고 확인 완료 · 추천 바로 시작';
  if ((usage.dailyRemaining ?? usage.remaining) <= 0 && (usage.paidCreditsRemaining ?? 0) > 0) {
    return `이용권 ${usage.paidCreditsRemaining}회 · 광고 없이 추천`;
  }
  return usage.adRewardsLimit === null ? '광고 보고 횟수 제한 없이 추천' : '광고 보고 계속 추천받아요';
}

export function advanceAdGate(state: AdGateState, event: AdGateEvent): AdGateState {
  if (state.finished) return state;
  if (event === 'impression') return { ...state, impression: true };
  if (event === 'show') return state;
  return { ...state, finished: true, allowed: event === 'dismissed' && state.impression };
}
