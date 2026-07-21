import { Storage } from '@apps-in-toss/framework';

import { WHEREGO_RESULT_PROMOTION_CODE } from '../config';
import { WheregoApiError, type WheregoPromotionGrantResult } from '../api/wheregoApi';

export type ResultPromotionOutcome =
  | { status: 'idle' | 'loading' | 'success' | 'alreadyGranted' | 'unsupported' }
  | { status: 'error'; errorCode?: string; retryable: boolean };

type ResultPromotionGrant = () => Promise<WheregoPromotionGrantResult>;

const RESULT_PROMOTION_STORAGE_KEY =
  `wherego.result-promotion.${WHEREGO_RESULT_PROMOTION_CODE}.v1`;
const RESULT_PROMOTION_ATTEMPTED_VALUE = 'attempted';

let promotionGrantInFlight: Promise<ResultPromotionOutcome> | null = null;

async function grantResultViewPromotionOnce(
  grant: ResultPromotionGrant,
): Promise<ResultPromotionOutcome> {
  const previousGrant = await Storage.getItem(RESULT_PROMOTION_STORAGE_KEY);
  if (previousGrant) {
    return { status: 'alreadyGranted' };
  }

  // Persist the one-time guard before opening Toss's confirmation screen. The app can
  // be suspended before the SDK promise resolves, so saving only after success is unsafe.
  await Storage.setItem(RESULT_PROMOTION_STORAGE_KEY, RESULT_PROMOTION_ATTEMPTED_VALUE);

  try {
    const result = await grant();
    if (result.status === 'alreadyGranted') {
      return { status: 'alreadyGranted' };
    }
    await Storage.setItem(RESULT_PROMOTION_STORAGE_KEY, result.key);
    return { status: 'success' };
  } catch (error) {
    const retryable = error instanceof WheregoApiError && error.status === 503;
    if (retryable) {
      await Storage.removeItem(RESULT_PROMOTION_STORAGE_KEY);
    }
    console.error('[wherego:result-promotion] server grant failed', error);
    return {
      status: 'error',
      errorCode: error instanceof WheregoApiError ? error.code : 'UNEXPECTED',
      retryable,
    };
  }
}

export function grantResultViewPromotion(
  grant: ResultPromotionGrant,
): Promise<ResultPromotionOutcome> {
  if (promotionGrantInFlight) {
    return promotionGrantInFlight;
  }

  promotionGrantInFlight = grantResultViewPromotionOnce(grant).finally(() => {
    promotionGrantInFlight = null;
  });
  return promotionGrantInFlight;
}
