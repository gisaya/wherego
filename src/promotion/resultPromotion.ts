import { grantPromotionReward, Storage } from '@apps-in-toss/framework';

import {
  WHEREGO_RESULT_PROMOTION_AMOUNT,
  WHEREGO_RESULT_PROMOTION_CODE,
} from '../config';

export type ResultPromotionOutcome =
  | { status: 'idle' | 'loading' | 'success' | 'alreadyGranted' | 'unsupported' }
  | { status: 'error'; errorCode?: string };

const RESULT_PROMOTION_STORAGE_KEY =
  `wherego.result-promotion.${WHEREGO_RESULT_PROMOTION_CODE}.v1`;

export async function grantResultViewPromotion(): Promise<ResultPromotionOutcome> {
  const previousGrant = await Storage.getItem(RESULT_PROMOTION_STORAGE_KEY);
  if (previousGrant) {
    return { status: 'alreadyGranted' };
  }

  const result = await grantPromotionReward({
    params: {
      amount: WHEREGO_RESULT_PROMOTION_AMOUNT,
      promotionCode: WHEREGO_RESULT_PROMOTION_CODE,
    },
  });

  if (result == null) {
    return { status: 'unsupported' };
  }
  if (result === 'ERROR') {
    return { status: 'error' };
  }
  if ('errorCode' in result) {
    console.warn('[wherego:result-promotion] rejected', { errorCode: result.errorCode });
    return { status: 'error', errorCode: result.errorCode };
  }

  await Storage.setItem(RESULT_PROMOTION_STORAGE_KEY, result.key);
  return { status: 'success' };
}
