import { grantPromotionReward, Storage } from '@apps-in-toss/framework';

import {
  WHEREGO_RESULT_PROMOTION_AMOUNT,
  WHEREGO_RESULT_PROMOTION_CODE,
} from '../config';

export type ResultPromotionOutcome =
  | { status: 'idle' | 'loading' | 'success' | 'alreadyGranted' | 'unsupported' }
  | { status: 'error'; errorCode?: string };

type ResultPromotionGuard = {
  reserve: () => Promise<boolean>;
  resolve: (granted: boolean) => Promise<void>;
};

const RESULT_PROMOTION_STORAGE_KEY =
  `wherego.result-promotion.${WHEREGO_RESULT_PROMOTION_CODE}.v1`;
const RESULT_PROMOTION_ATTEMPTED_VALUE = 'attempted';

let promotionGrantInFlight: Promise<ResultPromotionOutcome> | null = null;

async function grantResultViewPromotionOnce(
  guard?: ResultPromotionGuard,
): Promise<ResultPromotionOutcome> {
  const previousGrant = await Storage.getItem(RESULT_PROMOTION_STORAGE_KEY);
  if (previousGrant) {
    return { status: 'alreadyGranted' };
  }

  // Persist the one-time guard before opening Toss's confirmation screen. The app can
  // be suspended before the SDK promise resolves, so saving only after success is unsafe.
  await Storage.setItem(RESULT_PROMOTION_STORAGE_KEY, RESULT_PROMOTION_ATTEMPTED_VALUE);

  if (guard) {
    try {
      const shouldGrant = await guard.reserve();
      if (!shouldGrant) {
        return { status: 'alreadyGranted' };
      }
    } catch (error) {
      console.warn('[wherego:result-promotion] server guard unavailable', error);
    }
  }

  const result = await grantPromotionReward({
    params: {
      amount: WHEREGO_RESULT_PROMOTION_AMOUNT,
      promotionCode: WHEREGO_RESULT_PROMOTION_CODE,
    },
  });

  if (result == null) {
    await Storage.removeItem(RESULT_PROMOTION_STORAGE_KEY);
    await resolveGuard(guard, false);
    return { status: 'unsupported' };
  }
  if (result === 'ERROR') {
    await Storage.removeItem(RESULT_PROMOTION_STORAGE_KEY);
    await resolveGuard(guard, false);
    return { status: 'error' };
  }
  if ('errorCode' in result) {
    console.warn('[wherego:result-promotion] rejected', { errorCode: result.errorCode });
    await Storage.removeItem(RESULT_PROMOTION_STORAGE_KEY);
    await resolveGuard(guard, false);
    return { status: 'error', errorCode: result.errorCode };
  }

  await Storage.setItem(RESULT_PROMOTION_STORAGE_KEY, result.key);
  await resolveGuard(guard, true);
  return { status: 'success' };
}

export function grantResultViewPromotion(
  guard?: ResultPromotionGuard,
): Promise<ResultPromotionOutcome> {
  if (promotionGrantInFlight) {
    return promotionGrantInFlight;
  }

  promotionGrantInFlight = grantResultViewPromotionOnce(guard).finally(() => {
    promotionGrantInFlight = null;
  });
  return promotionGrantInFlight;
}

async function resolveGuard(guard: ResultPromotionGuard | undefined, granted: boolean) {
  try {
    await guard?.resolve(granted);
  } catch (error) {
    console.warn('[wherego:result-promotion] server guard update failed', error);
  }
}
