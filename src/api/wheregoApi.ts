import { API_BASE_URL } from '../config';

const QUESTION_SET_TIMEOUT_MS = 8000;
const CANDIDATE_SET_TIMEOUT_MS = 25000;
const RECOMMENDATION_TIMEOUT_MS = 45000;
const USAGE_TIMEOUT_MS = 8000;
const IAP_TIMEOUT_MS = 20000;
const LOGIN_TIMEOUT_MS = 15000;
const PROMOTION_TIMEOUT_MS = 25000;

export type WheregoCreditSource = 'base' | 'ad' | 'share' | 'paid';

export type WheregoUsage = {
  date: string;
  remaining: number;
  dailyRemaining?: number;
  baseDailyLimit: number;
  baseUsed: number;
  baseRemaining: number;
  adRewardsUsed: number;
  adRewardsLimit: number | null;
  adCreditsRemaining: number;
  shareRewardUsed: boolean;
  shareCreditsRemaining: number;
  paidCreditsRemaining?: number;
  nextResetAt: string;
  limitEnabled: boolean;
};

export type WheregoIapProductConfig = {
  sku: string;
  credits: number;
};

export type WheregoIapConfig = {
  enabled: boolean;
  restorationEnabled?: boolean;
  products: WheregoIapProductConfig[];
};

export type WheregoLoginSession = {
  sessionToken: string;
  anonymousUserKey: string;
  expiresAt: string;
  usage?: WheregoUsage | null;
};

export type WheregoRecommendOrigin = {
  type: 'current_location' | 'selected_region';
  label: string;
  description: string;
  lat: number;
  lng: number;
  areaCodes: string[];
  lDongRegnCodes?: string[];
  accuracy?: number;
};

export type WheregoRecommendAnswer = {
  questionId: string;
  questionType: 'source' | 'general';
  question: string;
  answer: string;
  caption: string;
  tags: string[];
  searchHints: string[];
  constraints: Record<string, boolean | number | string | string[]>;
};

export type WheregoQuestionOption = {
  key?: string;
  label: string;
  caption: string;
  tags?: string[];
  searchHints?: string[];
  constraints?: Record<string, boolean | number | string | string[]>;
};

export type WheregoQuestion = {
  type: 'source' | 'general';
  id: string;
  eyebrow: string;
  question: string;
  subcopy: string;
  layout: 'two' | 'four';
  tags?: string[];
  options: WheregoQuestionOption[];
};

export type WheregoQuestionSet = {
  version?: string;
  questionSetId?: string;
  totalQuestionCount?: number;
  questions: WheregoQuestion[];
  source?: {
    planner?: string;
    requiredSourceAxes?: number;
    generalQuestionCount?: number;
  };
};

export type WheregoRecommendedPlace = {
  contentId?: string;
  selectionRank?: number | null;
  title: string;
  address: string;
  region?: string;
  overview?: string;
  imageUrl?: string;
  imageCopyrightType?: string;
  imageAttribution?: string;
  source?: 'kto' | 'gemini';
  ktoVerified?: boolean;
  imagePlaceholderTheme?: 'coast' | 'nature' | 'culture' | 'outdoor';
  imagePlaceholderThemeV2?:
    | 'coast'
    | 'nature'
    | 'culture'
    | 'outdoor'
    | 'waterside'
    | 'garden'
    | 'heritage'
    | 'indoor'
    | 'wellness'
    | 'activity';
  matchedKeyword?: string;
  aiReason?: string;
  whyThisPlace?: string[];
  intro?: {
    infoCenter?: string;
    restDate?: string;
    useTime?: string;
    parking?: string;
    babyCarriage?: string;
    pet?: string;
  };
  crowd?: {
    regionName?: string;
    latestBaseYmd?: string | null;
    metric?: string;
    latestVisitorCount?: number | null;
    baselineVisitorCount?: number | null;
    ratio?: number | null;
    label?: string;
  };
  straightDistanceKm?: number | null;
  estimatedRoadDistanceKm?: number | null;
  estimatedOneWayDriveMinutes?: number | null;
  estimatedRoundTripDriveMinutes?: number | null;
  mapX?: number | null;
  mapY?: number | null;
  mapLink?: string;
};

export type WheregoRecommendation = {
  personaTitle: string;
  personaSummary?: string;
  oneLine: string;
  aiDecision?: {
    mainFactors?: string[];
    tradeoff?: string;
    crowdNote?: string;
  };
  recommendedPlaces: WheregoRecommendedPlace[];
  shareText?: string;
  source?: {
    planner?: string;
    curator?: string;
    model?: string;
    kto?: string;
    crowd?: string;
    timingsMs?: {
      selection?: number;
      detail?: number;
      total?: number;
    };
  };
  searchPlan?: {
    keywords?: string[];
    areaCodes?: string[];
    regionCodeType?: 'ldong';
    areaScope?: string;
    contentTypeIds?: string[];
    intents?: Array<{
      keyword: string;
      contentTypeId: string;
      operation: string;
      weight: number;
    }>;
    rankingNotes?: string[];
  };
  creditSource?: WheregoCreditSource;
  adFree?: boolean;
  usage?: WheregoUsage;
};

export type WheregoCandidateSet = {
  version?: string;
  preparedAt?: string;
  plan?: Record<string, unknown>;
  candidates: Record<string, unknown>[];
  candidateCount?: number;
  narrowedCandidateCount?: number;
  compressedCandidateCount?: number;
  source?: {
    planner?: string;
    kto?: string;
    crowd?: string;
    answerCount?: number;
    aiUsed?: boolean;
    timingsMs?: {
      search?: number;
      enrich?: number;
      total?: number;
    };
  };
  creditSource?: WheregoCreditSource;
  adFree?: boolean;
  usage?: WheregoUsage;
};

export class WheregoApiError extends Error {
  status?: number;
  code?: string;
  usage?: WheregoUsage;

  constructor(message: string, status?: number, code?: string, usage?: WheregoUsage) {
    super(message);
    this.name = 'WheregoApiError';
    this.status = status;
    this.code = code;
    this.usage = usage;
  }
}

export async function fetchWheregoUsage(params: {
  anonymousUserKey?: string | null;
  loginSessionToken?: string | null;
  sessionId?: string;
}): Promise<WheregoUsage> {
  const body = await postUsage('/api/wherego/usage', {
    anonymousUserKey: params.anonymousUserKey || undefined,
    loginSessionToken: params.loginSessionToken || undefined,
    sessionId: params.sessionId,
  });
  return body.usage;
}

export async function grantWheregoReward(params: {
  anonymousUserKey?: string | null;
  loginSessionToken?: string | null;
  sessionId?: string;
  source: 'ad' | 'share';
  grantId: string;
}): Promise<WheregoUsage> {
  const body = await postUsage('/api/wherego/usage/reward', {
    anonymousUserKey: params.anonymousUserKey || undefined,
    loginSessionToken: params.loginSessionToken || undefined,
    sessionId: params.sessionId,
    source: params.source,
    grantId: params.grantId,
  });
  return body.usage;
}

export async function linkWheregoGuestUsage(params: {
  guestAnonymousUserKey: string;
  loginSessionToken: string;
}): Promise<WheregoUsage> {
  const body = await postUsage('/api/wherego/usage/link', {
    guestAnonymousUserKey: params.guestAnonymousUserKey,
    loginSessionToken: params.loginSessionToken,
  });
  return body.usage;
}

export type WheregoPromotionGrantResult =
  | { status: 'success'; key: string }
  | { status: 'alreadyGranted' };

export async function grantWheregoResultPromotion(params: {
  anonymousUserKey: string;
  promotionCode: string;
}): Promise<WheregoPromotionGrantResult> {
  return postWherego(
    '/api/wherego/promotion/grant',
    {
      anonymousUserKey: params.anonymousUserKey,
      promotionCode: params.promotionCode,
    },
    PROMOTION_TIMEOUT_MS,
  );
}

export async function fetchWheregoIapConfig(): Promise<WheregoIapConfig> {
  return postWherego<WheregoIapConfig>('/api/wherego/iap/products', {}, IAP_TIMEOUT_MS);
}

export async function exchangeWheregoTossLogin(params: {
  authorizationCode: string;
  referrer: 'DEFAULT' | 'SANDBOX';
  guestAnonymousUserKey?: string | null;
}): Promise<WheregoLoginSession> {
  return postWherego('/api/wherego/login/exchange', {
    authorizationCode: params.authorizationCode,
    referrer: params.referrer,
    guestAnonymousUserKey: params.guestAnonymousUserKey || undefined,
  }, LOGIN_TIMEOUT_MS);
}

export async function grantWheregoIapPurchase(params: {
  anonymousUserKey?: string | null;
  loginSessionToken: string;
  orderId: string;
  sku: string;
}): Promise<{ usage: WheregoUsage; grantedCredits: number }> {
  return postWherego('/api/wherego/iap/grant', {
    anonymousUserKey: params.anonymousUserKey || undefined,
    loginSessionToken: params.loginSessionToken,
    orderId: params.orderId,
    sku: params.sku,
  }, IAP_TIMEOUT_MS);
}

export async function reconcileWheregoIapPurchase(params: {
  anonymousUserKey?: string | null;
  loginSessionToken: string;
  orderId: string;
  sku: string;
}): Promise<{ usage: WheregoUsage; status: string }> {
  return postWherego('/api/wherego/iap/reconcile', {
    anonymousUserKey: params.anonymousUserKey || undefined,
    loginSessionToken: params.loginSessionToken,
    orderId: params.orderId,
    sku: params.sku,
  }, IAP_TIMEOUT_MS);
}

export async function fetchWheregoQuestionSet(params: {
  origin: WheregoRecommendOrigin;
}): Promise<WheregoQuestionSet> {
  return postWherego('/api/wherego/questions', {
    origin: params.origin,
    questionCount: 6,
  }, QUESTION_SET_TIMEOUT_MS, '질문 세트 응답이 지연되고 있어요.');
}

export async function prepareWheregoCandidates(params: {
  origin: WheregoRecommendOrigin;
  answers: WheregoRecommendAnswer[];
  sessionId?: string;
  anonymousUserKey?: string | null;
  loginSessionToken?: string | null;
  previewOnly?: boolean;
}): Promise<WheregoCandidateSet> {
  return postWherego('/api/wherego/candidates', {
    origin: params.origin,
    answers: params.answers,
    sessionId: params.sessionId,
    anonymousUserKey: params.anonymousUserKey || undefined,
    loginSessionToken: params.loginSessionToken || undefined,
    previewOnly: params.previewOnly === true,
  }, CANDIDATE_SET_TIMEOUT_MS, '관광지 후보 준비가 지연되고 있어요.');
}

export async function prepareWheregoSelection(params: {
  origin: WheregoRecommendOrigin;
  answers: WheregoRecommendAnswer[];
  candidateSet: WheregoCandidateSet;
  sessionId: string;
  anonymousUserKey?: string | null;
  loginSessionToken?: string | null;
}): Promise<{ status: 'preparing' | 'deferred' }> {
  return postWherego('/api/wherego/prepare-selection', {
    ...params,
    anonymousUserKey: params.anonymousUserKey || undefined,
    loginSessionToken: params.loginSessionToken || undefined,
  });
}

export async function recommendWheregoDestination(params: {
  origin: WheregoRecommendOrigin;
  answers: WheregoRecommendAnswer[];
  candidateSet?: WheregoCandidateSet | null;
  sessionId?: string;
  anonymousUserKey?: string | null;
  loginSessionToken?: string | null;
}): Promise<WheregoRecommendation> {
  return postWherego('/api/wherego/recommend', {
    origin: params.origin,
    answers: params.answers,
    limit: 1,
    candidateSet: params.candidateSet || undefined,
    sessionId: params.sessionId,
    anonymousUserKey: params.anonymousUserKey || undefined,
    loginSessionToken: params.loginSessionToken || undefined,
  }, RECOMMENDATION_TIMEOUT_MS, '추천 서버 응답이 지연되고 있어요.');
}

async function parseApiError(response: Response): Promise<WheregoApiError> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') {
      return new WheregoApiError(body.detail, response.status);
    }

    if (body.detail != null && typeof body.detail === 'object') {
      const detail = body.detail as { code?: string; message?: string; usage?: WheregoUsage };
      return new WheregoApiError(
        detail.message || '추천 결과를 불러오지 못했어요.',
        response.status,
        detail.code,
        detail.usage,
      );
    }
  } catch (_) {
    // Fall through to the generic message.
  }

  return new WheregoApiError('추천 결과를 불러오지 못했어요.', response.status);
}

async function postUsage(path: string, payload: Record<string, unknown>): Promise<{ usage: WheregoUsage }> {
  return postWherego(path, payload);
}

async function postWherego<T>(
  path: string,
  payload: Record<string, unknown>,
  timeoutMs = USAGE_TIMEOUT_MS,
  timeoutMessage = '추천 횟수 확인이 지연되고 있어요.',
): Promise<T> {
  const controller = typeof AbortController === 'function' ? new AbortController() : undefined;
  // RN and Node expose different ambient declarations for the same runtime signal.
  const signal = controller?.signal as NonNullable<Parameters<typeof fetch>[1]>['signal'];
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new WheregoApiError(timeoutMessage, 408));
      controller?.abort();
    }, timeoutMs);
  });

  // Keep the deadline active through error parsing and successful JSON decoding.
  const request = async () => {
    const response = await fetch(`${API_BASE_URL}${path}?usagePolicy=uncapped-v1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      ...(controller ? { signal } : {}),
    });
    if (!response.ok) throw await parseApiError(response);
    return (await response.json()) as T;
  };
  try {
    return await Promise.race([request(), timeoutPromise]);
  } finally {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
    }
  }
}
