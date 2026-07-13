import { API_BASE_URL } from '../config';

const QUESTION_SET_TIMEOUT_MS = 8000;
const CANDIDATE_SET_TIMEOUT_MS = 25000;
const RECOMMENDATION_TIMEOUT_MS = 45000;
const USAGE_TIMEOUT_MS = 8000;

export type WheregoCreditSource = 'base' | 'ad' | 'share';

export type WheregoUsage = {
  date: string;
  remaining: number;
  baseDailyLimit: number;
  baseUsed: number;
  baseRemaining: number;
  adRewardsUsed: number;
  adRewardsLimit: number;
  adCreditsRemaining: number;
  shareRewardUsed: boolean;
  shareCreditsRemaining: number;
  nextResetAt: string;
  limitEnabled: boolean;
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
  sessionId?: string;
}): Promise<WheregoUsage> {
  const body = await postUsage('/api/wherego/usage', {
    anonymousUserKey: params.anonymousUserKey || undefined,
    sessionId: params.sessionId,
  });
  return body.usage;
}

export async function grantWheregoReward(params: {
  anonymousUserKey?: string | null;
  sessionId?: string;
  source: 'ad' | 'share';
  grantId: string;
}): Promise<WheregoUsage> {
  const body = await postUsage('/api/wherego/usage/reward', {
    anonymousUserKey: params.anonymousUserKey || undefined,
    sessionId: params.sessionId,
    source: params.source,
    grantId: params.grantId,
  });
  return body.usage;
}

export async function fetchWheregoQuestionSet(params: {
  origin: WheregoRecommendOrigin;
  excludeQuestionIds?: string[];
  excludeGeneralTagGroups?: string[];
}): Promise<WheregoQuestionSet> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new WheregoApiError('질문 세트 응답이 지연되고 있어요.', 408));
    }, QUESTION_SET_TIMEOUT_MS);
  });

  try {
    const response = await Promise.race([
      fetch(`${API_BASE_URL}/api/wherego/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin: params.origin,
          excludeQuestionIds: params.excludeQuestionIds || [],
          excludeGeneralTagGroups: params.excludeGeneralTagGroups || [],
        }),
      }),
      timeoutPromise,
    ]);

    if (!response.ok) {
      throw await parseApiError(response);
    }

    return (await response.json()) as WheregoQuestionSet;
  } finally {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
    }
  }
}

export async function prepareWheregoCandidates(params: {
  origin: WheregoRecommendOrigin;
  answers: WheregoRecommendAnswer[];
  sessionId?: string;
  anonymousUserKey?: string | null;
}): Promise<WheregoCandidateSet> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new WheregoApiError('관광지 후보 준비가 지연되고 있어요.', 408));
    }, CANDIDATE_SET_TIMEOUT_MS);
  });

  try {
    const response = await Promise.race([
      fetch(`${API_BASE_URL}/api/wherego/candidates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin: params.origin,
          answers: params.answers,
          sessionId: params.sessionId,
          anonymousUserKey: params.anonymousUserKey || undefined,
        }),
      }),
      timeoutPromise,
    ]);

    if (!response.ok) {
      throw await parseApiError(response);
    }

    return (await response.json()) as WheregoCandidateSet;
  } finally {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
    }
  }
}

export async function recommendWheregoDestination(params: {
  origin: WheregoRecommendOrigin;
  answers: WheregoRecommendAnswer[];
  candidateSet?: WheregoCandidateSet | null;
  sessionId?: string;
  anonymousUserKey?: string | null;
}): Promise<WheregoRecommendation> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new WheregoApiError('추천 서버 응답이 지연되고 있어요.', 408));
    }, RECOMMENDATION_TIMEOUT_MS);
  });

  try {
    const response = await Promise.race([
      fetch(`${API_BASE_URL}/api/wherego/recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin: params.origin,
          answers: params.answers,
          limit: 1,
          candidateSet: params.candidateSet || undefined,
          sessionId: params.sessionId,
          anonymousUserKey: params.anonymousUserKey || undefined,
        }),
      }),
      timeoutPromise,
    ]);

    if (!response.ok) {
      throw await parseApiError(response);
    }

    return (await response.json()) as WheregoRecommendation;
  } finally {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
    }
  }
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
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new WheregoApiError('추천 횟수 확인이 지연되고 있어요.', 408));
    }, USAGE_TIMEOUT_MS);
  });

  try {
    const response = await Promise.race([
      fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }),
      timeoutPromise,
    ]);
    if (!response.ok) {
      throw await parseApiError(response);
    }
    return (await response.json()) as { usage: WheregoUsage };
  } finally {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
    }
  }
}
