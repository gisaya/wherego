import { API_BASE_URL } from '../config';

const RECOMMENDATION_TIMEOUT_MS = 15000;

export type WheregoRecommendOrigin = {
  type: 'current_location' | 'selected_region';
  label: string;
  description: string;
  lat: number;
  lng: number;
  areaCodes: string[];
  accuracy?: number;
};

export type WheregoRecommendAnswer = {
  questionId: string;
  questionType: 'source' | 'general';
  question: string;
  answer: string;
  caption: string;
};

export type WheregoRecommendedPlace = {
  contentId?: string;
  title: string;
  address: string;
  region?: string;
  overview?: string;
  imageUrl?: string;
  matchedKeyword?: string;
  aiReason?: string;
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
  oneLine: string;
  recommendedPlaces: WheregoRecommendedPlace[];
  shareText?: string;
  source?: {
    planner?: string;
    kto?: string;
    crowd?: string;
  };
  searchPlan?: {
    keywords?: string[];
    areaCodes?: string[];
    areaScope?: string;
    rankingNotes?: string[];
  };
};

export class WheregoApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'WheregoApiError';
    this.status = status;
  }
}

export async function recommendWheregoDestination(params: {
  origin: WheregoRecommendOrigin;
  answers: WheregoRecommendAnswer[];
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
          limit: 3,
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
      const detail = body.detail as { message?: string };
      return new WheregoApiError(detail.message || '추천 결과를 불러오지 못했어요.', response.status);
    }
  } catch (_) {
    // Fall through to the generic message.
  }

  return new WheregoApiError('추천 결과를 불러오지 못했어요.', response.status);
}
