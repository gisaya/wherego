import {
  Accuracy,
  contactsViral,
  getAnonymousKey,
  getCurrentLocation,
  getTossShareLink,
  IAP,
  InlineAd,
  isMinVersionSupported,
  loadFullScreenAd,
  requestReview,
  saveBase64Data,
  share,
  showFullScreenAd,
  Storage,
} from '@apps-in-toss/framework';
import { closeView, openURL, useBackEvent } from '@granite-js/react-native';
import { Button as TDSButton, TDSProvider, Text } from '@toss/tds-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { ClipPath, Defs, G, Image as SvgImage, Rect, Text as SvgText } from 'react-native-svg';

import {
  fetchWheregoQuestionSet,
  fetchWheregoUsage,
  grantWheregoResultPromotion,
  grantWheregoReward,
  linkWheregoGuestUsage,
  prepareWheregoCandidates,
  prepareWheregoSelection,
  recommendWheregoDestination,
  WheregoApiError,
  type WheregoCandidateSet,
  type WheregoCreditSource,
  type WheregoLoginSession,
  fetchWheregoIapConfig,
  type WheregoQuestion,
  type WheregoRecommendation,
  type WheregoRecommendedPlace,
  type WheregoUsage,
  grantWheregoIapPurchase,
  reconcileWheregoIapPurchase,
} from './api/wheregoApi';
import {
  INTRO_COAST_SOURCE,
  INTRO_CULTURE_SOURCE,
  INTRO_FOREST_SOURCE,
} from './assets/introPhotoData';
import {
  RESULT_PLACEHOLDER_BADGE_LABEL,
  RESULT_PLACEHOLDER_IMAGE_URIS,
  WHEREGO_LOGO_IMAGE_SOURCE,
  type ResultImagePlaceholderTheme,
} from './assets/resultPlaceholder';
import {
  WHEREGO_RESULT_PROMOTION_AMOUNT,
  WHEREGO_RESULT_PROMOTION_CODE,
  WHEREGO_SHARE_REWARD_MODULE_ID,
} from './config';
import { shouldSuppressBannerAds } from './ads/bannerAd';
import { adRewardLimitReached, advanceAdGate, initialAdGate, recommendationUsageLabel, resultAccessForReservation, type AdGateEvent } from './ads/recommendationAdGate';
import { SafeAnalyticsImpression, SafeAnalyticsPress } from './analytics/SafeAnalytics';
import {
  grantResultViewPromotion,
  type ResultPromotionOutcome,
} from './promotion/resultPromotion';
import { recordSuccessfulResultForReview } from './review/resultReview';
import { backDestination } from './navigation/backNavigation';
import { getCurrentLocationOnce, type CurrentLocation } from './location/currentLocation';
import { addSavedPlace, placeKey, publicPlace, publicPlaceMap, readSavedPlaces, SAVED_PLACES_KEY, sharedPlacePath, type SavedPlace } from './discovery/places';

export type WheregoEntryMode = 'general' | 'promotion';

type Step = 'intro' | 'origin' | 'question' | 'rewardGate' | 'quota' | 'result';
type QuestionKind = 'source' | 'general';
type QuestionLayout = 'two' | 'four';
type RewardAdStatus = 'idle' | 'loading' | 'ready' | 'showing' | 'unsupported' | 'error';
type RecommendationStatus = 'idle' | 'loading' | 'ready' | 'error';

type Option = {
  key?: string;
  label: string;
  caption: string;
  tags?: string[];
  searchHints?: string[];
  constraints?: Record<string, boolean | number | string | string[]>;
};

type Question = {
  type: QuestionKind;
  id: string;
  eyebrow: string;
  question: string;
  subcopy: string;
  layout: QuestionLayout;
  tags?: string[];
  options: Option[];
};

type SelectedAnswer = {
  questionId: string;
  questionType: QuestionKind;
  question: string;
  answer: string;
  caption: string;
  tags: string[];
  searchHints: string[];
  constraints: Record<string, boolean | number | string | string[]>;
};

type Origin = {
  type: 'current_location' | 'selected_region';
  label: string;
  description: string;
  lat: number;
  lng: number;
  areaCodes: string[];
  accuracy?: number;
};

type CityAnchor = {
  label: string;
  lat: number;
  lng: number;
};

type DemoResult = {
  persona: string;
  personaSummary?: string;
  place: string;
  reason: string;
  region: string;
  address: string;
  travel: string;
  signal: string;
  comfort: string;
  aiFactors?: string[];
  aiTradeoff?: string;
  aiCrowdNote?: string;
  whyThisPlace?: string[];
  overview?: string;
  imageUrl?: string;
  imageAttribution?: string;
  source?: 'kto' | 'gemini';
  ktoVerified?: boolean;
  imagePlaceholderTheme?: 'coast' | 'nature' | 'culture' | 'outdoor';
  imagePlaceholderThemeV2?: ResultImagePlaceholderTheme;
  mapLink?: string;
  isFallback?: boolean;
};

const LOGO_IMAGE = WHEREGO_LOGO_IMAGE_SOURCE;
const regionOptions: Origin[] = [
  {
    type: 'selected_region',
    label: '서울/수도권',
    description: '서울·경기·인천',
    lat: 37.5665,
    lng: 126.978,
    areaCodes: ['1', '31', '2'],
  },
  {
    type: 'selected_region',
    label: '경기 남부',
    description: '수원·용인·화성',
    lat: 37.2636,
    lng: 127.0286,
    areaCodes: ['31'],
  },
  {
    type: 'selected_region',
    label: '경기 북부',
    description: '파주·양주·포천',
    lat: 37.7599,
    lng: 126.7802,
    areaCodes: ['31'],
  },
  {
    type: 'selected_region',
    label: '인천',
    description: '섬·해안·도심',
    lat: 37.4563,
    lng: 126.7052,
    areaCodes: ['2'],
  },
  {
    type: 'selected_region',
    label: '대전/충청',
    description: '세종·충북·충남',
    lat: 36.3504,
    lng: 127.3845,
    areaCodes: ['3', '8', '33', '34'],
  },
  {
    type: 'selected_region',
    label: '강원',
    description: '춘천·강릉·속초',
    lat: 37.8813,
    lng: 127.7298,
    areaCodes: ['32'],
  },
  {
    type: 'selected_region',
    label: '전북',
    description: '전주·군산·무주',
    lat: 35.8242,
    lng: 127.148,
    areaCodes: ['37'],
  },
  {
    type: 'selected_region',
    label: '광주/전남',
    description: '광주·여수·순천',
    lat: 35.1595,
    lng: 126.8526,
    areaCodes: ['5', '38'],
  },
  {
    type: 'selected_region',
    label: '대구/경북',
    description: '대구·경주·안동',
    lat: 35.8714,
    lng: 128.6014,
    areaCodes: ['4', '35'],
  },
  {
    type: 'selected_region',
    label: '부산/경남',
    description: '부산·울산·경남',
    lat: 35.1796,
    lng: 129.0756,
    areaCodes: ['6', '7', '36'],
  },
  {
    type: 'selected_region',
    label: '제주',
    description: '제주·서귀포',
    lat: 33.4996,
    lng: 126.5312,
    areaCodes: ['39'],
  },
];

const cityAnchors: CityAnchor[] = [
  { label: '서울시', lat: 37.5665, lng: 126.978 },
  { label: '고양시', lat: 37.6584, lng: 126.832 },
  { label: '파주시', lat: 37.7602, lng: 126.7799 },
  { label: '김포시', lat: 37.6152, lng: 126.7156 },
  { label: '양주시', lat: 37.7853, lng: 127.0458 },
  { label: '의정부시', lat: 37.7381, lng: 127.0337 },
  { label: '남양주시', lat: 37.636, lng: 127.2165 },
  { label: '구리시', lat: 37.5943, lng: 127.1296 },
  { label: '하남시', lat: 37.5393, lng: 127.2149 },
  { label: '성남시', lat: 37.42, lng: 127.1265 },
  { label: '수원시', lat: 37.2636, lng: 127.0286 },
  { label: '용인시', lat: 37.2411, lng: 127.1776 },
  { label: '화성시', lat: 37.1995, lng: 126.8312 },
  { label: '안산시', lat: 37.3219, lng: 126.8309 },
  { label: '안양시', lat: 37.3943, lng: 126.9568 },
  { label: '광명시', lat: 37.4786, lng: 126.8647 },
  { label: '부천시', lat: 37.5035, lng: 126.766 },
  { label: '인천시', lat: 37.4563, lng: 126.7052 },
  { label: '시흥시', lat: 37.38, lng: 126.8029 },
  { label: '평택시', lat: 36.9921, lng: 127.1127 },
  { label: '춘천시', lat: 37.8813, lng: 127.7298 },
  { label: '원주시', lat: 37.3422, lng: 127.9202 },
  { label: '강릉시', lat: 37.7519, lng: 128.8761 },
  { label: '속초시', lat: 38.2043, lng: 128.5918 },
  { label: '대전시', lat: 36.3504, lng: 127.3845 },
  { label: '세종시', lat: 36.4801, lng: 127.289 },
  { label: '청주시', lat: 36.6424, lng: 127.489 },
  { label: '천안시', lat: 36.8151, lng: 127.1139 },
  { label: '아산시', lat: 36.7898, lng: 127.0025 },
  { label: '전주시', lat: 35.8242, lng: 127.148 },
  { label: '군산시', lat: 35.9677, lng: 126.7366 },
  { label: '광주시', lat: 35.1595, lng: 126.8526 },
  { label: '여수시', lat: 34.7604, lng: 127.6622 },
  { label: '순천시', lat: 34.9506, lng: 127.4875 },
  { label: '대구시', lat: 35.8714, lng: 128.6014 },
  { label: '경주시', lat: 35.8562, lng: 129.2247 },
  { label: '안동시', lat: 36.5684, lng: 128.7294 },
  { label: '부산시', lat: 35.1796, lng: 129.0756 },
  { label: '울산시', lat: 35.5384, lng: 129.3114 },
  { label: '창원시', lat: 35.2279, lng: 128.6819 },
  { label: '제주시', lat: 33.4996, lng: 126.5312 },
  { label: '서귀포시', lat: 33.2539, lng: 126.5598 },
];

const demoResultsByRegion: Record<string, DemoResult> = {
  '서울/수도권': {
    persona: '아이와 함께하는 도심 속 힐링 큐레이터',
    place: '서울어린이대공원',
    reason: '아이와 함께 넓은 녹지와 산책 동선을 편하게 즐기기 좋은 후보입니다.',
    region: '서울 광진구 · 공원/산책',
    address: '서울특별시 광진구 능동로 216',
    travel: '서울/수도권 기준 짧은 이동',
    signal: '지역 방문자수 보통 · 오전 추천',
    comfort: '넓은 녹지, 가족 동선, 편의시설 확인',
    imageUrl: 'http://tong.visitkorea.or.kr/cms/resource/61/3355161_image2_1.JPG',
  },
  '경기 남부': {
    persona: '가까운 물가 산책을 고르는 여유형 드라이버',
    place: '광교호수공원',
    reason: '경기 남부에서 부담 없이 다녀오기 좋고 호수 산책 동선이 단순한 후보입니다.',
    region: '경기 수원 · 호수공원/산책',
    address: '경기 수원시 영통구 광교호수로 일대',
    travel: '경기 남부 기준 짧은 이동',
    signal: '지역 방문자수 보통 · 오전 추천',
    comfort: '평지 산책, 호수 전망, 가족 동선 확인',
  },
  '경기 북부': {
    persona: '사진과 산책을 같이 챙기는 근교 탐색가',
    place: '벽초지수목원',
    reason: '경기 북부 출발에서 자연 풍경과 사진 포인트를 함께 챙기기 좋습니다.',
    region: '경기 파주 · 정원/수목원',
    address: '경기 파주시 광탄면 일대',
    travel: '경기 북부 기준 근교 후보',
    signal: '지역 방문자수 보통 · 오후 분산 추천',
    comfort: '정원 산책, 포토존, 주차 정보 확인',
  },
  인천: {
    persona: '가볍게 쉬는 도심 자연 산책러',
    place: '인천대공원',
    reason: '멀리 가지 않아도 넓은 녹지와 산책 코스를 안정적으로 즐길 수 있습니다.',
    region: '인천 남동구 · 공원/산책',
    address: '인천광역시 남동구 장수동 일대',
    travel: '인천 기준 짧은 이동',
    signal: '지역 방문자수 보통 · 평일 추천',
    comfort: '넓은 산책로, 가족 동선, 주차 정보 확인',
  },
  '대전/충청': {
    persona: '숲속에서 쉬는 반나절 힐링러',
    place: '장태산자연휴양림',
    reason: '메타세쿼이아 숲길과 데크 산책이 있어 쉬는 여행에 잘 맞습니다.',
    region: '대전 서구 · 휴양림/숲길',
    address: '대전광역시 서구 장안동 일대',
    travel: '대전/충청 기준 근교 후보',
    signal: '지역 방문자수 보통 · 오전 추천',
    comfort: '숲길, 데크, 주차 정보 확인',
  },
  강원: {
    persona: '바람 좋은 자연 코스를 찾는 여유형 여행자',
    place: '강릉솔향수목원',
    reason: '강원권에서 숲길과 계절감을 가볍게 즐기기 좋은 후보입니다.',
    region: '강원 강릉 · 수목원/산책',
    address: '강원특별자치도 강릉시 구정면 일대',
    travel: '강원 기준 근교 후보',
    signal: '지역 방문자수 보통 · 오전 추천',
    comfort: '숲길, 산책로, 운영 정보 확인',
  },
  전북: {
    persona: '도심과 자연을 균형 있게 고르는 반나절 여행자',
    place: '한국도로공사 전주수목원',
    reason: '전주권에서 이동 부담이 낮고 산책 중심으로 쉬기 좋은 후보입니다.',
    region: '전북 전주 · 수목원/산책',
    address: '전북특별자치도 전주시 덕진구 일대',
    travel: '전북 기준 근교 후보',
    signal: '지역 방문자수 보통 · 오후 추천',
    comfort: '평지 산책, 계절 정원, 주차 정보 확인',
  },
  '광주/전남': {
    persona: '넓은 풍경과 산책을 함께 보는 남도 여행자',
    place: '순천만국가정원',
    reason: '전남권에서 관광정보와 방문자수 신호가 뚜렷하고 카드로 보여주기 좋은 후보입니다.',
    region: '전남 순천 · 정원/산책',
    address: '전라남도 순천시 국가정원1호길 일대',
    travel: '광주/전남 기준 당일 후보',
    signal: '지역 방문자수 높음 · 이른 시간 추천',
    comfort: '넓은 동선, 계절 정원, 운영 정보 확인',
  },
  '대구/경북': {
    persona: '역사 분위기와 산책을 같이 챙기는 여행자',
    place: '경주 동궁과 월지',
    reason: '경북권에서 야경, 산책, 사진 요소를 함께 만족시키기 좋은 후보입니다.',
    region: '경북 경주 · 역사/야경',
    address: '경상북도 경주시 원화로 일대',
    travel: '대구/경북 기준 당일 후보',
    signal: '지역 방문자수 높음 · 해질녘 추천',
    comfort: '야간 관람, 도보 동선, 주차 정보 확인',
  },
  '부산/경남': {
    persona: '초록 풍경을 찾는 조용한 드라이버',
    place: '아홉산숲',
    reason: '부산권에서 숲의 밀도와 이색적인 산책감을 함께 느끼기 좋은 후보입니다.',
    region: '부산 기장 · 숲/산책',
    address: '부산광역시 기장군 철마면 일대',
    travel: '부산/경남 기준 근교 후보',
    signal: '지역 방문자수 보통 · 이른 시간 추천',
    comfort: '숲길, 사진 포인트, 운영 정보 확인',
  },
  제주: {
    persona: '숲 향과 느린 산책을 고르는 제주 여행자',
    place: '사려니숲길',
    reason: '제주에서 가볍게 걸으며 자연 분위기를 충분히 느끼기 좋은 후보입니다.',
    region: '제주 · 숲길/산책',
    address: '제주특별자치도 제주시 조천읍 일대',
    travel: '제주 기준 근교 후보',
    signal: '지역 방문자수 보통 · 오전 추천',
    comfort: '숲길, 날씨 확인, 주차 정보 확인',
  },
};

const SOURCE_QUESTION_COUNT = 3;
const GENERAL_QUESTION_COUNT = 3;
const FULL_SCREEN_AD_GROUP_ID = 'ait.v2.live.69c443b05e6a42ea';
const REWARDED_AD_GROUP_ID = 'ait.v2.live.7f9040b7cff746c5';
const BANNER_AD_GROUP_ID = 'ait.v2.live.67b07bf813d74267';
const ANONYMOUS_STORAGE_KEY = 'wherego.anonymous-key.v1';
const TOSS_LOGIN_SESSION_STORAGE_KEY = 'wherego.toss-login-session.v1';
const RESULT_CARD_IMAGE_WIDTH = 1080;
const RESULT_CARD_IMAGE_HEIGHT = 1350;
const RESULT_CARD_HERO_HEIGHT = 460;
const RESULT_CARD_FONT_FAMILY = Platform.select({
  android: 'sans-serif',
  ios: 'Apple SD Gothic Neo',
});
const QUESTION_ADVANCE_DELAY_MS = 250;
const REWARDED_AD_LOAD_TIMEOUT_MS = 15000;
const FULL_SCREEN_AD_EVENT_TIMEOUT_MS = 8000;
const AD_SELECTION_PREPARATION_DELAY_MS = 20000;

export function WheregoApp({ entryMode, initialSharedPlace = null }: { entryMode: WheregoEntryMode; initialSharedPlace?: SavedPlace | null }) {
  const backEvent = useBackEvent();
  const rewardAdUnregisterRef = useRef<(() => void) | null>(null);
  const rewardAdLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardAdShowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardAdLoadRequestedRef = useRef(false);
  const rewardAdLoadAttemptRef = useRef(0);
  const rewardAdLoadStartedAtRef = useRef<number | null>(null);
  const quotaAdUnregisterRef = useRef<(() => void) | null>(null);
  const quotaAdLoadedRef = useRef(false);
  const quotaRewardGrantedRef = useRef(false);
  const quotaRewardDismissedRef = useRef(false);
  const pendingAdRewardRef = useRef<{ message: string; usage: WheregoUsage } | null>(null);
  const pendingRewardGrantRef = useRef<{ source: 'ad' | 'share'; grantId: string; sessionId: string } | null>(null);
  const rewardGrantInFlightRef = useRef(false);
  const contactsViralCleanupRef = useRef<(() => void) | null>(null);
  const iapRestoreAttemptedTokenRef = useRef<string | null>(null);
  const tossLoginSessionTokenRef = useRef<string | null>(null);
  const quotaExceededRef = useRef(false);
  const exitPromptOpenRef = useRef(false);
  const resultCardSvgRef = useRef<Svg | null>(null);
  const resultReviewCountedSessionRef = useRef<string | null>(null);
  const questionAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionSetRequestIdRef = useRef(0);
  const currentLocationRequestIdRef = useRef(0);
  const candidateSetPromiseRef = useRef<Promise<WheregoCandidateSet | null> | null>(null);
  const candidatePreviewOnlyRef = useRef(false);
  const selectionPreparationPromiseRef = useRef<Promise<void> | null>(null);
  const recommendationAnalysisSessionRef = useRef<string | null>(null);
  const resultGatePendingRef = useRef(false);
  const selectedAnswersRef = useRef<SelectedAnswer[]>([]);
  const recommendationSessionIdRef = useRef(createWheregoSessionId());
  const promotionAttemptedSessionRef = useRef<string | null>(null);
  const guestAnonymousUserKeyRef = useRef<string | null>(null);
  const anonymousUserKeyRef = useRef<string | null>(null);
  const [step, setStep] = useState<Step>('intro');
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [questionSet, setQuestionSet] = useState<Question[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<SelectedAnswer[]>([]);
  const [selectedOptionLabel, setSelectedOptionLabel] = useState<string | null>(null);
  const [isQuestionAdvancing, setIsQuestionAdvancing] = useState(false);
  const [isQuestionSetLoading, setIsQuestionSetLoading] = useState(false);
  const [waitingForLocation, setWaitingForLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [isRewardAdLoaded, setIsRewardAdLoaded] = useState(false);
  const [rewardAdStatus, setRewardAdStatus] = useState<RewardAdStatus>('idle');
  const [rewardAdMessage, setRewardAdMessage] = useState('');
  const [hasRewardAccess, setHasRewardAccess] = useState(false);
  const [hasClosedFullScreenAd, setHasClosedFullScreenAd] = useState(false);
  const [usage, setUsage] = useState<WheregoUsage | null>(null);
  const [isUsageLoading, setIsUsageLoading] = useState(true);
  const [usageMessage, setUsageMessage] = useState('');
  const [quotaAdStatus, setQuotaAdStatus] = useState<RewardAdStatus>('idle');
  const [quotaRewardMessage, setQuotaRewardMessage] = useState('');
  const [isRewardGranting, setIsRewardGranting] = useState(false);
  const [hasPendingRewardGrant, setHasPendingRewardGrant] = useState(false);
  const [isIntroReady, setIsIntroReady] = useState(false);
  const [reservedCreditSource, setReservedCreditSource] = useState<WheregoCreditSource | null>(null);
  const [reservedAdFree, setReservedAdFree] = useState(false);
  const [recommendation, setRecommendation] = useState<WheregoRecommendation | null>(null);
  const [recommendationStatus, setRecommendationStatus] = useState<RecommendationStatus>('idle');
  const [recommendationErrorCode, setRecommendationErrorCode] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState('');
  const [showResultReview, setShowResultReview] = useState(false);
  const [isResultReviewRequesting, setIsResultReviewRequesting] = useState(false);
  const [resultPromotion, setResultPromotion] = useState<ResultPromotionOutcome>({ status: 'idle' });
  const [promotionRetryNonce, setPromotionRetryNonce] = useState(0);
  const savedPlacesRef = useRef<SavedPlace[]>([]);
  const savedWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const shareBusyRef = useRef(false);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [savedPlacesReady, setSavedPlacesReady] = useState(false);
  const [libraryVisible, setLibraryVisible] = useState(initialSharedPlace != null);
  const [sharedPlace, setSharedPlace] = useState(initialSharedPlace);
  const [placeMessage, setPlaceMessage] = useState('');
  const [isSharingPlace, setIsSharingPlace] = useState(false);
  const [bannerUnavailable, setBannerUnavailable] = useState(false);
  const hideUnavailableBanner = useCallback(() => setBannerUnavailable(true), []);
  const currentQuestion = questionSet[questionIndex];
  const progress = questionSet.length > 0 ? (questionIndex + 1) / questionSet.length : 0;
  const result = getResult(origin, recommendation);
  const willUsePaidCredit = Boolean(
    reservedCreditSource === 'paid' ||
      (usage?.limitEnabled && usageDailyRemaining(usage) <= 0 && usagePaidCredits(usage) > 0),
  );
  const willUseRewardedCredit = reservedCreditSource === 'ad' || Boolean(
    usage?.limitEnabled && usageBaseRemaining(usage) <= 0 && usage.adCreditsRemaining > 0,
  );
  const supportsShareReward =
    Boolean(WHEREGO_SHARE_REWARD_MODULE_ID) &&
    isMinVersionSupported({ android: '5.223.0', ios: '5.223.0' });
  const shouldPrepareQuotaRecharge = step === 'quota';
  const suppressBannerAds = shouldSuppressBannerAds({
    paidCreditsRemaining: usagePaidCredits(usage),
    reservedCreditSource,
    adFree: reservedAdFree || (reservedCreditSource == null && usageBaseRemaining(usage) > 0),
  });
  const shouldShowBannerAd =
    !suppressBannerAds && !bannerUnavailable && !libraryVisible &&
    ((step === 'question' && currentQuestion != null && !isQuestionSetLoading) ||
      (step === 'result' && recommendationStatus === 'ready' && hasClosedFullScreenAd));
  const bannerAdKey = step === 'question' ? 'question-flow' : 'result';
  const shouldDockQuestionBanner = shouldShowBannerAd && step === 'question';

  useEffect(() => {
    if (initialSharedPlace) { setSharedPlace(initialSharedPlace); setLibraryVisible(true); }
  }, [initialSharedPlace?.place, initialSharedPlace?.address]);

  useEffect(() => {
    let active = true;
    savedWriteQueueRef.current = Promise.resolve().then(() => Storage.getItem(SAVED_PLACES_KEY)).then(raw => {
      const places = readSavedPlaces(raw);
      savedPlacesRef.current = places;
      if (active) { setSavedPlaces(places); setSavedPlacesReady(true); }
    }).catch(() => { if (active) setPlaceMessage('찜한 장소를 불러오지 못했어요. 앱을 다시 열어 주세요.'); });
    return () => { active = false; };
  }, []);

  function updateSavedPlaces(transform: (places: SavedPlace[]) => SavedPlace[]) {
    if (!savedPlacesReady) return;
    savedWriteQueueRef.current = savedWriteQueueRef.current.then(async () => {
      const next = transform(savedPlacesRef.current);
      await Storage.setItem(SAVED_PLACES_KEY, JSON.stringify(next));
      savedPlacesRef.current = next;
      setSavedPlaces(next);
      setPlaceMessage('찜 목록에 반영했어요.');
    }).catch(() => setPlaceMessage('저장하지 못했어요. 잠시 후 다시 시도해 주세요.'));
  }

  async function sharePlace(value: SavedPlace) {
    if (shareBusyRef.current) return;
    shareBusyRef.current = true;
    setIsSharingPlace(true);
    setPlaceMessage('');
    setResultMessage('');
    try {
      const link = await getTossShareLink(sharedPlacePath(value));
      await share({ message: `이번 주말 ${value.place} 어때요?\n주말어디에서 장소를 확인해 보세요.\n${link}` });
    } catch {
      setPlaceMessage('공유 화면을 열지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      shareBusyRef.current = false;
      setIsSharingPlace(false);
    }
  }

  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const { key } = await resolveAnonymousUserKey();
        guestAnonymousUserKeyRef.current = key;
        anonymousUserKeyRef.current = key;
        await refreshUsage(key);

        try {
          const stored = await Storage.getItem(TOSS_LOGIN_SESSION_STORAGE_KEY);
          const session = parseStoredTossLoginSession(stored);
          if (session) {
            tossLoginSessionTokenRef.current = session.sessionToken;
            anonymousUserKeyRef.current = session.anonymousUserKey;
            try {
              const linkedUsage = await linkWheregoGuestUsage({
                guestAnonymousUserKey: key,
                loginSessionToken: session.sessionToken,
              });
              setUsage(linkedUsage);
            } catch (error) {
              if (isWheregoLoginRequiredError(error)) {
                await clearTossLoginSession();
              } else {
                await refreshUsage(session.anonymousUserKey);
              }
            }
          } else if (stored) {
            await Storage.removeItem(TOSS_LOGIN_SESSION_STORAGE_KEY);
          }
        } catch (_) {
          // Recommendations do not require a stored login session.
        }
        if (!disposed) setIsIntroReady(true);
        if (tossLoginSessionTokenRef.current) {
          await restoreExistingIapOrders();
        }
      } catch (error) {
        console.error('[wherego:intro] initialization failed', error);
        setUsageMessage('이용 정보를 모두 불러오지 못했어요. 잠시 후 다시 확인해 주세요.');
      } finally {
        if (!disposed) {
          setIsIntroReady(true);
        }
      }
    })();

    return () => {
      disposed = true;
      recommendationSessionIdRef.current = createWheregoSessionId();
      rewardAdUnregisterRef.current?.();
      rewardAdUnregisterRef.current = null;
      clearRewardAdLoadTimer();
      clearRewardAdShowTimer();
      clearQuestionAdvanceTimer();
      quotaAdUnregisterRef.current?.();
      contactsViralCleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    const handleBack = () => {
      if (libraryVisible) { setLibraryVisible(false); return; }
      const hasSubmittedAnswers = questionSet.length > 0 && selectedAnswersRef.current.length >= questionSet.length;
      const destination = backDestination(step, questionIndex, hasSubmittedAnswers || candidateSetPromiseRef.current !== null);
      if (destination === 'exit') {
        showExitConfirmation();
        return;
      }
      clearQuestionAdvanceTimer();
      if (destination === 'previousQuestion' || destination === 'origin') {
        const nextIndex = Math.max(0, questionIndex - 1);
        const retainedAnswers = selectedAnswersRef.current.slice(0, nextIndex);
        selectedAnswersRef.current = retainedAnswers;
        setSelectedAnswers(retainedAnswers);
        setSelectedOptionLabel(null);
        setIsQuestionAdvancing(false);
        setQuestionIndex(nextIndex);
        if (destination === 'origin') setStep('origin');
        return;
      }
      resetToIntro({ refresh: false });
    };

    backEvent.addEventListener(handleBack);
    return () => {
      backEvent.removeEventListener(handleBack);
    };
  }, [backEvent, step, questionIndex, questionSet.length, libraryVisible]);

  useEffect(() => {
    const shouldPreloadRewardAd =
      !hasRewardAccess &&
      !willUsePaidCredit &&
      !willUseRewardedCredit &&
      !reservedAdFree &&
      usage?.baseUsed !== 0 &&
      usage?.remaining !== 0 &&
      (step === 'origin' || step === 'rewardGate');

    if (!shouldPreloadRewardAd || rewardAdLoadRequestedRef.current || isRewardAdLoaded) {
      return;
    }

    loadRewardAd();
  }, [hasRewardAccess, isRewardAdLoaded, reservedAdFree, step, usage?.baseUsed, usage?.remaining, willUsePaidCredit, willUseRewardedCredit]);

  useEffect(() => {
    if (!willUsePaidCredit || hasRewardAccess) {
      return;
    }
    clearRewardAdLoadTimer();
    rewardAdUnregisterRef.current?.();
    rewardAdUnregisterRef.current = null;
    rewardAdLoadRequestedRef.current = false;
    setIsRewardAdLoaded(false);
    setRewardAdStatus('idle');
    setRewardAdMessage('');
  }, [hasRewardAccess, willUsePaidCredit]);

  useEffect(() => {
    if (!shouldPrepareQuotaRecharge || hasPendingRewardGrant || quotaAdLoadedRef.current || quotaAdStatus !== 'idle') {
      return;
    }
    loadQuotaRewardAd();
  }, [hasPendingRewardGrant, quotaAdStatus, shouldPrepareQuotaRecharge]);

  useEffect(() => {
    if (shouldPrepareQuotaRecharge) {
      clearRewardAdLoadTimer();
      clearRewardAdShowTimer();
      rewardAdUnregisterRef.current?.();
      rewardAdUnregisterRef.current = null;
      rewardAdLoadRequestedRef.current = false;
      setIsRewardAdLoaded(false);
      setRewardAdStatus('idle');
      return;
    }

    quotaAdUnregisterRef.current?.();
    quotaAdUnregisterRef.current = null;
    quotaAdLoadedRef.current = false;
    setQuotaAdStatus('idle');
  }, [shouldPrepareQuotaRecharge]);

  useEffect(() => {
    if (step !== 'rewardGate' || !hasRewardAccess || !hasClosedFullScreenAd) {
      return;
    }

    if (recommendationStatus === 'ready') {
      setRewardAdMessage('');
      setStep('result');
    }
  }, [hasRewardAccess, hasClosedFullScreenAd, recommendationStatus, step]);

  useEffect(() => {
    if (recommendationStatus !== 'ready' || !result.imageUrl) {
      return;
    }

    void Image.prefetch(result.imageUrl).catch(() => undefined);
  }, [recommendationStatus, result.imageUrl]);

  useEffect(() => {
    if (step !== 'result' || recommendation == null) {
      return;
    }

    const sessionId = recommendationSessionIdRef.current;
    if (resultReviewCountedSessionRef.current === sessionId) {
      return;
    }
    resultReviewCountedSessionRef.current = sessionId;
    setShowResultReview(false);

    let cancelled = false;
    void recordSuccessfulResultForReview()
      .then((shouldShow) => {
        if (!cancelled) {
          setShowResultReview(shouldShow);
        }
      })
      .catch((error) => {
        console.error('[wherego:review] eligibility check failed', error);
      });

    return () => {
      cancelled = true;
    };
  }, [recommendation, step]);

  useEffect(() => {
    if (entryMode !== 'promotion' || step !== 'result' || recommendation == null) {
      return;
    }

    const sessionId = recommendationSessionIdRef.current;
    if (promotionAttemptedSessionRef.current === sessionId) {
      return;
    }
    promotionAttemptedSessionRef.current = sessionId;

    let cancelled = false;
    setResultPromotion({ status: 'loading' });
    void grantResultViewPromotion(async () => {
      const anonymousUserKey = guestAnonymousUserKeyRef.current;
      if (!anonymousUserKey) {
        throw new WheregoApiError(
          '토스 사용자 식별키를 확인하지 못했어요.',
          409,
          'anon_key_required',
        );
      }
      return grantWheregoResultPromotion({
        anonymousUserKey,
        promotionCode: WHEREGO_RESULT_PROMOTION_CODE,
      });
    })
      .then((outcome) => {
        if (!cancelled) {
          setResultPromotion(outcome);
        }
      })
      .catch((error) => {
        console.error('[wherego:result-promotion] failed', error);
        if (!cancelled) {
          setResultPromotion({ status: 'error', errorCode: 'UNEXPECTED', retryable: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [entryMode, promotionRetryNonce, recommendation, step]);

  useEffect(() => {
    if (!waitingForLocation) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setLocationStatus('위치 확인이 오래 걸리면 지역 선택으로 바로 시작할 수 있어요.');
    }, 8000);

    return () => clearTimeout(timeoutId);
  }, [waitingForLocation]);

  function clearQuestionAdvanceTimer() {
    if (questionAdvanceTimeoutRef.current == null) {
      return;
    }

    clearTimeout(questionAdvanceTimeoutRef.current);
    questionAdvanceTimeoutRef.current = null;
  }

  function clearRewardAdLoadTimer() {
    if (rewardAdLoadTimeoutRef.current == null) {
      return;
    }

    clearTimeout(rewardAdLoadTimeoutRef.current);
    rewardAdLoadTimeoutRef.current = null;
  }

  function clearRewardAdShowTimer() {
    if (rewardAdShowTimeoutRef.current == null) {
      return;
    }

    clearTimeout(rewardAdShowTimeoutRef.current);
    rewardAdShowTimeoutRef.current = null;
  }

  async function refreshUsage(key = anonymousUserKeyRef.current) {
    setIsUsageLoading(true);
    setUsageMessage('');
    try {
      const nextUsage = await fetchWheregoUsage({
        anonymousUserKey: key,
        loginSessionToken: tossLoginSessionTokenRef.current,
        sessionId: recommendationSessionIdRef.current,
      });
      setUsage(nextUsage);
      if (!adRewardLimitReached(nextUsage) && quotaAdStatus !== 'showing' && !isRewardGranting) {
        setQuotaRewardMessage('');
        if (quotaAdStatus === 'error') setQuotaAdStatus('idle');
      }
    } catch (error) {
      if (isWheregoLoginRequiredError(error)) {
        await clearTossLoginSession();
        setUsageMessage('기존 로그인 시간이 만료돼 기본 추천으로 연결했어요. 이용권 복원이 필요하면 문의해 주세요.');
        return;
      }
      setUsageMessage(toErrorMessage(error));
    } finally {
      setIsUsageLoading(false);
    }
  }

  async function restoreExistingIapOrders() {
    const key = anonymousUserKeyRef.current;
    const loginSessionToken = tossLoginSessionTokenRef.current;
    if (!key || !loginSessionToken) return;
    try {
      const config = await fetchWheregoIapConfig();
      if ((config.restorationEnabled ?? config.enabled) && config.products.length > 0) {
        await restoreIapOrders(key, new Set(config.products.map(product => product.sku)), loginSessionToken);
      }
    } catch (error) {
      console.error('[wherego:iap] existing order restore failed', error);
    }
  }

  async function restoreIapOrders(
    key: string | null,
    configuredSkus: Set<string>,
    loginSessionToken: string,
  ) {
    if (!key || !loginSessionToken || iapRestoreAttemptedTokenRef.current === loginSessionToken) {
      return;
    }
    iapRestoreAttemptedTokenRef.current = loginSessionToken;
    let restoredCredits = 0;
    if (isMinVersionSupported({ android: '5.234.0', ios: '5.231.0' })) {
      try {
        const pending = await IAP.getPendingOrders();
        for (const order of pending?.orders || []) {
          if (!configuredSkus.has(order.sku)) {
            continue;
          }
          const granted = await grantWheregoIapPurchase({
            anonymousUserKey: key,
            loginSessionToken,
            orderId: order.orderId,
            sku: order.sku,
          });
          const completed = await IAP.completeProductGrant({ params: { orderId: order.orderId } });
          setUsage(granted.usage);
          if (completed) {
            restoredCredits += granted.grantedCredits;
          }
        }
      } catch (error) {
        console.error('[wherego:iap] pending order restore failed', error);
        if (isWheregoLoginRequiredError(error)) {
          await clearTossLoginSession();
          return;
        }
      }
    }

    if (isMinVersionSupported({ android: '5.231.0', ios: '5.231.0' })) {
      try {
        let nextKey: string | null | undefined;
        for (let page = 0; page < 5; page += 1) {
          const response = await IAP.getCompletedOrRefundedOrders(nextKey ? { key: nextKey } : undefined);
          for (const order of response?.orders || []) {
            if (order.status !== 'REFUNDED' || !configuredSkus.has(order.sku)) {
              continue;
            }
            const reconciled = await reconcileWheregoIapPurchase({
              anonymousUserKey: key,
              loginSessionToken,
              orderId: order.orderId,
              sku: order.sku,
            });
            setUsage(reconciled.usage);
          }
          if (!response?.hasNext || !response.nextKey) {
            break;
          }
          nextKey = response.nextKey;
        }
      } catch (error) {
        console.error('[wherego:iap] refunded order reconcile failed', error);
        if (isWheregoLoginRequiredError(error)) {
          await clearTossLoginSession();
        }
      }
    }

    if (restoredCredits > 0) {
      setUsageMessage(`이전에 구매한 AI 추천 이용권 ${restoredCredits}회를 복구했어요.`);
    }
  }


  async function clearTossLoginSession() {
    tossLoginSessionTokenRef.current = null;
    iapRestoreAttemptedTokenRef.current = null;
    const guestKey = guestAnonymousUserKeyRef.current;
    if (guestKey) {
      anonymousUserKeyRef.current = guestKey;
    }
    try {
      await Storage.removeItem(TOSS_LOGIN_SESSION_STORAGE_KEY);
    } catch (_) {
      // The in-memory session is already cleared.
    }
    if (guestKey) {
      await refreshUsage(guestKey);
    }
  }


  function startFromIntro() {
    if (isUsageLoading) {
      setUsageMessage('추천 횟수를 확인하고 있어요.');
      return;
    }
    setStep('origin');
  }

  function openQuota() {
    setStep('quota');
  }

  function showExitConfirmation() {
    if (exitPromptOpenRef.current) {
      return;
    }
    exitPromptOpenRef.current = true;
    const closePrompt = () => {
      exitPromptOpenRef.current = false;
    };
    Alert.alert(
      '주말어디를 종료할까요?',
      '여행지 추천을 계속할 수 있어요.',
      [
        { text: '계속하기', style: 'cancel', onPress: closePrompt },
        {
          text: '나가기',
          style: 'destructive',
          onPress: () => {
            closePrompt();
            void closeView();
          },
        },
      ],
      { cancelable: true, onDismiss: closePrompt },
    );
  }

  function loadQuotaRewardAd() {
    if (adRewardLimitReached(usage)) {
      setQuotaAdStatus('error');
      setQuotaRewardMessage('오늘 받을 수 있는 광고 보상을 모두 받았어요.');
      return;
    }
    if (!loadFullScreenAd.isSupported() || !showFullScreenAd.isSupported()) {
      setQuotaAdStatus('unsupported');
      setQuotaRewardMessage('토스 앱에서 광고 보상을 받을 수 있어요.');
      return;
    }

    quotaAdUnregisterRef.current?.();
    quotaAdLoadedRef.current = false;
    setQuotaAdStatus('loading');
    setQuotaRewardMessage('보상 광고를 준비하고 있어요.');
    let finished = false;
    let unregister: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = () => {
      if (finished) return;
      finished = true;
      if (timer != null) clearTimeout(timer);
      unregister?.();
      if (quotaAdUnregisterRef.current === stop) quotaAdUnregisterRef.current = null;
    };
    const fail = (message: string) => {
      if (finished) return;
      stop();
      quotaAdLoadedRef.current = false;
      setQuotaAdStatus('error');
      setQuotaRewardMessage(message);
    };
    quotaAdUnregisterRef.current = stop;
    timer = setTimeout(() => fail('광고 준비가 지연되고 있어요. 다시 시도해 주세요.'), REWARDED_AD_LOAD_TIMEOUT_MS);
    try {
      unregister = loadFullScreenAd({
        options: { adGroupId: REWARDED_AD_GROUP_ID },
        onEvent: (event) => {
          if (finished || event.type !== 'loaded') return;
          if (timer != null) clearTimeout(timer);
          timer = null;
          quotaAdLoadedRef.current = true;
          setQuotaAdStatus('ready');
          setQuotaRewardMessage('');
        },
        onError: (error) => fail(`광고를 불러오지 못했어요. ${toErrorMessage(error)}`),
      });
      if (finished) unregister();
    } catch (error) {
      fail(`광고를 불러오지 못했어요. ${toErrorMessage(error)}`);
    }
  }

  function showQuotaRewardAd() {
    if (quotaAdStatus === 'loading' || quotaAdStatus === 'showing' || isRewardGranting) {
      return;
    }
    if (!quotaAdLoadedRef.current || quotaAdStatus !== 'ready') {
      loadQuotaRewardAd();
      return;
    }

    quotaRewardGrantedRef.current = false;
    quotaRewardDismissedRef.current = false;
    pendingAdRewardRef.current = null;
    const grantId = `ad-${createWheregoSessionId()}`;
    const adSessionId = recommendationSessionIdRef.current;
    quotaAdUnregisterRef.current?.();
    quotaAdLoadedRef.current = false;
    setQuotaAdStatus('showing');
    setQuotaRewardMessage('광고 시청을 완료하면 AI 추천 1회를 드려요.');
    let finished = false;
    let unregister: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let preparationTimer: ReturnType<typeof setTimeout> | null = null;
    let impressionConfirmed = false;
    const clearPreparationTimer = () => {
      if (preparationTimer != null) clearTimeout(preparationTimer);
      preparationTimer = null;
    };
    const clearStartTimer = () => {
      if (timer != null) clearTimeout(timer);
      timer = null;
    };
    const stop = () => {
      if (finished) return;
      finished = true;
      clearStartTimer();
      clearPreparationTimer();
      unregister?.();
      if (quotaAdUnregisterRef.current === stop) quotaAdUnregisterRef.current = null;
    };
    const fail = (message: string) => {
      if (finished) return;
      stop();
      setQuotaAdStatus('error');
      setQuotaRewardMessage(message);
    };
    quotaAdUnregisterRef.current = stop;
    // Only time out a missing start event, never the length of a playing ad.
    timer = setTimeout(() => fail('광고가 시작되지 않았어요. 다시 시도해 주세요.'), FULL_SCREEN_AD_EVENT_TIMEOUT_MS);
    try {
      unregister = showFullScreenAd({
        options: { adGroupId: REWARDED_AD_GROUP_ID },
        onEvent: (event) => {
          if (finished || adSessionId !== recommendationSessionIdRef.current) return;
          if (event.type === 'show' || event.type === 'impression' || event.type === 'userEarnedReward') {
            clearStartTimer();
          }
          if (event.type === 'impression' && !impressionConfirmed && !quotaRewardGrantedRef.current) {
            impressionConfirmed = true;
            preparationTimer = setTimeout(() => {
              preparationTimer = null;
              startAdSelectionPreparation(adSessionId, () => !finished && !quotaRewardGrantedRef.current);
            }, AD_SELECTION_PREPARATION_DELAY_MS);
          }
          if (event.type === 'userEarnedReward' && !quotaRewardGrantedRef.current) {
            clearPreparationTimer();
            quotaRewardGrantedRef.current = true;
            void applyRewardCredit('ad', grantId);
            return;
          }
          if (event.type === 'dismissed') {
            quotaRewardDismissedRef.current = true;
            stop();
            setQuotaAdStatus('idle');
            finishAdRewardNavigation();
            if (!quotaRewardGrantedRef.current) {
              setQuotaRewardMessage('광고를 끝까지 시청하면 추천 횟수가 추가돼요.');
            }
          } else if (event.type === 'failedToShow') {
            fail('광고를 표시하지 못했어요. 다시 시도해 주세요.');
          }
        },
        onError: (error) => fail(`광고를 표시하지 못했어요. ${toErrorMessage(error)}`),
      });
      if (finished) unregister();
    } catch (error) {
      fail(`광고를 표시하지 못했어요. ${toErrorMessage(error)}`);
    }
  }

  async function applyRewardCredit(source: 'ad' | 'share', grantId: string) {
    const sessionId = recommendationSessionIdRef.current;
    if (rewardGrantInFlightRef.current) return;
    const pending = pendingRewardGrantRef.current;
    if (pending && (pending.sessionId !== sessionId || pending.grantId !== grantId || pending.source !== source)) return;
    pendingRewardGrantRef.current = { source, grantId, sessionId };
    rewardGrantInFlightRef.current = true;
    setHasPendingRewardGrant(true);
    setIsRewardGranting(true);
    setQuotaRewardMessage('추천 횟수를 반영하고 있어요.');
    try {
      const nextUsage = await grantWheregoReward({
        anonymousUserKey: anonymousUserKeyRef.current,
        loginSessionToken: tossLoginSessionTokenRef.current,
        sessionId,
        source,
        grantId,
      });
      if (sessionId !== recommendationSessionIdRef.current) return;
      pendingRewardGrantRef.current = null;
      setHasPendingRewardGrant(false);
      setUsage(nextUsage);
      const message = source === 'ad' ? 'AI 추천 1회가 추가됐어요.' : 'AI 추천 3회가 추가됐어요.';
      if (source === 'ad') {
        pendingAdRewardRef.current = { message, usage: nextUsage };
        quotaExceededRef.current = false;
        setHasRewardAccess(true);
        // Only SDK reward + server credit authorizes retrieving a prepared result.
        void prepareRewardedRecommendation(sessionId);
        finishAdRewardNavigation();
      } else {
        resetToIntro({ message, refresh: false });
      }
    } catch (error) {
      if (sessionId !== recommendationSessionIdRef.current) return;
      if (error instanceof WheregoApiError && error.usage) {
        setUsage(error.usage);
      }
      setQuotaRewardMessage(toErrorMessage(error));
    } finally {
      if (sessionId === recommendationSessionIdRef.current) {
        rewardGrantInFlightRef.current = false;
        setIsRewardGranting(false);
      }
    }
  }

  function retryRewardCredit() {
    const pending = pendingRewardGrantRef.current;
    if (!pending || pending.sessionId !== recommendationSessionIdRef.current) return;
    void applyRewardCredit(pending.source, pending.grantId);
  }

  async function prepareRewardedRecommendation(sessionId: string) {
    const candidateSet = await startCandidatePreparation();
    if (sessionId !== recommendationSessionIdRef.current) return;
    if (!candidateSet) {
      setRecommendationStatus('error');
      setRewardAdMessage('관광지 후보를 준비하지 못했어요. 답변은 유지했으니 다시 시도해 주세요.');
      return;
    }
    startRecommendationAnalysis();
  }

  function startAdSelectionPreparation(sessionId: string, adStillPlaying: () => boolean) {
    if (selectionPreparationPromiseRef.current != null || origin == null) return;
    let requested = false;
    selectionPreparationPromiseRef.current = (async () => {
      const candidateSet = await startCandidatePreparation();
      if (!candidateSet || sessionId !== recommendationSessionIdRef.current || !adStillPlaying()) return;
      // This endpoint stores the AI selection privately, without granting credit or returning a result.
      requested = true;
      await prepareWheregoSelection({
        origin, answers: selectedAnswersRef.current, candidateSet, sessionId,
        anonymousUserKey: anonymousUserKeyRef.current,
        loginSessionToken: tossLoginSessionTokenRef.current,
      });
    })().catch(() => {
      // Unsupported/busy preparation falls back to the credit-authorized request after reward.
    }).finally(() => {
      if (!requested && sessionId === recommendationSessionIdRef.current) {
        selectionPreparationPromiseRef.current = null;
      }
    });
  }

  function finishAdRewardNavigation() {
    const pendingReward = pendingAdRewardRef.current;
    if (!quotaRewardDismissedRef.current || pendingReward == null) {
      return;
    }
    pendingAdRewardRef.current = null;
    if (origin != null && selectedAnswersRef.current.length === questionSet.length && questionSet.length > 0) {
      quotaExceededRef.current = false;
      setQuotaRewardMessage('');
      setHasClosedFullScreenAd(true);
      setStep('rewardGate');
      return;
    }
    resetToIntro({ message: pendingReward.message, refresh: false });
  }

  function openShareReward() {
    if (!WHEREGO_SHARE_REWARD_MODULE_ID || usage?.shareRewardUsed || isRewardGranting || pendingRewardGrantRef.current) {
      return;
    }

    contactsViralCleanupRef.current?.();
    const grantId = `share-${createWheregoSessionId()}`;
    try {
      contactsViralCleanupRef.current = contactsViral({
        options: { moduleId: WHEREGO_SHARE_REWARD_MODULE_ID },
        onEvent: (event) => {
          if (event.type === 'sendViral') {
            void applyRewardCredit('share', grantId);
            return;
          }
          if (event.type === 'close') {
            contactsViralCleanupRef.current?.();
            contactsViralCleanupRef.current = null;
          }
        },
        onError: (error) => {
          setQuotaRewardMessage(`공유 화면을 열지 못했어요. ${toErrorMessage(error)}`);
        },
      });
    } catch (error) {
      setQuotaRewardMessage(`공유 화면을 열지 못했어요. ${toErrorMessage(error)}`);
    }
  }

  function resetToIntro(
    options: {
      message?: string;
      refresh?: boolean;
    } = {},
  ) {
    currentLocationRequestIdRef.current += 1;
    questionSetRequestIdRef.current += 1;
    clearQuestionAdvanceTimer();
    quotaAdUnregisterRef.current?.();
    quotaAdUnregisterRef.current = null;
    setPlaceMessage('');
    setStep('intro');
    setOrigin(null);
    setQuestionSet([]);
    setQuestionIndex(0);
    setSelectedAnswers([]);
    selectedAnswersRef.current = [];
    setSelectedOptionLabel(null);
    setIsQuestionAdvancing(false);
    setIsQuestionSetLoading(false);
    setWaitingForLocation(false);
    setLocationStatus('');
    candidateSetPromiseRef.current = null;
    candidatePreviewOnlyRef.current = false;
    selectionPreparationPromiseRef.current = null;
    recommendationAnalysisSessionRef.current = null;
    pendingAdRewardRef.current = null;
    pendingRewardGrantRef.current = null;
    rewardGrantInFlightRef.current = false;
    setHasPendingRewardGrant(false);
    quotaRewardGrantedRef.current = false;
    quotaRewardDismissedRef.current = false;
    setIsRewardGranting(false);
    resultGatePendingRef.current = false;
    setReservedCreditSource(null);
    setReservedAdFree(false);
    recommendationSessionIdRef.current = createWheregoSessionId();
    promotionAttemptedSessionRef.current = null;
    quotaExceededRef.current = false;
    resetRewardAdState();
    setRecommendation(null);
    setRecommendationStatus('idle');
    setRecommendationErrorCode(null);
    setResultMessage('');
    setResultPromotion({ status: 'idle' });
    setPromotionRetryNonce(0);
    setQuotaRewardMessage('');
    setUsageMessage(options.message || '');
    if (options.refresh !== false) {
      void refreshUsage();
    } else {
      setIsUsageLoading(false);
    }
  }

  function resetRewardAdState() {
    clearRewardAdLoadTimer();
    clearRewardAdShowTimer();
    rewardAdUnregisterRef.current?.();
    rewardAdUnregisterRef.current = null;
    rewardAdLoadRequestedRef.current = false;
    rewardAdLoadAttemptRef.current = 0;
    rewardAdLoadStartedAtRef.current = null;
    setIsRewardAdLoaded(false);
    setRewardAdStatus('idle');
    setRewardAdMessage('');
    setHasRewardAccess(false);
    setHasClosedFullScreenAd(false);
  }

  function loadRewardAd() {
    const supportsRewardAd = loadFullScreenAd.isSupported() && showFullScreenAd.isSupported();
    const loadAttempt = rewardAdLoadAttemptRef.current + 1;

    clearRewardAdLoadTimer();
    rewardAdUnregisterRef.current?.();
    rewardAdUnregisterRef.current = null;
    rewardAdLoadRequestedRef.current = true;
    rewardAdLoadAttemptRef.current = loadAttempt;
    rewardAdLoadStartedAtRef.current = Date.now();
    setIsRewardAdLoaded(false);

    if (!supportsRewardAd) {
      console.warn('[wherego:interstitial-ad] unsupported');
      rewardAdLoadRequestedRef.current = false;
      rewardAdLoadStartedAtRef.current = null;
      setRewardAdStatus('unsupported');
      setRewardAdMessage('브라우저나 샌드박스는 전면 광고를 지원하지 않아요. 콘솔 QR의 토스 앱 테스트에서 광고를 확인해주세요.');
      return;
    }

    setRewardAdStatus('loading');
    setRewardAdMessage('전면 광고를 준비하고 있어요.');
    console.info('[wherego:interstitial-ad] load requested', { attempt: loadAttempt, step });

    rewardAdLoadTimeoutRef.current = setTimeout(() => {
      if (rewardAdLoadAttemptRef.current !== loadAttempt) {
        return;
      }

      console.warn('[wherego:interstitial-ad] load timed out', {
        attempt: loadAttempt,
        elapsedMs: rewardAdLoadElapsedMs(rewardAdLoadStartedAtRef.current),
      });
      rewardAdLoadTimeoutRef.current = null;
      rewardAdUnregisterRef.current?.();
      rewardAdUnregisterRef.current = null;
      rewardAdLoadRequestedRef.current = false;
      rewardAdLoadStartedAtRef.current = null;
      setIsRewardAdLoaded(false);
      setRewardAdStatus('error');
      setRewardAdMessage('광고 준비 시간이 길어지고 있어요. 다시 불러와 주세요.');
    }, REWARDED_AD_LOAD_TIMEOUT_MS);

    try {
      rewardAdUnregisterRef.current = loadFullScreenAd({
        options: {
          adGroupId: FULL_SCREEN_AD_GROUP_ID,
        },
        onEvent: (event) => {
          if (event.type === 'loaded' && rewardAdLoadAttemptRef.current === loadAttempt) {
            console.info('[wherego:interstitial-ad] loaded', {
              attempt: loadAttempt,
              elapsedMs: rewardAdLoadElapsedMs(rewardAdLoadStartedAtRef.current),
            });
            clearRewardAdLoadTimer();
            rewardAdLoadStartedAtRef.current = null;
            setIsRewardAdLoaded(true);
            setRewardAdStatus('ready');
            setRewardAdMessage('');
          }
        },
        onError: (error) => {
          if (rewardAdLoadAttemptRef.current !== loadAttempt) {
            return;
          }

          console.error('[wherego:interstitial-ad] load failed', {
            attempt: loadAttempt,
            elapsedMs: rewardAdLoadElapsedMs(rewardAdLoadStartedAtRef.current),
            error,
          });
          clearRewardAdLoadTimer();
          rewardAdLoadRequestedRef.current = false;
          rewardAdLoadStartedAtRef.current = null;
          setIsRewardAdLoaded(false);
          setRewardAdStatus('error');
          setRewardAdMessage(`광고를 불러오지 못했어요. ${toErrorMessage(error)}`);
        },
      });
    } catch (error) {
      console.error('[wherego:interstitial-ad] load threw', {
        attempt: loadAttempt,
        elapsedMs: rewardAdLoadElapsedMs(rewardAdLoadStartedAtRef.current),
        error,
      });
      clearRewardAdLoadTimer();
      rewardAdLoadRequestedRef.current = false;
      rewardAdLoadStartedAtRef.current = null;
      setIsRewardAdLoaded(false);
      setRewardAdStatus('error');
      setRewardAdMessage(`광고를 불러오지 못했어요. ${toErrorMessage(error)}`);
    }
  }

  function startRecommendationAnalysis() {
    const sessionId = recommendationSessionIdRef.current;
    if (recommendationAnalysisSessionRef.current === sessionId) {
      return;
    }
    recommendationAnalysisSessionRef.current = sessionId;
    void prepareRecommendation(selectedAnswersRef.current, sessionId);
  }

  function startCandidatePreparation() {
    if (origin == null || selectedAnswersRef.current.length === 0) {
      return null;
    }

    if (candidateSetPromiseRef.current != null) {
      return candidateSetPromiseRef.current;
    }

    const sessionId = recommendationSessionIdRef.current;
    candidateSetPromiseRef.current = prepareWheregoCandidates({
      origin,
      answers: selectedAnswersRef.current,
      sessionId,
      anonymousUserKey: anonymousUserKeyRef.current,
      loginSessionToken: tossLoginSessionTokenRef.current,
      previewOnly: candidatePreviewOnlyRef.current,
    })
      .then((candidateSet) => {
        if (sessionId !== recommendationSessionIdRef.current) return null;
        setReservedCreditSource(candidateSet.creditSource || null);
        setReservedAdFree(candidateSet.adFree === true);
        if (candidateSet.usage) {
          setUsage(candidateSet.usage);
        }
        return candidateSet;
      })
      .catch((error) => {
        if (sessionId !== recommendationSessionIdRef.current) return null;
        console.error('[wherego:candidates] preparation failed', error);
        candidateSetPromiseRef.current = null;
        if (error instanceof WheregoApiError && error.usage) {
          setUsage(error.usage);
        }
        if (error instanceof WheregoApiError && error.code === 'wherego_daily_limit_reached') {
          quotaExceededRef.current = true;
          candidatePreviewOnlyRef.current = true;
          setUsageMessage(error.message);
          openQuota();
        }
        return null;
      });

    return candidateSetPromiseRef.current;
  }

  async function showRewardAd() {
    if (resultGatePendingRef.current || rewardAdStatus === 'showing') {
      return;
    }
    resultGatePendingRef.current = true;

    const candidateSet = await startCandidatePreparation();
    if (!candidateSet) {
      resultGatePendingRef.current = false;
      setRewardAdMessage('관광지 후보를 준비하지 못했어요. 답변은 유지했으니 다시 시도해 주세요.');
      return;
    }
    const resultAccess = resultAccessForReservation(candidateSet);
    if (resultAccess === 'free') {
      setHasRewardAccess(true);
      setHasClosedFullScreenAd(true);
      setRewardAdMessage('오늘 첫 추천을 광고 없이 준비하고 있어요.');
      startRecommendationAnalysis();
      return;
    }
    if (resultAccess === 'paid') {
      setHasRewardAccess(true);
      setHasClosedFullScreenAd(true);
      setRewardAdStatus('idle');
      setRewardAdMessage('AI 추천 이용권을 사용해 광고 없이 결과를 준비하고 있어요.');
      startRecommendationAnalysis();
      return;
    }
    if (resultAccess === 'rewarded') {
      setHasRewardAccess(true);
      setHasClosedFullScreenAd(true);
      setRewardAdStatus('idle');
      setRewardAdMessage('확인한 광고의 추천 1회로 결과를 준비하고 있어요.');
      startRecommendationAnalysis();
      return;
    }

    if (rewardAdStatus === 'loading') {
      resultGatePendingRef.current = false;
      setRewardAdMessage('광고를 준비하고 있어요. 잠시 후 다시 눌러주세요.');
      return;
    }

    if (rewardAdStatus === 'unsupported') {
      resultGatePendingRef.current = false;
      loadRewardAd();
      setRewardAdMessage('이 환경에서는 광고를 확인할 수 없어요. 최신 토스 앱에서 다시 시도해 주세요. 답변은 유지했어요.');
      return;
    }

    if (rewardAdStatus === 'error' || !isRewardAdLoaded) {
      resultGatePendingRef.current = false;
      loadRewardAd();
      setRewardAdMessage('광고를 다시 준비하고 있어요.');
      return;
    }

    let didFinishAd = false;
    const adSessionId = recommendationSessionIdRef.current;
    let adGate = initialAdGate();
    let unregisterShowAd: (() => void) | null = null;
    const finishAd = (event: AdGateEvent, message: string) => {
      if (didFinishAd || adSessionId !== recommendationSessionIdRef.current) {
        return;
      }

      didFinishAd = true;
      adGate = advanceAdGate(adGate, event);
      clearRewardAdShowTimer();
      unregisterShowAd?.();
      rewardAdUnregisterRef.current = null;
      setIsRewardAdLoaded(false);
      setHasClosedFullScreenAd(adGate.allowed);
      setRewardAdStatus(adGate.allowed ? 'idle' : 'error');
      if (adGate.allowed) {
        setHasRewardAccess(true);
        startRecommendationAnalysis();
        setRewardAdMessage(message);
      } else {
        resultGatePendingRef.current = false;
        setHasRewardAccess(false);
        setRewardAdMessage('광고 확인을 완료하지 못했어요. 답변은 유지했으며 AI 추천은 시작하지 않았어요. 광고를 다시 시도해 주세요.');
      }
    };

    setRewardAdStatus('showing');
    setRewardAdMessage('광고를 여는 중이에요. 관광지 후보를 먼저 준비하고 있어요.');
    rewardAdUnregisterRef.current?.();
    rewardAdUnregisterRef.current = null;
    clearRewardAdShowTimer();
    rewardAdShowTimeoutRef.current = setTimeout(() => {
      rewardAdShowTimeoutRef.current = null;
      console.warn('[wherego:interstitial-ad] show event timed out');
      finishAd('timeout', '');
    }, FULL_SCREEN_AD_EVENT_TIMEOUT_MS);

    try {
      unregisterShowAd = showFullScreenAd({
        options: {
          adGroupId: FULL_SCREEN_AD_GROUP_ID,
        },
        onEvent: (event) => {
          if (didFinishAd || adSessionId !== recommendationSessionIdRef.current) return;
          console.info('[wherego:interstitial-ad] show event', { type: event.type });

          if (event.type === 'requested') {
            setRewardAdMessage('광고 요청이 완료됐어요.');
            return;
          }

          if (event.type === 'show') {
            clearRewardAdShowTimer();
            adGate = advanceAdGate(adGate, 'show');
            return;
          }

          if (event.type === 'impression') {
            clearRewardAdShowTimer();
            adGate = advanceAdGate(adGate, 'impression');
            return;
          }

          if (event.type === 'dismissed') {
            finishAd('dismissed', '광고 확인 완료. AI가 여행지를 고르고 있어요.');
            return;
          }

          if (event.type === 'failedToShow') {
            finishAd('failedToShow', '');
          }
        },
        onError: (error) => {
          console.error('[wherego:interstitial-ad] show failed', error);
          finishAd('error', '');
        },
      });
      if (didFinishAd) {
        unregisterShowAd?.();
      } else {
        rewardAdUnregisterRef.current = unregisterShowAd;
      }
    } catch (error) {
      console.error('[wherego:interstitial-ad] show threw', error);
      finishAd('error', '');
    }
  }

  async function startFlowWithOrigin(nextOrigin: Origin) {
    currentLocationRequestIdRef.current += 1;
    setBannerUnavailable(false);
    const requestId = questionSetRequestIdRef.current + 1;
    questionSetRequestIdRef.current = requestId;
    clearQuestionAdvanceTimer();
    setOrigin(nextOrigin);
    setQuestionSet([]);
    setQuestionIndex(0);
    setSelectedAnswers([]);
    selectedAnswersRef.current = [];
    setSelectedOptionLabel(null);
    setIsQuestionAdvancing(false);
    setIsQuestionSetLoading(true);
    setWaitingForLocation(false);
    setLocationStatus('질문 세트를 준비하고 있어요.');
    candidateSetPromiseRef.current = null;
    candidatePreviewOnlyRef.current = false;
    selectionPreparationPromiseRef.current = null;
    recommendationAnalysisSessionRef.current = null;
    resetRewardAdState();
    resultGatePendingRef.current = false;
    setReservedCreditSource(null);
    setReservedAdFree(false);
    recommendationSessionIdRef.current = createWheregoSessionId();
    promotionAttemptedSessionRef.current = null;
    quotaExceededRef.current = false;
    setRecommendation(null);
    setRecommendationStatus('idle');
    setRecommendationErrorCode(null);
    setResultMessage('');
    setResultPromotion({ status: 'idle' });
    setPromotionRetryNonce(0);

    const fallbackSessionId = recommendationSessionIdRef.current;
    let nextQuestionSet: { questions: Question[]; sessionId: string };
    try {
      const response = await fetchWheregoQuestionSet({ origin: nextOrigin });
      const remoteQuestions = normalizeRemoteQuestions(response.questions);
      if (remoteQuestions.length !== SOURCE_QUESTION_COUNT + GENERAL_QUESTION_COUNT) {
        throw new Error('서버 질문 세트 구성이 올바르지 않아요.');
      }
      nextQuestionSet = {
        questions: remoteQuestions,
        sessionId: response.questionSetId || fallbackSessionId,
      };
    } catch (error) {
      if (questionSetRequestIdRef.current !== requestId) {
        return;
      }
      setIsQuestionSetLoading(false);
      setLocationStatus(`질문지를 불러오지 못했어요. ${toErrorMessage(error)}`);
      return;
    }

    if (questionSetRequestIdRef.current !== requestId) {
      return;
    }

    recommendationSessionIdRef.current = nextQuestionSet.sessionId;
    setQuestionSet(nextQuestionSet.questions);
    setIsQuestionSetLoading(false);
    setLocationStatus('');
    setStep('question');
  }

  async function handleUseCurrentLocation() {
    if (waitingForLocation || isQuestionSetLoading) {
      return;
    }
    const requestId = currentLocationRequestIdRef.current + 1;
    currentLocationRequestIdRef.current = requestId;
    setWaitingForLocation(true);
    setLocationStatus('현재 위치를 확인하고 있어요. 권한 팝업이 보이면 허용해주세요.');
    try {
      const geolocation: CurrentLocation = await getCurrentLocationOnce(() => getCurrentLocation({ accuracy: Accuracy.Balanced }));
      if (currentLocationRequestIdRef.current !== requestId) {
        return;
      }
      await startFlowWithOrigin({
        type: 'current_location',
        label: currentLocationLabel(geolocation.coords.latitude, geolocation.coords.longitude),
        description: '권한 허용 위치',
        lat: geolocation.coords.latitude,
        lng: geolocation.coords.longitude,
        areaCodes: [],
        accuracy: geolocation.coords.accuracy,
      });
    } catch (error) {
      if (currentLocationRequestIdRef.current === requestId) {
        setLocationStatus(`위치를 확인하지 못했어요. ${toErrorMessage(error)} 지역을 직접 선택해도 됩니다.`);
      }
    } finally {
      if (currentLocationRequestIdRef.current === requestId) {
        setWaitingForLocation(false);
      }
    }
  }

  function chooseOption(option: Option) {
    if (currentQuestion == null || isQuestionAdvancing) {
      return;
    }

    clearQuestionAdvanceTimer();

    const nextAnswers = [
      ...selectedAnswers,
      {
        questionId: currentQuestion.id,
        questionType: currentQuestion.type,
        question: currentQuestion.question,
        answer: option.label,
        caption: option.caption,
        tags: uniqueStrings([...(currentQuestion.tags || []), ...(option.tags || [])]),
        searchHints: option.searchHints || [],
        constraints: option.constraints || {},
      },
    ];

    setSelectedAnswers(nextAnswers);
    selectedAnswersRef.current = nextAnswers;
    setSelectedOptionLabel(option.label);
    setIsQuestionAdvancing(true);

    if (questionIndex < questionSet.length - 1) {
      questionAdvanceTimeoutRef.current = setTimeout(() => {
        questionAdvanceTimeoutRef.current = null;
        setSelectedOptionLabel(null);
        setIsQuestionAdvancing(false);
        setQuestionIndex((index) => index + 1);
      }, QUESTION_ADVANCE_DELAY_MS);
      return;
    }

    if (usage?.limitEnabled && usage.remaining <= 0) {
      quotaExceededRef.current = true;
      candidatePreviewOnlyRef.current = true;
      startCandidatePreparation();
    } else {
      startCandidatePreparation();
      if (hasRewardAccess) startRecommendationAnalysis();
    }
    questionAdvanceTimeoutRef.current = setTimeout(() => {
      questionAdvanceTimeoutRef.current = null;
      setSelectedOptionLabel(null);
      setIsQuestionAdvancing(false);
      setStep(quotaExceededRef.current ? 'quota' : 'rewardGate');
    }, QUESTION_ADVANCE_DELAY_MS);
  }

  async function prepareRecommendation(answers: SelectedAnswer[], sessionId: string) {
    if (origin == null) {
      return;
    }

    if (answers.length === 0) {
      recommendationAnalysisSessionRef.current = null;
      setRecommendation(null);
      setRecommendationStatus('error');
      setRecommendationErrorCode('wherego_missing_answers');
      setRewardAdMessage('답변 정보를 확인하지 못했어요. 처음부터 다시 진행해주세요.');
      return;
    }

    setRecommendationStatus('loading');
    setRecommendationErrorCode(null);
    setResultMessage('');

    try {
      const candidateSet = (await candidateSetPromiseRef.current) ?? null;
      await selectionPreparationPromiseRef.current;
      if (sessionId !== recommendationSessionIdRef.current) return;
      const nextRecommendation = await recommendWheregoDestination({
        origin,
        answers,
        candidateSet,
        sessionId,
        anonymousUserKey: anonymousUserKeyRef.current,
        loginSessionToken: tossLoginSessionTokenRef.current,
      });
      if (sessionId !== recommendationSessionIdRef.current) return;
      setRecommendation(nextRecommendation);
      setReservedCreditSource(nextRecommendation.creditSource || candidateSet?.creditSource || null);
      setReservedAdFree(nextRecommendation.adFree === true || candidateSet?.adFree === true);
      if (nextRecommendation.usage) {
        setUsage(nextRecommendation.usage);
      }
      setRecommendationStatus('ready');
      setRecommendationErrorCode(null);
    } catch (error) {
      if (sessionId !== recommendationSessionIdRef.current) return;
      recommendationAnalysisSessionRef.current = null;
      setRecommendation(null);
      setRecommendationStatus('error');
      const errorCode = error instanceof WheregoApiError ? error.code || null : null;
      setRecommendationErrorCode(errorCode);
      if (error instanceof WheregoApiError && error.usage) {
        setUsage(error.usage);
      }
      if (error instanceof WheregoApiError && error.code === 'wherego_daily_limit_reached') {
        setUsageMessage(error.message);
        openQuota();
        return;
      }
      if (errorCode === 'wherego_no_place_candidates') {
        setRewardAdMessage('선택한 조건을 모두 만족하는 관광지를 찾지 못했어요.');
        return;
      }
      setRewardAdMessage(`추천을 완료하지 못했어요. ${toErrorMessage(error)}`);
    }
  }

  function retryRecommendation() {
    setRewardAdMessage('');
    setRecommendationErrorCode(null);
    startCandidatePreparation();
    startRecommendationAnalysis();
  }

  function restartQuestionsAfterNoCandidates() {
    setRewardAdMessage('');
    setRecommendationErrorCode(null);
    candidateSetPromiseRef.current = null;
    if (origin == null) {
      resetToIntro();
      return;
    }
    void startFlowWithOrigin(origin);
  }

  function openMap() {
    setPlaceMessage('');
    setResultMessage('');
    void openURL(result.mapLink || naverSearchLink(result.place)).catch(() => {
      setResultMessage('지도 링크를 열지 못했어요. 잠시 후 다시 시도해주세요.');
    });
  }

  function saveCard() {
    setPlaceMessage('');
    setResultMessage('카드 이미지를 저장하고 있어요.');
    void saveResultCard(result, resultCardSvgRef.current)
      .then(() => {
        setResultMessage('PNG 카드 이미지로 저장했어요.');
      })
      .catch((error) => {
        setResultMessage(`카드 저장을 완료하지 못했어요. ${toErrorMessage(error)}`);
      });
  }

  function openResultReview() {
    if (isResultReviewRequesting) {
      return;
    }
    setIsResultReviewRequesting(true);
    void requestReview()
      .catch((error) => {
        console.error('[wherego:review] request failed', error);
      })
      .finally(() => {
        setIsResultReviewRequesting(false);
        setShowResultReview(false);
      });
  }

  return (
    <TDSProvider colorPreference="light">
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.phone, shouldDockQuestionBanner ? styles.phoneWithDockedBanner : null]}>
            {step === 'question' ? <Header counter={`${questionIndex + 1} / ${questionSet.length}`} /> : null}
            {step === 'question' ? <ProgressBar progress={progress} /> : null}
            {step === 'intro' ? (
              !isIntroReady ? (
                <IntroLoadingScreen entryMode={entryMode} />
              ) : entryMode === 'promotion' ? (
                <PromotionIntroScreen
                  loading={isUsageLoading}
                  message={usageMessage}
                  onStart={startFromIntro}
                  usage={usage}
                />
              ) : (
                <IntroScreen
                  loading={isUsageLoading}
                  message={usageMessage}
                  onStart={startFromIntro}
                  usage={usage}
                />
              )
            ) : null}
            {step === 'intro' ? (
              <SecondaryButton label={`찜한 여행지 ${savedPlaces.length}곳`} onPress={() => { setSharedPlace(null); setLibraryVisible(true); }} />
            ) : null}
            {step === 'origin' ? (
              <OriginScreen
                locationStatus={locationStatus}
                onUseCurrentLocation={handleUseCurrentLocation}
                onSelectRegion={startFlowWithOrigin}
                preparingQuestions={isQuestionSetLoading}
                waitingForLocation={waitingForLocation}
              />
            ) : null}
            {step === 'question' && currentQuestion != null ? (
              <QuestionScreen
                advancing={isQuestionAdvancing}
                origin={origin}
                question={currentQuestion}
                selectedOptionLabel={selectedOptionLabel}
                onChoose={chooseOption}
              />
            ) : null}
            {step === 'rewardGate' ? (
              <RewardGate
                errorCode={recommendationErrorCode}
                hasRewardAccess={hasRewardAccess}
                paidCreditNext={willUsePaidCredit}
                adFreeNext={reservedAdFree || usage?.baseUsed === 0}
                rewardedCreditNext={willUseRewardedCredit}
                message={rewardGateMessage(rewardAdMessage, recommendationStatus, recommendationErrorCode)}
                recommendationStatus={recommendationStatus}
                status={rewardAdStatus}
                onRestartQuestions={restartQuestionsAfterNoCandidates}
                onRetryRecommendation={retryRecommendation}
                onWatchAd={showRewardAd}
              />
            ) : null}
            {step === 'quota' ? (
              <QuotaScreen
                adStatus={quotaAdStatus}
                granting={isRewardGranting}
                rewardPending={hasPendingRewardGrant}
                onRetryReward={retryRewardCredit}
                message={quotaRewardMessage || usageMessage}
                onBack={resetToIntro}
                onShare={openShareReward}
                onStart={() => { setStep('rewardGate'); void showRewardAd(); }}
                onRefreshUsage={() => { void refreshUsage(); }}
                refreshingUsage={isUsageLoading}
                onWatchAd={showQuotaRewardAd}
                shareReady={supportsShareReward}
                usage={usage}
              />
            ) : null}
            {step === 'result' ? (
              <>
                <SafeAnalyticsImpression event="weekend_result_view">
                  <ResultScreen
                    message={placeMessage || resultMessage}
                    bookmarked={savedPlaces.some(p => placeKey(p) === placeKey(result))}
                    bookmarkReady={savedPlacesReady}
                    sharing={isSharingPlace}
                    onBookmark={() => { setPlaceMessage(''); updateSavedPlaces(places => addSavedPlace(places, result)); }}
                    onShare={() => { const place = publicPlace(result); if (place) void sharePlace(place); }}
                    onLibrary={() => { setSharedPlace(null); setLibraryVisible(true); }}
                    onPromotionRetry={() => {
                      promotionAttemptedSessionRef.current = null;
                      setPromotionRetryNonce((value) => value + 1);
                    }}
                    promotion={entryMode === 'promotion' ? resultPromotion : null}
                    result={result}
                    onHome={resetToIntro}
                    onMap={openMap}
                    onReview={openResultReview}
                    onSave={saveCard}
                    reviewRequesting={isResultReviewRequesting}
                    showReview={showResultReview}
                  />
                </SafeAnalyticsImpression>
                <ResultCardPngSource
                  ref={resultCardSvgRef}
                  result={result}
                />
              </>
            ) : null}
            {shouldShowBannerAd && !shouldDockQuestionBanner ? <BannerAd key={bannerAdKey} onUnavailable={hideUnavailableBanner} /> : null}
          </View>
        </ScrollView>
        {shouldDockQuestionBanner ? (
          <View style={styles.questionBannerDock}>
            <BannerAd key={bannerAdKey} onUnavailable={hideUnavailableBanner} />
          </View>
        ) : null}
        <Modal visible={libraryVisible} animationType="slide" onRequestClose={() => setLibraryVisible(false)}>
          <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.libraryContent}>
              {libraryVisible ? (
                <SafeAnalyticsImpression key={sharedPlace ? 'shared' : 'saved'} event={sharedPlace ? 'weekend_shared_place_view' : 'weekend_saved_places_view'}>
                  <Text style={styles.panelTitle}>{sharedPlace ? '친구가 공유한 여행지' : '찜한 여행지'}</Text>
                </SafeAnalyticsImpression>
              ) : null}
              <Text style={styles.panelCopy}>{sharedPlace ? '공유된 장소 정보예요. 운영 여부와 위치는 지도에서 확인해 주세요.' : '앱에 최대 20곳을 저장해요. 다시 볼 때는 추천 횟수를 사용하지 않아요.'}</Text>
              {!sharedPlace && savedPlaces.length === 0 ? <Text style={styles.panelCopy}>{savedPlacesReady ? '마음에 드는 추천 결과를 찜해 두세요.' : '찜 목록을 불러오고 있어요.'}</Text> : null}
              {(sharedPlace ? [sharedPlace] : savedPlaces).map(place => (
                <View key={placeKey(place)} style={styles.savedPlaceRow}>
                  <Text style={styles.savedPlaceTitle}>{place.place}</Text>
                  <Text style={styles.panelCopy}>{place.address || place.region}</Text>
                  <SafeAnalyticsPress event={sharedPlace ? 'weekend_shared_place_map_click' : 'weekend_saved_place_map_click'}>
                    <SecondaryButton label="지도에서 확인" onPress={() => { void openURL(publicPlaceMap(place)).catch(() => setPlaceMessage('지도를 열지 못했어요. 잠시 후 다시 시도해 주세요.')); }} />
                  </SafeAnalyticsPress>
                  {sharedPlace ? <SecondaryButton disabled={!savedPlacesReady} label={savedPlaces.some(p => placeKey(p) === placeKey(place)) ? '찜한 여행지' : '이 여행지 찜하기'} onPress={() => updateSavedPlaces(places => addSavedPlace(places, place))} /> : <SecondaryButton label="찜 해제" onPress={() => updateSavedPlaces(places => places.filter(p => placeKey(p) !== placeKey(place)))} />}
                </View>
              ))}
              {placeMessage ? <Text accessibilityLiveRegion="polite" style={styles.resultMessage}>{placeMessage}</Text> : null}
              <PrimaryButton disabled={isUsageLoading || !isIntroReady} label="내 취향으로 새 추천 받기" onPress={() => { setLibraryVisible(false); resetToIntro({ refresh: false }); startFromIntro(); }} />
              <SecondaryButton label="닫기" onPress={() => setLibraryVisible(false)} />
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </TDSProvider>
  );
}

function Header({ counter }: { counter: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <Image source={LOGO_IMAGE} style={styles.logo} />
        <Text style={styles.brandName}>주말어디</Text>
      </View>
      <Text style={styles.counter}>{counter}</Text>
    </View>
  );
}

function IntroLoadingScreen({ entryMode }: { entryMode: WheregoEntryMode }) {
  return (
    <View style={styles.initialLoadingScreen}>
      <Image source={LOGO_IMAGE} style={styles.initialLoadingLogo} />
      <Text style={styles.initialLoadingBrand}>주말어디</Text>
      <ActivityIndicator color="#2B84FC" size="large" />
      <Text style={styles.initialLoadingText}>
        {entryMode === 'promotion'
          ? '혜택과 추천 횟수를 확인하고 있어요.'
          : '추천 횟수를 확인하고 있어요.'}
      </Text>
    </View>
  );
}

function rechargeAdButtonLabel(
  status: RewardAdStatus,
  limitReached: boolean,
  granting: boolean,
  hasCredit = false,
) {
  if (limitReached) return '오늘 광고 충전 완료';
  if (granting) return '추천 횟수 반영 중';
  if (status === 'unsupported') return '토스 앱에서 광고 충전';
  if (status === 'idle' || status === 'loading') return '광고 준비 중';
  if (status === 'showing') return '광고 시청 중';
  if (status === 'error') return '광고 다시 준비하기';
  return hasCredit ? '광고 보고 추천 더 받기' : '광고 보고 추천받기';
}

function IntroScreen({
  loading,
  message,
  onStart,
  usage,
}: {
  loading: boolean;
  message: string;
  onStart: () => void;
  usage: WheregoUsage | null;
}) {
  const usageLabel = recommendationUsageLabel(usage, loading);
  return (
    <View style={styles.introScreen}>
      <View style={styles.introHero}>
        <Pill label="한국관광공사 데이터 기반" />
        <View
          accessibilityLabel="바다, 숲길, 한옥 문화공간 여행 사진"
          accessible
          style={styles.introGallery}
        >
          <View style={[styles.introPhotoFrame, styles.introPhotoSide]}>
            <Image fadeDuration={0} source={INTRO_COAST_SOURCE} style={styles.introPhoto} />
          </View>
          <View style={[styles.introPhotoFrame, styles.introPhotoMain]}>
            <Image fadeDuration={0} source={INTRO_FOREST_SOURCE} style={styles.introPhoto} />
          </View>
          <View style={[styles.introPhotoFrame, styles.introPhotoSide]}>
            <Image fadeDuration={0} source={INTRO_CULTURE_SOURCE} style={styles.introPhoto} />
          </View>
        </View>
        <Text style={styles.introTitle}>이번 주말 어디 갈까?{`\n`}취향에 맞는 한 곳.</Text>
        <Text style={styles.introCopy}>
          6가지 선택으로 AI 추천을 받고{`\n`}친구와 함께 갈 곳을 정해 보세요.
        </Text>
        <View style={styles.usageBadge}>
          {loading ? <ActivityIndicator color="#1E63D6" size="small" /> : null}
          <Text style={styles.usageBadgeText}>{usageLabel}</Text>
        </View>
        {message ? <Text style={styles.usageMessage}>{message}</Text> : null}
      </View>
      <View style={styles.introActions}>
        <Text style={styles.adDisclosure}>매일 첫 추천은 광고 없이, 이후에는 광고마다 추천 1회.</Text>
        <PrimaryButton
          disabled={loading}
          label={loading ? 'AI 추천 준비 중' : 'AI 추천 시작하기'}
          loading={loading}
          onPress={onStart}
        />
      </View>
    </View>
  );
}

function PromotionIntroScreen({
  loading,
  message,
  onStart,
  usage,
}: {
  loading: boolean;
  message: string;
  onStart: () => void;
  usage: WheregoUsage | null;
}) {
  const usageLabel = recommendationUsageLabel(usage, loading);

  return (
    <View style={styles.introScreen}>
      <View style={styles.introHero}>
        <Pill label="토스 혜택 전용" />
        <View
          accessibilityLabel="바다, 숲길, 한옥 문화공간 여행 사진"
          accessible
          style={styles.introGallery}
        >
          <View style={[styles.introPhotoFrame, styles.introPhotoSide]}>
            <Image fadeDuration={0} source={INTRO_COAST_SOURCE} style={styles.introPhoto} />
          </View>
          <View style={[styles.introPhotoFrame, styles.introPhotoMain]}>
            <Image fadeDuration={0} source={INTRO_FOREST_SOURCE} style={styles.introPhoto} />
          </View>
          <View style={[styles.introPhotoFrame, styles.introPhotoSide]}>
            <Image fadeDuration={0} source={INTRO_CULTURE_SOURCE} style={styles.introPhoto} />
          </View>
        </View>
        <Text style={styles.introTitle}>AI 여행지 추천받고{`\n`}토스 포인트도 받아요.</Text>
        <Text style={styles.introCopy}>
          취향에 맞는 여행지 한 곳을 확인하면{`\n`}토스 포인트를 바로 지급해요.
        </Text>
        <Text style={styles.adDisclosure}>매일 첫 추천은 광고 없이, 이후에는 광고마다 추천 1회.</Text>
        <View style={styles.promotionBenefitBox}>
          <View style={styles.promotionBenefitHeading}>
            <Text style={styles.promotionBenefitLabel}>참여 혜택</Text>
            <Text style={styles.promotionBenefitAmount}>{WHEREGO_RESULT_PROMOTION_AMOUNT}원</Text>
          </View>
          <Text style={styles.promotionBenefitTitle}>토스 포인트 즉시 지급</Text>
          <Text style={styles.promotionBenefitCaption}>1인 1회 · 프로모션은 사전 고지 없이 종료될 수 있어요.</Text>
        </View>
        <View style={styles.usageBadge}>
          {loading ? <ActivityIndicator color="#1E63D6" size="small" /> : null}
          <Text style={styles.usageBadgeText}>{usageLabel}</Text>
        </View>
        {message ? <Text style={styles.usageMessage}>{message}</Text> : null}
      </View>
      <View style={styles.introActions}>
        <PrimaryButton
          disabled={loading}
          label={loading ? '혜택 참여 준비 중' : '혜택 받고 추천 시작하기'}
          loading={loading}
          onPress={onStart}
        />
      </View>
    </View>
  );
}

function QuotaScreen({
  adStatus,
  granting,
  rewardPending,
  onRetryReward,
  message,
  onBack,
  onShare,
  onStart,
  onWatchAd,
  onRefreshUsage,
  refreshingUsage,
  shareReady,
  usage,
}: {
  adStatus: RewardAdStatus;
  granting: boolean;
  rewardPending: boolean;
  onRetryReward: () => void;
  message: string;
  onBack: () => void;
  onShare: () => void;
  onStart: () => void;
  onWatchAd: () => void;
  onRefreshUsage: () => void;
  refreshingUsage: boolean;
  shareReady: boolean;
  usage: WheregoUsage | null;
}) {
  const hasCredit = (usage?.remaining || 0) > 0;
  const adLimitReached = adRewardLimitReached(usage);
  const shareUnavailable = !shareReady || Boolean(usage?.shareRewardUsed);
  const adButtonLabel = rechargeAdButtonLabel(adStatus, adLimitReached, granting, hasCredit);
  const shareButtonLabel = !shareReady
    ? '공유 리워드 준비 중'
    : usage?.shareRewardUsed
      ? '오늘 공유 보상 완료'
      : '친구에게 공유하고 3회 받기';

  return (
    <View style={styles.centerScreen}>
      <View style={styles.panelCentered}>
        <Pill label="선택 완료" />
        <Text style={styles.panelTitle}>
          {hasCredit
            ? `추천 ${usage?.remaining || 0}회가 준비됐어요.`
            : '광고 보고 추천받아요.'}
        </Text>
        <Text style={styles.panelCopy}>
          매일 첫 추천은 광고 없이, 이후에는 광고를 볼 때마다 1회씩 계속 추천받을 수 있어요.
        </Text>
        <View style={styles.quotaSummary}>
          <Text style={styles.quotaSummaryText}>{usage == null ? '추천 횟수 확인 중' : usage.adRewardsLimit === null ? '광고 추천 횟수 제한 없음' : `광고 보상 ${usage.adRewardsUsed} / ${usage.adRewardsLimit}`}</Text>
          <Text style={styles.quotaSummaryText}>공유 보상 {usage?.shareRewardUsed ? '완료' : '미사용'}</Text>
          {usagePaidCredits(usage) > 0 ? <Text style={styles.quotaSummaryText}>기존 이용권 {usagePaidCredits(usage)}회</Text> : null}
        </View>
        {message ? <Text style={styles.rewardStatus}>{message}</Text> : null}
        {hasCredit ? (
          <View style={styles.quotaStartAction}>
            <PrimaryButton disabled={granting || adStatus === 'showing'} label="선택한 답변으로 추천받기" onPress={onStart} />
          </View>
        ) : null}
        <Text style={styles.quotaRewardHeading}>추천 더 받기</Text>
        <View style={styles.quotaActions}>
          {rewardPending ? (
            <PrimaryButton
              disabled={granting || adStatus === 'showing'}
              loading={granting}
              label="보상 반영 다시 시도"
              onPress={onRetryReward}
            />
          ) : (
            <PrimaryButton
              disabled={
                adLimitReached ||
                adStatus === 'unsupported' ||
                adStatus === 'idle' ||
                adStatus === 'loading' ||
                adStatus === 'showing' ||
                granting
              }
              label={adButtonLabel}
              loading={adStatus === 'idle' || adStatus === 'loading' || granting}
              onPress={onWatchAd}
            />
          )}
          {adLimitReached ? (
            <SecondaryButton disabled={refreshingUsage} loading={refreshingUsage} label="최신 추천 횟수 확인" onPress={onRefreshUsage} />
          ) : null}
          <SecondaryButton disabled={shareUnavailable || granting || rewardPending} label={shareButtonLabel} onPress={onShare} />
          <SecondaryButton label="처음으로 돌아가기" onPress={onBack} viewStyle={styles.quotaBackButton} />
        </View>
      </View>
    </View>
  );
}

function OriginScreen({
  locationStatus,
  onSelectRegion,
  onUseCurrentLocation,
  preparingQuestions,
  waitingForLocation,
}: {
  locationStatus: string;
  onSelectRegion: (origin: Origin) => void | Promise<void>;
  onUseCurrentLocation: () => void;
  preparingQuestions: boolean;
  waitingForLocation: boolean;
}) {
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);

  function selectRegion(region: Origin) {
    setIsRegionModalOpen(false);
    onSelectRegion(region);
  }

  if (preparingQuestions) {
    return (
      <View style={styles.centerScreen}>
        <View style={styles.panelCentered}>
          <Pill label="질문지 생성" />
          <View style={styles.questionSetLoadingIcon}>
            <ActivityIndicator color="#2B84FC" size="large" />
          </View>
          <Text style={styles.panelTitle}>질문지를 생성할게요.</Text>
          <Text style={styles.panelCopy}>출발지와 추천 기준에 맞춰 질문을 고르는 중입니다.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.centerScreen}>
      <View style={styles.panel}>
        <Pill label="위치 기반 추천" />
        <Text style={styles.panelTitle}>어디에서 출발하세요?</Text>
        <Text style={styles.panelCopy}>
          현재 위치는 출발 기준과 근교 후보 계산에만 사용하고 저장하지 않아요. 위치 권한 없이도 지역을 골라서 시작할 수 있어요.
        </Text>
        <View style={styles.actionStack}>
          <PrimaryButton
            disabled={waitingForLocation || preparingQuestions}
            label={preparingQuestions ? '질문 준비 중' : waitingForLocation ? '위치 확인 중' : '현재 위치로 추천'}
            loading={waitingForLocation || preparingQuestions}
            onPress={onUseCurrentLocation}
          />
          <Pressable
            accessibilityLabel="지역 직접 선택"
            accessibilityRole="button"
            disabled={preparingQuestions}
            style={({ pressed }) => [
              styles.originRegionButton,
              pressed && !preparingQuestions ? styles.cardPressed : null,
              preparingQuestions ? styles.originRegionButtonDisabled : null,
            ]}
            onPress={() => setIsRegionModalOpen(true)}
          >
            <Text style={styles.originRegionButtonText}>지역 직접 선택</Text>
          </Pressable>
        </View>
        <Text style={styles.statusText}>
          {locationStatus || '현재 위치 권한은 버튼을 누른 뒤에만 요청돼요.'}
        </Text>
      </View>
      <RegionPickerModal
        onClose={() => setIsRegionModalOpen(false)}
        onSelectRegion={selectRegion}
        visible={isRegionModalOpen}
      />
    </View>
  );
}

function RegionPickerModal({
  onClose,
  onSelectRegion,
  visible,
}: {
  onClose: () => void;
  onSelectRegion: (origin: Origin) => void;
  visible: boolean;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.regionModalBackdrop}>
        <Pressable accessibilityLabel="지역 선택 닫기" style={styles.regionModalDismissArea} onPress={onClose} />
        <View style={styles.regionSheet}>
          <View style={styles.regionSheetHandle} />
          <View style={styles.regionSheetHeader}>
            <View style={styles.regionSheetTitleGroup}>
              <Text style={styles.regionSheetTitle}>출발 지역 선택</Text>
              <Text style={styles.regionSheetCopy}>전국 권역 중 하나를 고르면 바로 질문이 시작됩니다.</Text>
            </View>
            <TDSButton
              display="inline"
              onPress={onClose}
              size="tiny"
              style="weak"
              type="light"
              viewStyle={styles.regionCloseButton}
            >
              닫기
            </TDSButton>
          </View>
          <ScrollView contentContainerStyle={styles.regionGrid} showsVerticalScrollIndicator={false}>
            {regionOptions.map((region) => (
              <Pressable
                accessibilityLabel={`${region.label}, ${region.description}`}
                accessibilityRole="button"
                key={region.label}
                style={({ pressed }) => [styles.regionButton, pressed ? styles.cardPressed : null]}
                onPress={() => onSelectRegion(region)}
              >
                <Text style={styles.regionName}>{region.label}</Text>
                <Text style={styles.regionDesc}>{region.description}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function QuestionScreen({
  advancing,
  onChoose,
  origin,
  question,
  selectedOptionLabel,
}: {
  advancing: boolean;
  onChoose: (option: Option) => void;
  origin: Origin | null;
  question: Question;
  selectedOptionLabel: string | null;
}) {
  const optionRows = chunkOptions(question.options, 2);

  return (
    <View style={styles.questionScreen}>
      <Text style={styles.originChip}>출발 기준: {origin?.label || '지역 미선택'}</Text>
      <Text style={styles.eyebrow}>{question.eyebrow}</Text>
      <Text style={styles.questionTitle}>{question.question}</Text>
      <View style={styles.optionRows}>
        {optionRows.map((row, rowIndex) => (
          <View key={`${question.id}-${rowIndex}`} style={styles.optionRow}>
            {row.map((option, columnIndex) => {
              const optionIndex = rowIndex * 2 + columnIndex;
              return (
                <OptionCard
                  key={option.label}
                  columnIndex={columnIndex}
                  disabled={advancing}
                  layout={question.layout}
                  number={optionIndex + 1}
                  onPress={() => onChoose(option)}
                  option={option}
                  selected={selectedOptionLabel === option.label}
                />
              );
            })}
          </View>
        ))}
      </View>
      {advancing ? (
        <View style={styles.questionLoadingBox}>
          <ActivityIndicator color="#2B84FC" size="small" />
          <Text style={styles.questionLoadingText}>다음 질문을 준비하고 있어요.</Text>
        </View>
      ) : null}
    </View>
  );
}

function OptionCard({
  columnIndex,
  disabled,
  layout,
  number,
  onPress,
  option,
  selected,
}: {
  columnIndex: number;
  disabled: boolean;
  layout: QuestionLayout;
  number: number;
  onPress: () => void;
  option: Option;
  selected: boolean;
}) {
  const toneStyle = optionToneStyles[(number - 1) % optionToneStyles.length];
  const accentStyle = optionAccentStyles[(number - 1) % optionAccentStyles.length];

  return (
    <Pressable
      accessibilityLabel={`${number}번 선택지, ${option.label}`}
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.optionCard,
        toneStyle,
        layout === 'four' ? styles.optionCardGrid : styles.optionCardStack,
        styles.optionCardHalf,
        columnIndex > 0 ? styles.optionCardRight : null,
        selected ? styles.optionCardSelected : null,
        disabled && !selected ? styles.optionCardDisabled : null,
        pressed ? styles.cardPressed : null,
      ]}
      onPress={onPress}
    >
      <View style={[styles.optionAccent, accentStyle]} />
      <View style={styles.optionIndexBadge}>
        <Text style={styles.optionIndex}>{number}</Text>
      </View>
      <View style={styles.optionTextBox}>
        <Text adjustsFontSizeToFit minimumFontScale={0.86} numberOfLines={2} style={styles.optionLabel}>
          {option.label}
        </Text>
      </View>
    </Pressable>
  );
}

function RewardGate({
  adFreeNext,
  rewardedCreditNext,
  errorCode,
  hasRewardAccess,
  message,
  onRestartQuestions,
  onRetryRecommendation,
  onWatchAd,
  paidCreditNext,
  recommendationStatus,
  status,
}: {
  adFreeNext: boolean;
  rewardedCreditNext: boolean;
  errorCode: string | null;
  hasRewardAccess: boolean;
  message: string;
  onRestartQuestions: () => void;
  onRetryRecommendation: () => void;
  onWatchAd: () => void;
  paidCreditNext: boolean;
  recommendationStatus: RecommendationStatus;
  status: RewardAdStatus;
}) {
  const needsAd = !paidCreditNext && !adFreeNext && !rewardedCreditNext;
  const isAdLoading = needsAd && status === 'loading';
  const isRecommendationLoading = recommendationStatus === 'loading';
  const isRecommendationError = recommendationStatus === 'error';
  const hasNoPlaceCandidates = errorCode === 'wherego_no_place_candidates';
  const isRecommendationDone = recommendationStatus === 'ready';
  const hasStartedRecommendation = recommendationStatus !== 'idle';

  if (hasRewardAccess && !isRecommendationError) {
    return (
      <AiRecommendationLoading
        done={isRecommendationDone}
        message={message}
      />
    );
  }

  const isButtonDisabled =
    (needsAd && (status === 'loading' || status === 'showing')) ||
    (hasRewardAccess && !isRecommendationError);
  const buttonLabel = isRecommendationError
    ? hasNoPlaceCandidates
      ? '조건을 바꿔 다시 선택'
      : '추천 다시 시도'
    : hasRewardAccess
      ? '추천 마무리 중'
      : paidCreditNext
        ? '이용권으로 결과 보기'
        : adFreeNext
          ? '오늘 첫 추천 무료로 보기'
        : rewardedCreditNext
          ? '광고 확인 완료 · 결과 보기'
        : rewardButtonLabel(status, isRecommendationLoading);
  const pillLabel = isRecommendationError
    ? hasNoPlaceCandidates
      ? '조건 조정 필요'
      : '추천 재시도 필요'
    : isRecommendationDone
      ? '추천 준비 완료'
      : hasStartedRecommendation
        ? 'AI 추천 준비'
        : '결과 확인 전';
  const title = isRecommendationError
    ? hasNoPlaceCandidates
      ? '조건을 조금 바꿔볼까요?'
      : '추천을 다시 시도해주세요.'
    : isRecommendationDone
    ? '추천 카드 준비가 끝났어요.'
    : hasStartedRecommendation
      ? 'AI가 맞춤 여행지를 고르고 있어요.'
      : paidCreditNext
        ? '광고 없이 맞춤 여행지를 추천해드려요.'
        : adFreeNext
          ? '오늘 첫 추천을 무료로 준비해드려요.'
        : rewardedCreditNext
          ? '확인한 광고로 맞춤 여행지를 추천해드려요.'
        : '짧은 광고 후 맞춤 여행지를 추천해드려요.';
  const copy = isRecommendationError
    ? hasNoPlaceCandidates
      ? '출발지는 그대로 두고 새 질문을 고를 수 있어요. 확인한 광고는 다시 보지 않아도 돼요.'
      : '선택한 답변은 유지했어요. 잠시 후 다시 시도해 주세요.'
    : isRecommendationDone
    ? '추천 카드와 지도 연결을 바로 열어드릴게요.'
    : isAdLoading
      ? '광고를 준비하고 있어요. 잠시만 기다려 주세요.'
    : hasStartedRecommendation
      ? '한국관광공사 관광정보와 방문자수 데이터를 비교해 결과 카드를 만들고 있어요.'
      : paidCreditNext
        ? '보유한 AI 추천 이용권 1회를 사용해 바로 추천 카드를 만들어요.'
        : adFreeNext
          ? '긴 광고 없이 AI가 여행지 한 곳을 골라드려요.'
        : rewardedCreditNext
          ? '광고를 다시 보지 않고 AI 추천 카드를 만들어요.'
        : '짧은 광고를 확인하면 AI가 관광정보와 방문자수 데이터를 비교해 추천 카드를 만들어요.';

  return (
    <View style={styles.centerScreen}>
      <View style={styles.panelCentered}>
        <Pill label={pillLabel} />
        <Text style={styles.panelTitle}>{title}</Text>
        <Text style={styles.panelCopy}>{copy}</Text>
        {isAdLoading || isRecommendationLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#2B84FC" size="small" />
            <Text style={styles.loadingText}>
              {isAdLoading
                ? '짧은 광고를 준비하고 있어요.'
                : 'AI가 관광정보와 방문자수 데이터를 비교하고 있어요.'}
            </Text>
          </View>
        ) : null}
        {message ? <Text style={styles.rewardStatus}>{message}</Text> : null}
        <PrimaryButton
          disabled={isButtonDisabled}
          label={buttonLabel}
          onPress={
            isRecommendationError
              ? hasNoPlaceCandidates
                ? onRestartQuestions
                : onRetryRecommendation
              : onWatchAd
          }
        />
      </View>
    </View>
  );
}

function AiRecommendationLoading({ done, message }: { done: boolean; message: string }) {
  const steps = [
    { label: '관광정보 후보 확인', done: true },
    { label: '방문자수 신호 비교', done: true },
    { label: 'AI 최종 장소 선택', done },
  ];

  return (
    <View style={styles.centerScreen}>
      <View style={styles.aiLoadingPanel}>
        <Pill label="AI 추천 분석" />
        <View style={styles.aiLoadingIcon}>
          <ActivityIndicator color="#2B84FC" size="large" />
        </View>
        <Text style={styles.panelTitle}>AI가 최종 여행지를 고르고 있어요.</Text>
        <Text style={styles.panelCopy}>
          준비된 관광정보 후보와 방문자수 데이터를 비교해서 결과 카드를 만들고 있습니다.
        </Text>
        <View style={styles.aiStepList}>
          {steps.map((step) => (
            <View key={step.label} style={styles.aiStepRow}>
              <View style={[styles.aiStepDot, step.done ? styles.aiStepDotDone : null]}>
                <Text style={[styles.aiStepDotText, step.done ? styles.aiStepDotTextDone : null]}>
                  {step.done ? '✓' : ''}
                </Text>
              </View>
              <Text style={[styles.aiStepText, step.done ? styles.aiStepTextDone : null]}>{step.label}</Text>
            </View>
          ))}
        </View>
        {message ? <Text style={styles.rewardStatus}>{message}</Text> : null}
      </View>
    </View>
  );
}

function ResultScreen({
  bookmarked,
  bookmarkReady,
  sharing,
  onBookmark,
  onShare,
  onLibrary,
  message,
  onHome,
  onMap,
  onPromotionRetry,
  onReview,
  onSave,
  promotion,
  reviewRequesting,
  result,
  showReview,
}: {
  bookmarked: boolean;
  bookmarkReady: boolean;
  sharing: boolean;
  onBookmark: () => void;
  onShare: () => void;
  onLibrary: () => void;
  message: string;
  onHome: () => void;
  onMap: () => void;
  onPromotionRetry: () => void;
  onReview: () => void;
  onSave: () => void;
  promotion: ResultPromotionOutcome | null;
  reviewRequesting: boolean;
  result: DemoResult;
  showReview: boolean;
}) {
  const locationText = resultLocationText(result);
  const [officialImageFailed, setOfficialImageFailed] = useState(false);
  const showOfficialImage = Boolean(result.imageUrl) && !officialImageFailed;

  useEffect(() => {
    setOfficialImageFailed(false);
  }, [result.imageUrl]);

  return (
    <View style={styles.resultScreen}>
      <ResultPromotionNotice onRetry={onPromotionRetry} outcome={promotion} />
      <View style={styles.resultCard}>
        <View style={styles.resultArt}>
          {showOfficialImage ? (
            <Image
              onError={() => setOfficialImageFailed(true)}
              source={{ uri: result.imageUrl }}
              style={styles.resultImage}
            />
          ) : (
            <View style={styles.resultImagePlaceholder}>
              <Image source={resultPlaceholderImage(result)} style={styles.resultPlaceholderImage} />
              <View style={styles.resultImagePlaceholderNotice}>
                <Text style={styles.resultImagePlaceholderText}>{RESULT_PLACEHOLDER_BADGE_LABEL}</Text>
              </View>
            </View>
          )}
        </View>
        {showOfficialImage && result.imageAttribution ? (
          <Text style={styles.imageAttributionCaption}>사진 출처 · {result.imageAttribution}</Text>
        ) : null}
        <View style={styles.resultBody}>
          <Text style={styles.persona}>{result.persona}</Text>
          <Text style={styles.place}>{result.place}</Text>
          <Text style={styles.reason}>{result.reason}</Text>
          <AiDecision result={result} />
          <View style={styles.locationSummaryBox}>
            <Text style={styles.locationSummaryLabel}>위치</Text>
            <Text style={styles.locationSummaryText}>{locationText}</Text>
          </View>
          <SafeAnalyticsPress event="weekend_place_share_click">
            <PrimaryButton disabled={sharing} loading={sharing} label="친구에게 여기 어때?" onPress={onShare} viewStyle={styles.resultShareButton} />
          </SafeAnalyticsPress>
          <Text adjustsFontSizeToFit minimumFontScale={0.85} numberOfLines={1} style={styles.resultShareDisclosure}>장소 이름과 주소만 공유해요.</Text>
          <SafeAnalyticsPress event="weekend_place_bookmark_click">
            <SecondaryButton disabled={!bookmarkReady || bookmarked} label={bookmarked ? '찜한 여행지에 저장됨' : '이 여행지 찜하기'} onPress={onBookmark} />
          </SafeAnalyticsPress>
          <View style={styles.resultActions}>
            <SafeAnalyticsPress event="weekend_card_save_click">
              <SecondaryButton grow label="카드 저장하기" onPress={onSave} />
            </SafeAnalyticsPress>
            <SafeAnalyticsPress event="weekend_map_click">
              <SecondaryButton grow label="지도 열기" onPress={onMap} />
            </SafeAnalyticsPress>
          </View>
          {message ? <Text style={styles.resultMessage}>{message}</Text> : null}
        </View>
      </View>
      {showReview ? (
        <View style={styles.resultReviewPrompt}>
          <Text style={styles.resultReviewTitle}>추천이 마음에 들었나요?</Text>
          <Text style={styles.resultReviewCopy}>
            주말어디를 계속 개선할 수 있게 리뷰를 남겨주세요.
          </Text>
          <PrimaryButton
            label="리뷰 남기기"
            loading={reviewRequesting}
            onPress={onReview}
            viewStyle={styles.resultReviewButton}
          />
        </View>
      ) : null}
      <SecondaryButton label="찜한 여행지 보기" onPress={onLibrary} viewStyle={styles.homeButton} />
      <SecondaryButton label="처음으로 돌아가기" onPress={onHome} viewStyle={styles.homeButton} />
    </View>
  );
}

function ResultPromotionNotice({
  onRetry,
  outcome,
}: {
  onRetry: () => void;
  outcome: ResultPromotionOutcome | null;
}) {
  if (outcome == null || outcome.status === 'alreadyGranted') {
    return null;
  }

  const statusText = resultPromotionStatusText(outcome);
  const isTestPromotion = WHEREGO_RESULT_PROMOTION_CODE.startsWith('TEST_');

  return (
    <View style={styles.resultPromotionNotice}>
      <View style={styles.resultPromotionHeading}>
        <Text style={styles.resultPromotionLabel}>
          {isTestPromotion ? '프로모션 테스트' : '결과 확인 혜택'}
        </Text>
        {outcome.status === 'loading' ? <ActivityIndicator color="#3182F6" size="small" /> : null}
      </View>
      <Text style={styles.resultPromotionTitle}>토스 포인트 {WHEREGO_RESULT_PROMOTION_AMOUNT}원</Text>
      <Text style={styles.resultPromotionStatus}>{statusText}</Text>
      <Text style={styles.resultPromotionCaption}>
        {isTestPromotion
          ? '테스트 코드는 실제 토스 포인트를 지급하지 않아요.'
          : '추천 결과를 처음 확인하면 즉시 지급 · 1인 1회'}
      </Text>
      {!isTestPromotion ? (
        <Text style={styles.resultPromotionCaption}>본 프로모션은 사전 고지 없이 중단될 수 있어요.</Text>
      ) : null}
      {outcome.status === 'error' && outcome.retryable ? (
        <SecondaryButton
          label="다시 확인하기"
          onPress={onRetry}
          viewStyle={styles.resultPromotionRetryButton}
        />
      ) : null}
    </View>
  );
}

function resultPromotionStatusText(outcome: ResultPromotionOutcome) {
  switch (outcome.status) {
    case 'idle':
    case 'loading':
      return '토스 포인트 지급을 확인하고 있어요.';
    case 'success':
      return `토스 포인트 ${WHEREGO_RESULT_PROMOTION_AMOUNT}원을 지급했어요.`;
    case 'alreadyGranted':
      return '이미 프로모션 혜택을 받았어요.';
    case 'unsupported':
      return '토스 앱 5.232.0 이상에서 혜택을 받을 수 있어요.';
    case 'error':
      return resultPromotionErrorText(outcome.errorCode);
  }
}

function resultPromotionErrorText(errorCode: string | undefined) {
  switch (errorCode) {
    case 'anon_key_required':
    case 'invalid_anon_key':
      return '토스앱에서 사용자 정보를 확인하지 못했어요.';
    case 'apps_in_toss_unavailable':
    case 'reward_key_missing':
      return '토스 포인트 지급 확인이 지연되고 있어요.';
    case 'promotion_code_mismatch':
      return '프로모션 정보를 확인하지 못했어요.';
    case '4100':
      return '프로모션 정보를 찾지 못했어요.';
    case '4109':
      return '현재 진행 중인 프로모션이 아니에요.';
    case '4110':
      return '일시적인 오류가 발생했어요. 다시 확인해주세요.';
    case '4112':
      return '프로모션 예산이 모두 사용됐어요.';
    default:
      return '토스 포인트를 지급하지 못했어요.';
  }
}

const ResultCardPngSource = React.forwardRef<
  Svg,
  {
    result: DemoResult;
  }
>(function ResultCardPngSource({ result }, ref) {
  const hasOfficialHeroImage = Boolean(result.imageUrl);
  const heroImageUri = result.imageUrl || resultPlaceholderImageUri(result);
  const placeLines = svgTextLines(result.place, 13, 2);
  const personaLines = svgTextLines(result.persona, 19, 2);
  const reasonLines = svgTextLines(result.reason, 25, 5);
  const locationLines = svgTextLines(resultLocationText(result), 25, 2);
  const factorLines = svgTextLines(resultCardFactorText(result), 30, 5);
  const heroTitleColor = '#FFFFFF';
  const heroPlaceColor = '#FFFFFF';
  const cardX = 135;
  const cardY = 64;
  const cardWidth = 810;
  const cardHeight = 1222;
  const contentX = cardX + 48;
  const contentWidth = cardWidth - 96;
  const placeholderBadgeWidth = 330;
  const placeholderBadgeX = cardX + cardWidth - placeholderBadgeWidth - 24;
  const locationTextY = locationLines.length > 1 ? 890 : 909;

  return (
    <View pointerEvents="none" style={styles.hiddenCardRenderer}>
      <Svg
        ref={ref}
        height={RESULT_CARD_IMAGE_HEIGHT}
        viewBox={`0 0 ${RESULT_CARD_IMAGE_WIDTH} ${RESULT_CARD_IMAGE_HEIGHT}`}
        width={RESULT_CARD_IMAGE_WIDTH}
      >
        <Defs>
          <ClipPath id="wherego-result-hero-clip">
            <Rect height={RESULT_CARD_HERO_HEIGHT} rx={48} width={cardWidth} x={cardX} y={cardY} />
          </ClipPath>
        </Defs>
        <Rect fill="#F5F7FA" height={RESULT_CARD_IMAGE_HEIGHT} width={RESULT_CARD_IMAGE_WIDTH} x={0} y={0} />
        <Rect fill="#FFFFFF" height={cardHeight} rx={48} width={cardWidth} x={cardX} y={cardY} />
        <Rect fill="none" height={cardHeight} rx={48} stroke="#E5E8EB" strokeWidth={2} width={cardWidth} x={cardX} y={cardY} />
        <G clipPath="url(#wherego-result-hero-clip)">
          <SvgImage
            height={RESULT_CARD_HERO_HEIGHT}
            href={{ uri: heroImageUri }}
            preserveAspectRatio="xMidYMid slice"
            width={cardWidth}
            x={cardX}
            y={cardY}
          />
          <Rect fill="#000000" height={RESULT_CARD_HERO_HEIGHT} opacity={0.28} width={cardWidth} x={cardX} y={cardY} />
          {!hasOfficialHeroImage ? (
            <>
              <Rect
                fill="#000000"
                height={34}
                opacity={0.58}
                rx={10}
                width={placeholderBadgeWidth}
                x={placeholderBadgeX}
                y={462}
              />
              <SvgText
                fill="#FFFFFF"
                fontFamily={RESULT_CARD_FONT_FAMILY}
                fontSize={18}
                fontWeight="700"
                x={placeholderBadgeX + 16}
                y={485}
              >
                {RESULT_PLACEHOLDER_BADGE_LABEL}
              </SvgText>
            </>
          ) : null}
        </G>
        {hasOfficialHeroImage && result.imageAttribution ? (
          <SvgText
            fill="#8B95A1"
            fontFamily={RESULT_CARD_FONT_FAMILY}
            fontSize={18}
            fontWeight="700"
            x={contentX}
            y={554}
          >
            사진 출처 · {result.imageAttribution}
          </SvgText>
        ) : null}
        <SvgText fill={heroTitleColor} fontFamily={RESULT_CARD_FONT_FAMILY} fontSize={34} fontWeight="800" x={contentX} y={150}>
          주말어디 추천 카드
        </SvgText>
        <SvgTextBlock color={heroPlaceColor} lineHeight={62} lines={placeLines} weight="800" x={contentX} y={234} />
        <SvgTextBlock color="#1E63D6" lineHeight={34} lines={personaLines} weight="800" x={contentX} y={588} />
        <SvgTextBlock color="#4E5968" lineHeight={32} lines={reasonLines} weight="700" x={contentX} y={652} />
        <Rect fill="#E5E8EB" height={2} width={contentWidth} x={contentX} y={828} />
        <Rect fill="#F9FAFB" height={86} rx={24} stroke="#E5E8EB" width={contentWidth} x={contentX} y={858} />
        <SvgText fill="#8B95A1" fontFamily={RESULT_CARD_FONT_FAMILY} fontSize={24} fontWeight="800" x={contentX + 34} y={909}>
          위치
        </SvgText>
        <SvgTextBlock color="#191F28" lineHeight={29} lines={locationLines} weight="800" x={contentX + 128} y={locationTextY} />
        <Rect fill="#F9FAFB" height={226} rx={28} stroke="#E5E8EB" width={contentWidth} x={contentX} y={974} />
        <SvgText fill="#1E63D6" fontFamily={RESULT_CARD_FONT_FAMILY} fontSize={27} fontWeight="800" x={contentX + 34} y={1024}>
          AI 선택 근거
        </SvgText>
        <SvgTextBlock color="#191F28" lineHeight={27} lines={factorLines} weight="700" x={contentX + 34} y={1070} />
      </Svg>
    </View>
  );
});

function SvgTextBlock({
  color,
  lineHeight,
  lines,
  weight,
  x,
  y,
}: {
  color: string;
  lineHeight: number;
  lines: string[];
  weight: string;
  x: number;
  y: number;
}) {
  return (
    <>
      {lines.map((line, index) => (
        <SvgText
          key={`${x}-${y}-${index}-${line}`}
          fill={color}
          fontFamily={RESULT_CARD_FONT_FAMILY}
          fontSize={Math.round(lineHeight * 0.78)}
          fontWeight={weight}
          x={x}
          y={y + index * lineHeight}
        >
          {line}
        </SvgText>
      ))}
    </>
  );
}

function AiDecision({ result }: { result: DemoResult }) {
  const highlights = result.whyThisPlace?.length ? result.whyThisPlace : result.aiFactors;
  if (!result.personaSummary && !highlights?.length) {
    return null;
  }

  return (
    <View style={styles.aiDecisionBox}>
      <Text style={styles.aiDecisionLabel}>AI 판단</Text>
      {result.personaSummary ? <Text style={styles.aiDecisionText}>{result.personaSummary}</Text> : null}
      {highlights?.length ? (
        <View style={styles.aiFactorList}>
          {highlights.slice(0, 4).map((factor) => (
            <Text key={factor} style={styles.aiFactorText}>· {factor}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function BannerAd({ onUnavailable }: { onUnavailable: () => void }) {
  return (
    <View style={styles.bannerAd}>
      <InlineAd
        adGroupId={BANNER_AD_GROUP_ID}
        onNoFill={onUnavailable}
        onAdFailedToRender={onUnavailable}
        impressFallbackOnMount
        theme="auto"
        tone="grey"
      />
    </View>
  );
}

function PrimaryButton({
  disabled,
  label,
  loading,
  onPress,
  viewStyle,
}: {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
  viewStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <TDSButton
      disabled={disabled}
      display="block"
      loading={loading}
      onPress={onPress}
      size="big"
      type="primary"
      viewStyle={[styles.primaryButton, disabled ? styles.disabledButton : null, viewStyle]}
    >
      {label}
    </TDSButton>
  );
}

function SecondaryButton({
  disabled,
  grow,
  label,
  loading,
  onPress,
  viewStyle,
}: {
  disabled?: boolean;
  grow?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
  viewStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <TDSButton
      disabled={disabled}
      display="block"
      loading={loading}
      onPress={onPress}
      size="large"
      style="weak"
      type="light"
      viewStyle={[
        styles.secondaryButton,
        grow ? styles.secondaryButtonGrow : null,
        disabled ? styles.disabledButton : null,
        viewStyle,
      ]}
    >
      {label}
    </TDSButton>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

function normalizeRemoteQuestions(questions: WheregoQuestion[]) {
  const normalized = questions
    .filter((question) => {
      return (
        (question.type === 'source' || question.type === 'general') &&
        question.id.length > 0 &&
        question.question.length > 0 &&
        Array.isArray(question.options) &&
        question.options.length >= 2
      );
    })
    .map((question): Question => {
      return {
        type: question.type,
        id: question.id,
        eyebrow: question.eyebrow || (question.type === 'source' ? '원천질문' : '취향'),
        question: question.question,
        subcopy: question.subcopy || '선택한 조건을 관광지 추천에 반영합니다.',
        layout: question.layout === 'four' ? 'four' : 'two',
        tags: question.tags || [],
        options: question.options.map((option) => {
          const searchHints = option.searchHints || [];
          return {
            key: option.key,
            label: option.label,
            caption: optionCaption(searchHints, option.caption),
            tags: option.tags || [],
            searchHints,
            constraints: option.constraints || {},
          };
        }),
      };
    });

  const sourceCount = normalized.filter((question) => question.type === 'source').length;
  const generalCount = normalized.filter((question) => question.type === 'general').length;
  const questionIds = normalized.map((question) => question.id);
  const themeKeys = normalized.map((question) => question.tags?.[0] || '');
  return normalized.length === SOURCE_QUESTION_COUNT + GENERAL_QUESTION_COUNT &&
    sourceCount === SOURCE_QUESTION_COUNT &&
    generalCount === GENERAL_QUESTION_COUNT &&
    questionIds.length === new Set(questionIds).size &&
    themeKeys.every(Boolean) &&
    themeKeys.length === new Set(themeKeys).size
    ? normalized
    : [];
}

function optionCaption(searchHints: string[], rawCaption?: string) {
  if (rawCaption !== undefined) {
    const explicitCaption = firstOptionCaptionSegment(rawCaption);
    return explicitCaption.length <= 10 ? explicitCaption : explicitCaption.slice(0, 10).trim();
  }
  const captionSegment = firstOptionCaptionSegment(rawCaption || '');
  const hintSegment = searchHints.map(firstOptionCaptionSegment).find(Boolean);
  const source = captionSegment || hintSegment || '추천 조건 반영';

  return source.length <= 10 ? source : source.slice(0, 10).trim();
}

function firstOptionCaptionSegment(value: string) {
  return (
    cleanOptionCaption(value)
      .split(/[·ㆍ•/|]/)
      .map((segment) => cleanOptionCaption(segment))
      .find(Boolean) || ''
  );
}

function cleanOptionCaption(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s*([·ㆍ•/|])\s*/g, ' $1 ')
    .replace(/[\s·ㆍ•/|]+$/g, '')
    .trim();
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items.filter((item) => item.length > 0)));
}

function chunkOptions(options: Option[], size: number) {
  const rows: Option[][] = [];
  for (let index = 0; index < options.length; index += size) {
    rows.push(options.slice(index, index + size));
  }
  return rows;
}

function createWheregoSessionId() {
  return `wherego-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function usageDailyRemaining(usage: WheregoUsage | null | undefined) {
  return usage?.dailyRemaining ?? usage?.remaining ?? 0;
}

function usageBaseRemaining(usage: WheregoUsage | null | undefined) {
  return usage?.baseRemaining ?? 0;
}

function usagePaidCredits(usage: WheregoUsage | null | undefined) {
  return usage?.paidCreditsRemaining ?? 0;
}

function parseStoredTossLoginSession(value: string | null): WheregoLoginSession | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as Partial<WheregoLoginSession>;
    const expiresAt = Date.parse(String(parsed.expiresAt || ''));
    if (
      typeof parsed.sessionToken !== 'string' ||
      parsed.sessionToken.length < 20 ||
      typeof parsed.anonymousUserKey !== 'string' ||
      !parsed.anonymousUserKey.startsWith('toss-login-') ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now() + 60_000
    ) {
      return null;
    }
    return {
      sessionToken: parsed.sessionToken,
      anonymousUserKey: parsed.anonymousUserKey,
      expiresAt: parsed.expiresAt as string,
    };
  } catch (_) {
    return null;
  }
}

function isWheregoLoginRequiredError(error: unknown) {
  return error instanceof WheregoApiError && error.code === 'wherego_login_required';
}

async function resolveAnonymousUserKey(): Promise<{ key: string; isTossHash: boolean }> {
  try {
    const result = await getAnonymousKey();
    if (result && result !== 'ERROR' && result.type === 'HASH') {
      return { key: result.hash, isTossHash: true };
    }
  } catch (_) {
    // Use an installation key when the anonymous-key bridge is unavailable.
  }

  try {
    const stored = await Storage.getItem(ANONYMOUS_STORAGE_KEY);
    if (stored) {
      return { key: stored, isTossHash: false };
    }
    const generated = `install-${createWheregoSessionId()}`;
    await Storage.setItem(ANONYMOUS_STORAGE_KEY, generated);
    return { key: generated, isTossHash: false };
  } catch (_) {
    return { key: `runtime-${createWheregoSessionId()}`, isTossHash: false };
  }
}

function nearestRegionLabel(nextOrigin: Origin | null) {
  if (nextOrigin == null || !Number.isFinite(nextOrigin.lat) || !Number.isFinite(nextOrigin.lng)) {
    return '서울/수도권';
  }

  return regionOptions
    .map((region) => ({
      label: region.label,
      distance: Math.hypot(nextOrigin.lat - region.lat, nextOrigin.lng - region.lng),
    }))
    .sort((a, b) => a.distance - b.distance)[0]?.label ?? '서울/수도권';
}

function currentLocationLabel(lat: number, lng: number) {
  const city = nearestCityLabel(lat, lng);
  return city == null ? '현재 위치' : `현재 위치(${city})`;
}

function nearestCityLabel(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return cityAnchors
    .map((city) => ({
      label: city.label,
      distance: distanceKm(lat, lng, city.lat, city.lng),
    }))
    .sort((a, b) => a.distance - b.distance)[0]?.label ?? null;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDemoResult(nextOrigin: Origin | null) {
  const fallback = demoResultsByRegion['서울/수도권'];
  if (fallback == null) {
    throw new Error('Default demo result is missing.');
  }

  const regionLabel = nextOrigin?.type === 'current_location' ? nearestRegionLabel(nextOrigin) : nextOrigin?.label;
  const result = demoResultsByRegion[regionLabel || '서울/수도권'] ?? fallback;
  return {
    ...result,
    isFallback: true,
    personaSummary: result.personaSummary || '답변에서 반복된 이동 거리, 동행, 분위기 조건을 함께 본 결과입니다.',
    aiFactors: result.aiFactors || ['답변 취향', '이동 부담', '방문자수 신호', '편의 정보'],
    aiTradeoff: result.aiTradeoff || '유명도보다 오늘 조건에 맞는 체류 편안함을 우선했습니다.',
    aiCrowdNote: result.aiCrowdNote || result.signal,
    whyThisPlace: result.whyThisPlace || [result.travel, result.signal, result.comfort],
  };
}

function getResult(nextOrigin: Origin | null, recommendation: WheregoRecommendation | null): DemoResult {
  const recommendedPlace = recommendation?.recommendedPlaces?.[0];
  if (recommendation != null && recommendedPlace != null) {
    return resultFromRecommendation(recommendation, recommendedPlace);
  }

  return getDemoResult(nextOrigin);
}

function resultFromRecommendation(
  recommendation: WheregoRecommendation,
  place: WheregoRecommendedPlace,
): DemoResult {
  return {
    persona: recommendation.personaTitle,
    personaSummary: recommendation.personaSummary,
    place: place.title,
    reason: place.aiReason || recommendation.oneLine,
    region: place.region || regionFromAddress(place.address),
    address: place.address || '주소 확인 필요',
    travel: travelText(place),
    signal: crowdText(place),
    comfort: comfortText(place),
    aiFactors: recommendation.aiDecision?.mainFactors,
    aiTradeoff: recommendation.aiDecision?.tradeoff,
    aiCrowdNote: recommendation.aiDecision?.crowdNote,
    whyThisPlace: place.whyThisPlace,
    overview: place.overview,
    imageUrl: place.imageUrl,
    imageAttribution: place.imageAttribution,
    source: place.source,
    ktoVerified: place.ktoVerified,
    imagePlaceholderTheme: place.imagePlaceholderTheme,
    imagePlaceholderThemeV2: place.imagePlaceholderThemeV2,
    isFallback: false,
    mapLink: place.mapLink,
  };
}

function resultPlaceholderImage(result: DemoResult) {
  return { uri: resultPlaceholderImageUri(result) };
}

function resultPlaceholderImageUri(result: DemoResult) {
  const explicitV2 = result.imagePlaceholderThemeV2;
  return (
    (explicitV2 == null ? undefined : RESULT_PLACEHOLDER_IMAGE_URIS[explicitV2]) ||
    RESULT_PLACEHOLDER_IMAGE_URIS[inferResultPlaceholderTheme(result)]
  );
}

function inferResultPlaceholderTheme(result: DemoResult): ResultImagePlaceholderTheme {
  const text = `${result.place} ${result.region} ${result.overview || ''}`;
  if (/온천|스파|웰니스|치유|명상|산림욕/.test(text)) {
    return 'wellness';
  }
  if (/사찰|산사|한옥|궁궐|서원|향교|유적|문화재|고택|전통마을/.test(text)) {
    return 'heritage';
  }
  if (/박물관|미술관|과학관|아쿠아리움|수족관|전시관|천문대|실내/.test(text)) {
    return 'indoor';
  }
  if (/레일바이크|카약|래프팅|유람선|카트|루지|레포츠|테마파크|놀이공원|체험|액티비티/.test(text)) {
    return 'activity';
  }
  if (/수목원|정원|식물원|꽃밭|꽃축제|온실|억새정원/.test(text)) {
    return 'garden';
  }
  if (/호수|강변|강가|수변|물가|습지|갈대|저수지|연못/.test(text)) {
    return 'waterside';
  }
  if (/바다|해변|해안|해수욕|섬|항구|갯벌/.test(text)) {
    return 'coast';
  }
  if (/캠핑|글램핑|피크닉|야영|차박|자전거/.test(text)) {
    return 'outdoor';
  }
  if (/전시|문화|역사|도시|전망대|건축/.test(text)) {
    return 'culture';
  }
  return result.imagePlaceholderTheme || 'nature';
}

function travelText(place: WheregoRecommendedPlace) {
  if (place.estimatedOneWayDriveMinutes != null) {
    return `예상 편도 ${place.estimatedOneWayDriveMinutes}분 · 약 ${place.estimatedRoadDistanceKm ?? '?'}km`;
  }

  return '이동 시간 확인 필요';
}

function crowdText(place: WheregoRecommendedPlace) {
  const crowd = place.crowd;
  if (crowd == null) {
    return '방문자수 데이터 확인 필요';
  }

  const baseDate = crowd.latestBaseYmd ? ` · ${crowd.latestBaseYmd}` : '';
  return `지역 방문자수 ${crowd.label || '확인 필요'}${baseDate}`;
}

function comfortText(place: WheregoRecommendedPlace) {
  const intro = place.intro || {};
  const values = [intro.parking, intro.useTime, intro.restDate].filter((value): value is string => {
    return typeof value === 'string' && value.trim().length > 0;
  });

  if (values.length === 0) {
    return '운영/주차 정보는 지도에서 확인';
  }

  return values.join(' · ').replace(/\s+/g, ' ').slice(0, 70);
}

function regionFromAddress(address: string) {
  return address.split(/\s+/).filter(Boolean).slice(0, 2).join(' ') || '지역 확인 필요';
}

function rewardGateMessage(
  adMessage: string,
  status: RecommendationStatus,
  errorCode: string | null,
) {
  const recommendationMessage =
    status === 'loading'
      ? 'AI가 한국관광공사 관광정보에서 후보를 고르는 중이에요.'
      : status === 'ready'
        ? '추천 카드 준비가 끝났어요.'
        : status === 'error' && errorCode !== 'wherego_no_place_candidates'
          ? '추천 요청이 완료되지 않았어요. 다시 시도해주세요.'
          : '';

  return [recommendationMessage, adMessage].filter(Boolean).join('\n');
}

function resultLocationText(result: DemoResult) {
  const address = cleanResultCardSentence(result.address);
  const region = cleanResultCardSentence(result.region.split(/[·•]/)[0] || result.region);

  if (address) {
    return address;
  }

  return region || '위치 확인 필요';
}

function resultCardFactorText(result: DemoResult) {
  const source = result.whyThisPlace?.length ? result.whyThisPlace : result.aiFactors || [];
  const cleanedFactors = source
    .flatMap((value) => value.split(/[·•]/))
    .map(cleanResultCardSentence)
    .filter(Boolean)
    .slice(0, 3);

  if (cleanedFactors.length > 0) {
    return cleanedFactors.join(', ');
  }

  return cleanResultCardSentence(result.overview || result.aiTradeoff || result.comfort || result.reason);
}

function cleanResultCardSentence(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[\s.:;,\-ㆍ·•]+/, '')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();
}

async function saveResultCard(result: DemoResult, cardRef: Svg | null): Promise<void> {
  const canSaveFile = isMinVersionSupported({
    android: '5.218.0',
    ios: '5.216.0',
  });

  if (!canSaveFile) {
    throw new Error('현재 토스 앱 버전은 이미지 저장을 지원하지 않아요.');
  }

  if (cardRef == null) {
    throw new Error('Result card renderer is not ready');
  }

  if (result.imageUrl) {
    await Image.prefetch(result.imageUrl).catch(() => undefined);
  }

  const pngBase64 = await captureResultCardPng(cardRef);
  await saveBase64Data({
    data: pngBase64,
    fileName: `wherego-${safeFileName(result.place)}.png`,
    mimeType: 'image/png',
  });
}

function captureResultCardPng(cardRef: Svg) {
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error('Timed out while rendering result card image'));
    }, 5000);

    try {
      cardRef.toDataURL(
        (base64) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timeout);
          const data = base64.replace(/^data:image\/png;base64,/, '');
          if (!data) {
            reject(new Error('Rendered result card image is empty'));
            return;
          }
          resolve(data);
        },
        { width: RESULT_CARD_IMAGE_WIDTH, height: RESULT_CARD_IMAGE_HEIGHT },
      );
    } catch (error) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      reject(error);
    }
  });
}

function svgTextLines(text: string, maxChars: number, maxLines: number) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  const words = normalized
    .split(' ')
    .flatMap((word) => {
      if (word.length <= maxChars) {
        return [word];
      }

      const chunks: string[] = [];
      for (let index = 0; index < word.length; index += maxChars) {
        chunks.push(word.slice(index, index + maxChars));
      }
      return chunks;
    });
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    if (!current) {
      current = word;
      return;
    }

    if (`${current} ${word}`.length <= maxChars) {
      current = `${current} ${word}`;
      return;
    }

    lines.push(current);
    current = word;
  });

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, maxLines).map((line, index) => {
    if (index < maxLines - 1 || lines.length <= maxLines) {
      return line;
    }
    return line.length > maxChars - 1 ? `${line.slice(0, maxChars - 1)}...` : line;
  });
}

function safeFileName(value: string) {
  const cleaned = value.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-').slice(0, 32);
  return cleaned || 'result-card';
}

function naverSearchLink(keyword: string) {
  return `https://map.naver.com/p/search/${encodeURIComponent(keyword)}`;
}

function rewardButtonLabel(status: RewardAdStatus, isRecommendationLoading = false) {
  if (status === 'loading') return '광고 준비 중';
  if (status === 'showing') return '광고 여는 중';
  if (status === 'unsupported') return '광고 지원 다시 확인';
  if (status === 'error') return '광고 다시 불러오기';
  return isRecommendationLoading ? '광고 보기' : '광고 보고 결과 보기';
}

function rewardAdLoadElapsedMs(startedAt: number | null) {
  return startedAt == null ? null : Date.now() - startedAt;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return '잠시 후 다시 시도해주세요.';
}

const cardBase: ViewStyle = {
  backgroundColor: '#FFFFFF',
  borderColor: '#E5E8EB',
  borderRadius: 14,
  borderWidth: 1,
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#F5F7FA',
  },
  phone: {
    flex: 1,
    paddingBottom: 18,
    paddingHorizontal: 20,
    paddingTop: 12,
    width: '100%',
  },
  phoneWithDockedBanner: {
    paddingBottom: 20,
  },
  initialLoadingScreen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 620,
    paddingBottom: 36,
  },
  initialLoadingLogo: {
    height: 72,
    marginBottom: 10,
    resizeMode: 'contain',
    width: 72,
  },
  initialLoadingBrand: {
    color: '#191F28',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 24,
  },
  initialLoadingText: {
    color: '#6B7684',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 16,
    textAlign: 'center',
  },
  hiddenCardRenderer: {
    height: RESULT_CARD_IMAGE_HEIGHT,
    left: 0,
    opacity: 0.01,
    position: 'absolute',
    top: 0,
    width: RESULT_CARD_IMAGE_WIDTH,
    zIndex: -1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 44,
    justifyContent: 'space-between',
  },
  brand: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  logo: {
    height: 30,
    marginRight: 9,
    resizeMode: 'contain',
    width: 30,
  },
  brandName: {
    color: '#191F28',
    fontSize: 18,
    fontWeight: '800',
  },
  counter: {
    color: '#8B95A1',
    fontSize: 13,
    fontWeight: '800',
  },
  progressTrack: {
    backgroundColor: '#E5E8EB',
    borderRadius: 999,
    height: 8,
    marginBottom: 16,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#2B84FC',
    borderRadius: 999,
    height: '100%',
  },
  centerScreen: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 520,
  },
  introScreen: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 620,
    paddingBottom: 24,
    paddingTop: 20,
  },
  introHero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingTop: 0,
  },
  introGallery: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    height: 158,
    justifyContent: 'center',
    marginTop: 18,
    width: '100%',
  },
  introPhotoFrame: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 3,
    elevation: 3,
    overflow: 'hidden',
    shadowColor: '#191F28',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  introPhotoSide: {
    height: 118,
    marginTop: 20,
    width: 82,
  },
  introPhotoMain: {
    height: 154,
    width: 132,
  },
  introPhoto: {
    height: '100%',
    resizeMode: 'cover',
    width: '100%',
  },
  promotionBenefitBox: {
    alignSelf: 'stretch',
    backgroundColor: '#F2F7FF',
    borderColor: '#C9DDFB',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  promotionBenefitHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  promotionBenefitLabel: {
    color: '#1E63D6',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  promotionBenefitAmount: {
    color: '#1E63D6',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
  },
  promotionBenefitTitle: {
    color: '#191F28',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    marginTop: 4,
  },
  promotionBenefitCaption: {
    color: '#6B7684',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 4,
  },
  panel: {
    ...cardBase,
    padding: 20,
  },
  panelCentered: {
    ...cardBase,
    alignItems: 'center',
    padding: 20,
  },
  aiLoadingPanel: {
    ...cardBase,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  aiLoadingIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(43, 132, 252, 0.08)',
    borderRadius: 999,
    height: 72,
    justifyContent: 'center',
    marginTop: 20,
    width: 72,
  },
  aiStepList: {
    alignSelf: 'stretch',
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E8EB',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  aiStepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 34,
  },
  aiStepDot: {
    alignItems: 'center',
    backgroundColor: '#E5E8EB',
    borderRadius: 999,
    height: 20,
    justifyContent: 'center',
    marginRight: 10,
    width: 20,
  },
  aiStepDotDone: {
    backgroundColor: '#2B84FC',
  },
  aiStepDotText: {
    color: '#8B95A1',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    textAlign: 'center',
  },
  aiStepDotTextDone: {
    color: '#FFFFFF',
  },
  aiStepText: {
    color: '#6B7684',
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  aiStepTextDone: {
    color: '#191F28',
  },
  questionSetLoadingIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(43, 132, 252, 0.08)',
    borderRadius: 999,
    height: 64,
    justifyContent: 'center',
    marginTop: 20,
    width: 64,
  },
  pill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(43, 132, 252, 0.1)',
    borderRadius: 999,
    minHeight: 28,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: {
    color: '#1E63D6',
    fontSize: 13,
    fontWeight: '800',
  },
  introTitle: {
    color: '#191F28',
    fontSize: 29,
    fontWeight: '800',
    lineHeight: 37,
    marginTop: 18,
    textAlign: 'center',
  },
  introCopy: {
    color: '#4E5968',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 18,
    marginTop: 10,
    textAlign: 'center',
  },
  introActions: {
    gap: 10,
    marginTop: 24,
    paddingTop: 0,
  },
  usageBadge: {
    alignItems: 'center',
    backgroundColor: '#EAF3FF',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  usageBadgeText: {
    color: '#1E63D6',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  usageMessage: {
    color: '#6B7684',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 10,
    textAlign: 'center',
  },
  panelTitle: {
    color: '#191F28',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    marginTop: 14,
    textAlign: 'center',
  },
  panelCopy: {
    color: '#4E5968',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 18,
    marginTop: 10,
    textAlign: 'center',
  },
  actionStack: {
    marginTop: 6,
  },
  quotaSummary: {
    alignSelf: 'stretch',
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E8EB',
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quotaSummaryText: {
    color: '#4E5968',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  quotaActions: {
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 8,
  },
  quotaStartAction: {
    alignSelf: 'stretch',
    marginTop: 12,
  },
  quotaRewardHeading: {
    alignSelf: 'stretch',
    color: '#4E5968',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 20,
  },
  quotaBackButton: {
    marginTop: 2,
  },
  originRegionButton: {
    ...cardBase,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  originRegionButtonDisabled: {
    opacity: 0.55,
  },
  originRegionButtonText: {
    color: '#191F28',
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    textAlign: 'center',
  },
  statusText: {
    color: '#1E63D6',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
    marginTop: 12,
  },
  regionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
    paddingBottom: 2,
  },
  regionButton: {
    ...cardBase,
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    margin: 5,
    minHeight: 76,
    paddingHorizontal: 12,
    paddingVertical: 12,
    width: '46.8%',
  },
  cardPressed: {
    borderColor: '#2B84FC',
    opacity: 0.82,
  },
  regionName: {
    color: '#191F28',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  regionDesc: {
    color: '#6B7684',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 4,
  },
  regionModalBackdrop: {
    backgroundColor: 'rgba(21, 28, 49, 0.42)',
    flex: 1,
    justifyContent: 'flex-end',
    paddingTop: 80,
  },
  regionModalDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  regionSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '82%',
    paddingBottom: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  regionSheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#D6DDEC',
    borderRadius: 999,
    height: 4,
    marginBottom: 12,
    width: 42,
  },
  regionSheetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  regionSheetTitleGroup: {
    flex: 1,
    paddingRight: 12,
  },
  regionSheetTitle: {
    color: '#191F28',
    fontSize: 22,
    fontWeight: '800',
  },
  regionSheetCopy: {
    color: '#6B7684',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 5,
  },
  regionCloseButton: {
    alignSelf: 'flex-start',
  },
  questionScreen: {
    paddingTop: 2,
  },
  originChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(43, 132, 252, 0.1)',
    borderRadius: 999,
    color: '#1E63D6',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  eyebrow: {
    color: '#1E63D6',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 7,
  },
  questionTitle: {
    color: '#191F28',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
  },
  optionRows: {
    marginTop: 16,
  },
  optionRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  optionCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingBottom: 14,
    paddingHorizontal: 13,
    paddingTop: 28,
  },
  optionCardStack: {
    height: 156,
  },
  optionCardGrid: {
    height: 138,
  },
  optionCardHalf: {
    flex: 1,
    minWidth: 0,
  },
  optionCardRight: {
    marginLeft: 12,
  },
  optionCardSelected: {
    borderColor: '#2B84FC',
    borderWidth: 2,
  },
  optionCardDisabled: {
    opacity: 0.58,
  },
  optionToneBlue: {
    backgroundColor: '#EAF3FF',
    borderColor: '#B8D8FF',
  },
  optionToneGreen: {
    backgroundColor: '#EAF8F1',
    borderColor: '#B9E6CF',
  },
  optionToneYellow: {
    backgroundColor: '#FFF6DF',
    borderColor: '#FFE1A3',
  },
  optionTonePurple: {
    backgroundColor: '#F4F0FF',
    borderColor: '#D7CBFF',
  },
  optionAccent: {
    borderRadius: 999,
    height: 7,
    left: 14,
    position: 'absolute',
    top: 14,
    width: 34,
  },
  optionAccentBlue: {
    backgroundColor: '#2B84FC',
  },
  optionAccentGreen: {
    backgroundColor: '#00A667',
  },
  optionAccentYellow: {
    backgroundColor: '#F6A600',
  },
  optionAccentPurple: {
    backgroundColor: '#7C5CFF',
  },
  optionIndexBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.74)',
    borderColor: 'rgba(78, 89, 104, 0.18)',
    borderRadius: 999,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
    top: 10,
    width: 24,
  },
  optionIndex: {
    color: '#4E5968',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
    textAlign: 'center',
  },
  optionTextBox: {
    alignItems: 'center',
    flexShrink: 1,
    justifyContent: 'center',
    minWidth: 0,
    width: '100%',
  },
  optionLabel: {
    color: '#191F28',
    flexShrink: 1,
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
  },
  questionLoadingBox: {
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E8EB',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  questionLoadingText: {
    color: '#4E5968',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginLeft: 10,
  },
  rewardStatus: {
    color: '#1E63D6',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
    marginBottom: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  loadingBox: {
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E8EB',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  loadingText: {
    color: '#4E5968',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginLeft: 10,
  },
  resultScreen: {
    flex: 1,
    justifyContent: 'flex-end',
    minHeight: 650,
    paddingBottom: 18,
  },
  resultPromotionNotice: {
    backgroundColor: '#EAF3FF',
    borderLeftColor: '#3182F6',
    borderLeftWidth: 4,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  resultPromotionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resultPromotionLabel: {
    color: '#1E63D6',
    fontSize: 11,
    fontWeight: '800',
  },
  resultPromotionTitle: {
    color: '#191F28',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
    marginTop: 4,
  },
  resultPromotionStatus: {
    color: '#333D4B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  resultPromotionCaption: {
    color: '#8B95A1',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 15,
    marginTop: 2,
  },
  resultPromotionRetryButton: {
    marginTop: 10,
  },
  resultCard: {
    ...cardBase,
    overflow: 'hidden',
  },
  resultArt: {
    backgroundColor: '#CDE7FF',
    height: 196,
    overflow: 'hidden',
  },
  resultImage: {
    height: '100%',
    resizeMode: 'cover',
    width: '100%',
  },
  resultImagePlaceholder: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
  },
  resultPlaceholderImage: {
    ...StyleSheet.absoluteFillObject,
    height: '100%',
    resizeMode: 'cover',
    width: '100%',
  },
  resultImagePlaceholderNotice: {
    backgroundColor: 'rgba(17, 24, 39, 0.68)',
    borderRadius: 8,
    bottom: 10,
    left: 10,
    maxWidth: '90%',
    paddingHorizontal: 9,
    paddingVertical: 5,
    position: 'absolute',
    zIndex: 2,
  },
  resultImagePlaceholderText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  imageAttributionCaption: {
    color: '#8B95A1',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 15,
    paddingHorizontal: 16,
    paddingTop: 7,
    textAlign: 'right',
  },
  resultBody: {
    padding: 18,
  },
  persona: {
    color: '#1E63D6',
    fontSize: 13,
    fontWeight: '800',
  },
  place: {
    color: '#191F28',
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 33,
    marginTop: 5,
  },
  reason: {
    color: '#4E5968',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 8,
  },
  aiDecisionBox: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E8EB',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  aiDecisionLabel: {
    color: '#1E63D6',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 5,
  },
  aiDecisionText: {
    color: '#191F28',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
  aiFactorList: {
    marginTop: 6,
  },
  aiFactorText: {
    color: '#191F28',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
  locationSummaryBox: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E8EB',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  locationSummaryLabel: {
    color: '#8B95A1',
    fontSize: 12,
    fontWeight: '800',
  },
  locationSummaryText: {
    color: '#191F28',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 4,
  },
  resultActions: {
    flexDirection: 'row',
    marginHorizontal: -5,
    marginTop: 14,
  },
  resultShareButton: {
    marginTop: 16,
  },
  resultShareDisclosure: {
    color: '#6B7684',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  resultMessage: {
    color: '#1E63D6',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
  },
  resultReviewPrompt: {
    marginHorizontal: 8,
    paddingTop: 18,
  },
  resultReviewTitle: {
    color: '#191F28',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 23,
  },
  resultReviewCopy: {
    color: '#6B7684',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 4,
  },
  resultReviewButton: {
    marginTop: 12,
  },
  homeButton: {
    marginHorizontal: 4,
    marginTop: 12,
  },
  bannerAd: {
    alignItems: 'center',
    backgroundColor: '#F8FAFF',
    borderRadius: 12,
    minHeight: 96,
    justifyContent: 'center',
    marginTop: 8,
    width: '100%',
  },
  adDisclosure: {
    color: '#6B7684',
    fontSize: 13,
    lineHeight: 20,
    marginVertical: 12,
    textAlign: 'center',
  },
  libraryContent: {
    padding: 24,
    gap: 14,
    paddingBottom: 48,
  },
  savedPlaceRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E8EB',
    paddingVertical: 20,
    gap: 10,
  },
  savedPlaceTitle: {
    color: '#191F28',
    fontSize: 22,
    fontWeight: '700',
  },
  questionBannerDock: {
    backgroundColor: '#F5F7FA',
    elevation: 8,
    paddingBottom: 4,
    paddingHorizontal: 20,
    shadowColor: '#191F28',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    zIndex: 20,
  },
  primaryButton: {
    alignSelf: 'stretch',
  },
  secondaryButton: {
    alignSelf: 'stretch',
  },
  secondaryButtonGrow: {
    flex: 1,
    marginHorizontal: 5,
  },
  disabledButton: {
    opacity: 0.62,
  },
});

const optionToneStyles = [
  styles.optionToneBlue,
  styles.optionToneGreen,
  styles.optionToneYellow,
  styles.optionTonePurple,
];

const optionAccentStyles = [
  styles.optionAccentBlue,
  styles.optionAccentGreen,
  styles.optionAccentYellow,
  styles.optionAccentPurple,
];

function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(0.08, progress) * 100}%` }]} />
    </View>
  );
}
