import {
  Accuracy,
  contactsViral,
  getAnonymousKey,
  InlineAd,
  isMinVersionSupported,
  loadFullScreenAd,
  saveBase64Data,
  showFullScreenAd,
  Storage,
  useGeolocation,
} from '@apps-in-toss/framework';
import { closeView, createRoute, openURL, useBackEvent } from '@granite-js/react-native';
import { Button as TDSButton, TDSProvider, Text } from '@toss/tds-react-native';
import React, { useEffect, useRef, useState } from 'react';
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
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Path, Rect, Text as SvgText } from 'react-native-svg';

import {
  fetchWheregoQuestionSet,
  fetchWheregoUsage,
  grantWheregoReward,
  prepareWheregoCandidates,
  recommendWheregoDestination,
  WheregoApiError,
  type WheregoCandidateSet,
  type WheregoQuestion,
  type WheregoRecommendation,
  type WheregoRecommendedPlace,
  type WheregoUsage,
} from '../src/api/wheregoApi';
import { WHEREGO_SHARE_REWARD_MODULE_ID } from '../src/config';

export const Route = createRoute('/', {
  component: Index,
});

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

type TossLocation = {
  coords: {
    accuracy?: number;
    latitude: number;
    longitude: number;
  };
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
  mapLink?: string;
  isFallback?: boolean;
};

const LOGO_IMAGE = require('../assets/logo.png') as number;
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
const GENERAL_QUESTION_COUNT = 4;
const FULL_SCREEN_AD_GROUP_ID = 'ait.v2.live.69c443b05e6a42ea';
const REWARDED_AD_GROUP_ID = 'ait.v2.live.7f9040b7cff746c5';
const BANNER_AD_GROUP_ID = 'ait.v2.live.67b07bf813d74267';
const ANONYMOUS_STORAGE_KEY = 'wherego.anonymous-key.v1';
const RESULT_CARD_IMAGE_WIDTH = 1080;
const RESULT_CARD_IMAGE_HEIGHT = 1350;
const RESULT_CARD_HERO_HEIGHT = 460;
const RESULT_CARD_FONT_FAMILY = Platform.select({
  android: 'sans-serif',
  ios: 'Apple SD Gothic Neo',
});
const QUESTION_ADVANCE_DELAY_MS = 1000;
const QUESTION_SET_LOADING_MIN_MS = 2000;
const REWARDED_AD_LOAD_TIMEOUT_MS = 15000;
const FULL_SCREEN_AD_EVENT_TIMEOUT_MS = 8000;

function Index() {
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
  const contactsViralCleanupRef = useRef<(() => void) | null>(null);
  const quotaExceededRef = useRef(false);
  const exitPromptOpenRef = useRef(false);
  const resultCardSvgRef = useRef<Svg | null>(null);
  const questionAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionSetRequestIdRef = useRef(0);
  const candidateSetPromiseRef = useRef<Promise<WheregoCandidateSet | null> | null>(null);
  const selectedAnswersRef = useRef<SelectedAnswer[]>([]);
  const recommendationSessionIdRef = useRef(createWheregoSessionId());
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
  const [recommendation, setRecommendation] = useState<WheregoRecommendation | null>(null);
  const [recommendationStatus, setRecommendationStatus] = useState<RecommendationStatus>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const currentQuestion = questionSet[questionIndex];
  const progress = questionSet.length > 0 ? (questionIndex + 1) / questionSet.length : 0;
  const result = getResult(origin, recommendation);
  const supportsShareReward =
    Boolean(WHEREGO_SHARE_REWARD_MODULE_ID) &&
    isMinVersionSupported({ android: '5.223.0', ios: '5.223.0' });
  const shouldShowBannerAd =
    step === 'question' ||
    (step === 'origin' && isQuestionSetLoading) ||
    (step === 'rewardGate' && hasRewardAccess && hasClosedFullScreenAd) ||
    (step === 'result' && hasClosedFullScreenAd);
  const bannerAdKey =
    step === 'question'
      ? `question-${questionIndex}`
      : step === 'rewardGate'
        ? 'ai-recommendation-loading'
        : step === 'result'
          ? 'result'
          : 'question-set-loading';

  useEffect(() => {
    void resolveAnonymousUserKey().then((key) => {
      anonymousUserKeyRef.current = key;
      void refreshUsage(key);
    });

    return () => {
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
      showExitConfirmation();
    };

    backEvent.addEventListener(handleBack);
    return () => {
      backEvent.removeEventListener(handleBack);
    };
  }, [backEvent]);

  useEffect(() => {
    const shouldPreloadRewardAd =
      !hasRewardAccess &&
      usage?.remaining !== 0 &&
      (step === 'intro' || step === 'origin' || step === 'rewardGate');

    if (!shouldPreloadRewardAd || rewardAdLoadRequestedRef.current || isRewardAdLoaded) {
      return;
    }

    loadRewardAd();
  }, [hasRewardAccess, isRewardAdLoaded, step, usage?.remaining]);

  useEffect(() => {
    if (step !== 'quota' || quotaAdLoadedRef.current || quotaAdStatus !== 'idle') {
      return;
    }
    loadQuotaRewardAd();
  }, [quotaAdStatus, step]);

  useEffect(() => {
    if (step === 'quota') {
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
  }, [step]);

  useEffect(() => {
    if (step !== 'rewardGate' || !hasRewardAccess) {
      return;
    }

    if (recommendationStatus === 'ready') {
      setRewardAdMessage('');
      setStep('result');
    }
  }, [hasRewardAccess, recommendationStatus, step]);

  useEffect(() => {
    if (step !== 'result' || !result.imageUrl) {
      return;
    }

    void Image.prefetch(result.imageUrl).catch(() => undefined);
  }, [result.imageUrl, step]);

  useEffect(() => {
    if (!waitingForLocation) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setLocationStatus('위치 확인이 오래 걸리면 지역 선택으로 바로 시작할 수 있어요.');
    }, 8000);

    return () => clearTimeout(timeoutId);
  }, [waitingForLocation]);

  function startFlowWithCurrentLocation(geolocation: TossLocation) {
    void startFlowWithOrigin({
      type: 'current_location',
      label: currentLocationLabel(geolocation.coords.latitude, geolocation.coords.longitude),
      description: '권한 허용 위치',
      lat: geolocation.coords.latitude,
      lng: geolocation.coords.longitude,
      areaCodes: [],
      accuracy: geolocation.coords.accuracy,
    });
  }

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
        sessionId: recommendationSessionIdRef.current,
      });
      setUsage(nextUsage);
    } catch (error) {
      setUsageMessage(toErrorMessage(error));
    } finally {
      setIsUsageLoading(false);
    }
  }

  function startFromIntro() {
    if (isUsageLoading) {
      setUsageMessage('추천 횟수를 확인하고 있어요.');
      return;
    }
    if (usage?.limitEnabled && usage.remaining <= 0) {
      setStep('quota');
      return;
    }
    setStep('origin');
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
      '어디고를 종료할까요?',
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
    if (usage != null && usage.adRewardsUsed >= usage.adRewardsLimit) {
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
    quotaAdUnregisterRef.current = null;
    quotaAdLoadedRef.current = false;
    setQuotaAdStatus('loading');
    setQuotaRewardMessage('보상 광고를 준비하고 있어요.');
    try {
      quotaAdUnregisterRef.current = loadFullScreenAd({
        options: { adGroupId: REWARDED_AD_GROUP_ID },
        onEvent: (event) => {
          if (event.type !== 'loaded') {
            return;
          }
          quotaAdLoadedRef.current = true;
          setQuotaAdStatus('ready');
          setQuotaRewardMessage('');
        },
        onError: (error) => {
          quotaAdLoadedRef.current = false;
          setQuotaAdStatus('error');
          setQuotaRewardMessage(`광고를 불러오지 못했어요. ${toErrorMessage(error)}`);
        },
      });
    } catch (error) {
      setQuotaAdStatus('error');
      setQuotaRewardMessage(`광고를 불러오지 못했어요. ${toErrorMessage(error)}`);
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
    quotaAdUnregisterRef.current?.();
    quotaAdUnregisterRef.current = null;
    quotaAdLoadedRef.current = false;
    setQuotaAdStatus('showing');
    setQuotaRewardMessage('광고 시청을 완료하면 AI 추천 1회를 드려요.');

    try {
      quotaAdUnregisterRef.current = showFullScreenAd({
        options: { adGroupId: REWARDED_AD_GROUP_ID },
        onEvent: (event) => {
          if (event.type === 'userEarnedReward' && !quotaRewardGrantedRef.current) {
            quotaRewardGrantedRef.current = true;
            void applyRewardCredit('ad', grantId);
            return;
          }
          if (event.type === 'dismissed') {
            quotaRewardDismissedRef.current = true;
            quotaAdUnregisterRef.current?.();
            quotaAdUnregisterRef.current = null;
            setQuotaAdStatus('idle');
            finishAdRewardNavigation();
            if (!quotaRewardGrantedRef.current) {
              setQuotaRewardMessage('광고를 끝까지 시청하면 추천 횟수가 추가돼요.');
            }
          }
        },
        onError: (error) => {
          setQuotaAdStatus('error');
          setQuotaRewardMessage(`광고를 표시하지 못했어요. ${toErrorMessage(error)}`);
        },
      });
    } catch (error) {
      setQuotaAdStatus('error');
      setQuotaRewardMessage(`광고를 표시하지 못했어요. ${toErrorMessage(error)}`);
    }
  }

  async function applyRewardCredit(source: 'ad' | 'share', grantId: string) {
    setIsRewardGranting(true);
    setQuotaRewardMessage('추천 횟수를 반영하고 있어요.');
    try {
      const nextUsage = await grantWheregoReward({
        anonymousUserKey: anonymousUserKeyRef.current,
        sessionId: recommendationSessionIdRef.current,
        source,
        grantId,
      });
      setUsage(nextUsage);
      const message = source === 'ad' ? 'AI 추천 1회가 추가됐어요.' : 'AI 추천 3회가 추가됐어요.';
      if (source === 'ad') {
        pendingAdRewardRef.current = { message, usage: nextUsage };
        finishAdRewardNavigation();
      } else {
        resetToIntro({ message, refresh: false });
      }
    } catch (error) {
      if (error instanceof WheregoApiError && error.usage) {
        setUsage(error.usage);
      }
      setQuotaRewardMessage(toErrorMessage(error));
    } finally {
      setIsRewardGranting(false);
    }
  }

  function finishAdRewardNavigation() {
    const pendingReward = pendingAdRewardRef.current;
    if (!quotaRewardDismissedRef.current || pendingReward == null) {
      return;
    }
    pendingAdRewardRef.current = null;
    setUsage(pendingReward.usage);
    resetToIntro({ message: pendingReward.message, refresh: false });
  }

  function openShareReward() {
    if (!WHEREGO_SHARE_REWARD_MODULE_ID || usage?.shareRewardUsed || isRewardGranting) {
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
    questionSetRequestIdRef.current += 1;
    clearQuestionAdvanceTimer();
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
    recommendationSessionIdRef.current = createWheregoSessionId();
    quotaExceededRef.current = false;
    resetRewardAdState();
    setRecommendation(null);
    setRecommendationStatus('idle');
    setResultMessage('');
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
    if (recommendationStatus === 'loading' || recommendationStatus === 'ready') {
      return;
    }

    void prepareRecommendation(selectedAnswersRef.current);
  }

  function startCandidatePreparation() {
    if (origin == null || selectedAnswersRef.current.length === 0) {
      return null;
    }

    if (candidateSetPromiseRef.current != null) {
      return candidateSetPromiseRef.current;
    }

    candidateSetPromiseRef.current = prepareWheregoCandidates({
      origin,
      answers: selectedAnswersRef.current,
      sessionId: recommendationSessionIdRef.current,
      anonymousUserKey: anonymousUserKeyRef.current,
    })
      .then((candidateSet) => {
        if (candidateSet.usage) {
          setUsage(candidateSet.usage);
        }
        return candidateSet;
      })
      .catch((error) => {
        console.error('[wherego:candidates] preparation failed', error);
        candidateSetPromiseRef.current = null;
        if (error instanceof WheregoApiError && error.usage) {
          setUsage(error.usage);
        }
        if (error instanceof WheregoApiError && error.code === 'wherego_daily_limit_reached') {
          quotaExceededRef.current = true;
          setUsageMessage(error.message);
          setStep('quota');
        }
        return null;
      });

    return candidateSetPromiseRef.current;
  }

  function showRewardAd() {
    if (rewardAdStatus === 'showing') {
      return;
    }

    if (rewardAdStatus === 'loading') {
      setRewardAdMessage('광고를 준비하고 있어요. 잠시 후 다시 눌러주세요.');
      return;
    }

    if (rewardAdStatus === 'unsupported') {
      startCandidatePreparation();
      startRecommendationAnalysis();
      setHasRewardAccess(true);
      setHasClosedFullScreenAd(true);
      setRewardAdMessage('AI가 관광정보와 방문자수 데이터를 비교하고 있어요.');
      return;
    }

    if (rewardAdStatus === 'error' || !isRewardAdLoaded) {
      loadRewardAd();
      setRewardAdMessage('광고를 다시 준비하고 있어요.');
      return;
    }

    let didStartAnalysis = false;
    let didFinishAd = false;
    let unregisterShowAd: (() => void) | null = null;

    const startAnalysisAfterAdShown = () => {
      if (didStartAnalysis) {
        return;
      }

      didStartAnalysis = true;
      clearRewardAdShowTimer();
      setHasRewardAccess(true);
      startRecommendationAnalysis();
      setRewardAdMessage('광고 확인 완료. AI가 관광정보와 방문자수 데이터를 비교하고 있어요.');
    };

    const finishAdAndContinue = (message: string) => {
      if (didFinishAd) {
        return;
      }

      didFinishAd = true;
      clearRewardAdShowTimer();
      unregisterShowAd?.();
      rewardAdUnregisterRef.current = null;
      setIsRewardAdLoaded(false);
      startAnalysisAfterAdShown();
      setHasClosedFullScreenAd(true);
      setRewardAdStatus('idle');
      setRewardAdMessage(message);
    };

    startCandidatePreparation();
    setRewardAdStatus('showing');
    setRewardAdMessage('광고를 여는 중이에요. 관광지 후보를 먼저 준비하고 있어요.');
    rewardAdUnregisterRef.current?.();
    rewardAdUnregisterRef.current = null;
    clearRewardAdShowTimer();
    rewardAdShowTimeoutRef.current = setTimeout(() => {
      rewardAdShowTimeoutRef.current = null;
      console.warn('[wherego:interstitial-ad] show event timed out');
      finishAdAndContinue('광고 응답이 지연되어 AI 추천을 바로 진행하고 있어요.');
    }, FULL_SCREEN_AD_EVENT_TIMEOUT_MS);

    try {
      unregisterShowAd = showFullScreenAd({
        options: {
          adGroupId: FULL_SCREEN_AD_GROUP_ID,
        },
        onEvent: (event) => {
          console.info('[wherego:interstitial-ad] show event', { type: event.type });

          if (event.type === 'requested') {
            setRewardAdMessage('광고 요청이 완료됐어요.');
            return;
          }

          if (event.type === 'show') {
            startAnalysisAfterAdShown();
            return;
          }

          if (event.type === 'impression') {
            startAnalysisAfterAdShown();
            return;
          }

          if (event.type === 'dismissed') {
            finishAdAndContinue('광고 확인 완료. AI가 관광정보와 방문자수 데이터를 비교하고 있어요.');
            return;
          }

          if (event.type === 'failedToShow') {
            finishAdAndContinue('광고를 표시하지 못해 AI 추천을 바로 진행하고 있어요.');
          }
        },
        onError: (error) => {
          console.error('[wherego:interstitial-ad] show failed', error);
          finishAdAndContinue(`광고 표시 중 문제가 생겨 AI 추천을 바로 진행하고 있어요. ${toErrorMessage(error)}`);
        },
      });
      if (didFinishAd) {
        unregisterShowAd?.();
      } else {
        rewardAdUnregisterRef.current = unregisterShowAd;
      }
    } catch (error) {
      console.error('[wherego:interstitial-ad] show threw', error);
      finishAdAndContinue(`광고 표시 중 문제가 생겨 AI 추천을 바로 진행하고 있어요. ${toErrorMessage(error)}`);
    }
  }

  async function startFlowWithOrigin(nextOrigin: Origin) {
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
    recommendationSessionIdRef.current = createWheregoSessionId();
    quotaExceededRef.current = false;
    setRecommendation(null);
    setRecommendationStatus('idle');
    setResultMessage('');

    const fallbackSessionId = recommendationSessionIdRef.current;
    let nextQuestionSet: { questions: Question[]; sessionId: string };
    try {
      const [response] = await Promise.all([
        fetchWheregoQuestionSet({ origin: nextOrigin }),
        delay(QUESTION_SET_LOADING_MIN_MS),
      ]);
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

  function handleUseCurrentLocation() {
    setWaitingForLocation(true);
    setLocationStatus('현재 위치를 확인하고 있어요. 권한 팝업이 보이면 허용해주세요.');
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

    startCandidatePreparation();
    questionAdvanceTimeoutRef.current = setTimeout(() => {
      questionAdvanceTimeoutRef.current = null;
      setSelectedOptionLabel(null);
      setIsQuestionAdvancing(false);
      setStep(quotaExceededRef.current ? 'quota' : 'rewardGate');
    }, QUESTION_ADVANCE_DELAY_MS);
  }

  async function prepareRecommendation(answers: SelectedAnswer[]) {
    if (origin == null) {
      return;
    }

    if (answers.length === 0) {
      setRecommendation(null);
      setRecommendationStatus('error');
      setRewardAdMessage('답변 정보를 확인하지 못했어요. 처음부터 다시 진행해주세요.');
      return;
    }

    setRecommendationStatus('loading');
    setResultMessage('');

    try {
      const candidateSet = (await candidateSetPromiseRef.current) ?? null;
      const nextRecommendation = await recommendWheregoDestination({
        origin,
        answers,
        candidateSet,
        sessionId: recommendationSessionIdRef.current,
        anonymousUserKey: anonymousUserKeyRef.current,
      });
      setRecommendation(nextRecommendation);
      if (nextRecommendation.usage) {
        setUsage(nextRecommendation.usage);
      }
      setRecommendationStatus('ready');
    } catch (error) {
      setRecommendation(null);
      setRecommendationStatus('error');
      if (error instanceof WheregoApiError && error.usage) {
        setUsage(error.usage);
      }
      if (error instanceof WheregoApiError && error.code === 'wherego_daily_limit_reached') {
        setUsageMessage(error.message);
        setStep('quota');
        return;
      }
      setRewardAdMessage(`추천을 완료하지 못했어요. ${toErrorMessage(error)}`);
    }
  }

  function retryRecommendation() {
    setRewardAdMessage('');
    startCandidatePreparation();
    startRecommendationAnalysis();
  }

  function openMap() {
    setResultMessage('');
    void openURL(result.mapLink || naverSearchLink(result.place)).catch(() => {
      setResultMessage('지도 링크를 열지 못했어요. 잠시 후 다시 시도해주세요.');
    });
  }

  function saveCard() {
    setResultMessage('카드 이미지를 저장하고 있어요.');
    void saveResultCard(result, resultCardSvgRef.current)
      .then(() => {
        setResultMessage('PNG 카드 이미지로 저장했어요.');
      })
      .catch((error) => {
        setResultMessage(`카드 저장을 완료하지 못했어요. ${toErrorMessage(error)}`);
      });
  }

  return (
    <TDSProvider colorPreference="light">
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.phone}>
            {step === 'question' ? <Header counter={`${questionIndex + 1} / ${questionSet.length}`} /> : null}
            {step === 'question' ? <ProgressBar progress={progress} /> : null}
            {step === 'intro' ? (
              <IntroScreen
                loading={isUsageLoading}
                message={usageMessage}
                onStart={startFromIntro}
                usage={usage}
              />
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
                hasRewardAccess={hasRewardAccess}
                message={rewardGateMessage(rewardAdMessage, recommendationStatus)}
                recommendationStatus={recommendationStatus}
                status={rewardAdStatus}
                onRetryRecommendation={retryRecommendation}
                onWatchAd={showRewardAd}
              />
            ) : null}
            {step === 'quota' ? (
              <QuotaScreen
                adStatus={quotaAdStatus}
                granting={isRewardGranting}
                message={quotaRewardMessage || usageMessage}
                onBack={resetToIntro}
                onShare={openShareReward}
                onStart={() => setStep('origin')}
                onWatchAd={showQuotaRewardAd}
                shareReady={supportsShareReward}
                usage={usage}
              />
            ) : null}
            {step === 'result' ? (
              <>
                <ResultScreen
                  message={resultMessage}
                  result={result}
                  onHome={resetToIntro}
                  onMap={openMap}
                  onSave={saveCard}
                />
                <ResultCardPngSource
                  ref={resultCardSvgRef}
                  result={result}
                />
              </>
            ) : null}
            {shouldShowBannerAd ? <BannerAd key={bannerAdKey} /> : null}
            {waitingForLocation ? <CurrentLocationResolver onLocation={startFlowWithCurrentLocation} /> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </TDSProvider>
  );
}

function CurrentLocationResolver({ onLocation }: { onLocation: (location: TossLocation) => void }) {
  const hasResolvedRef = useRef(false);
  const geolocation = useGeolocation({
    accuracy: Accuracy.Balanced,
    distanceInterval: 50,
    timeInterval: 5000,
  });

  useEffect(() => {
    if (geolocation != null && !hasResolvedRef.current) {
      hasResolvedRef.current = true;
      onLocation(geolocation);
    }
  }, [geolocation, onLocation]);

  return null;
}

function Header({ counter }: { counter: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <Image source={LOGO_IMAGE} style={styles.logo} />
        <Text style={styles.brandName}>어디고</Text>
      </View>
      <Text style={styles.counter}>{counter}</Text>
    </View>
  );
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
  const usageLabel = usage?.limitEnabled
    ? `오늘 AI 추천 ${usage.remaining}회 남음`
    : loading
      ? '추천 횟수 확인 중'
      : 'AI 맞춤 추천';
  return (
    <View style={styles.introScreen}>
      <View style={styles.introHero}>
        <Pill label="한국관광공사 관광정보 기반" />
        <Text style={styles.introTitle}>AI가 오늘 갈 만한 여행지를 골라드려요.</Text>
        <Text style={styles.introCopy}>관광정보와 방문자수를 바탕으로 추천합니다.</Text>
        <View style={styles.usageBadge}>
          {loading ? <ActivityIndicator color="#1E63D6" size="small" /> : null}
          <Text style={styles.usageBadgeText}>{usageLabel}</Text>
        </View>
        {message ? <Text style={styles.usageMessage}>{message}</Text> : null}
      </View>
      <View style={styles.introActions}>
        <PrimaryButton disabled={loading} label={loading ? '확인 중' : '시작하기'} loading={loading} onPress={onStart} />
      </View>
    </View>
  );
}

function QuotaScreen({
  adStatus,
  granting,
  message,
  onBack,
  onShare,
  onStart,
  onWatchAd,
  shareReady,
  usage,
}: {
  adStatus: RewardAdStatus;
  granting: boolean;
  message: string;
  onBack: () => void;
  onShare: () => void;
  onStart: () => void;
  onWatchAd: () => void;
  shareReady: boolean;
  usage: WheregoUsage | null;
}) {
  const hasCredit = (usage?.remaining || 0) > 0;
  const adLimitReached = usage != null && usage.adRewardsUsed >= usage.adRewardsLimit;
  const shareUnavailable = !shareReady || Boolean(usage?.shareRewardUsed);
  const adButtonLabel = adLimitReached
    ? '오늘 광고 보상 완료'
    : adStatus === 'unsupported'
      ? '토스 앱에서 광고 보상 받기'
      : adStatus === 'loading'
        ? '보상 광고 준비 중'
        : granting
          ? '추천 횟수 반영 중'
          : '광고 보고 AI 추천 1회 받기';
  const shareButtonLabel = !shareReady
    ? '공유 리워드 준비 중'
    : usage?.shareRewardUsed
      ? '오늘 공유 보상 완료'
      : '친구에게 공유하고 3회 받기';

  return (
    <View style={styles.centerScreen}>
      <View style={styles.panelCentered}>
        <Pill label="AI 추천 횟수" />
        <Text style={styles.panelTitle}>
          {hasCredit ? `추천 ${usage?.remaining || 0}회가 준비됐어요.` : '오늘의 기본 추천을 모두 사용했어요.'}
        </Text>
        <Text style={styles.panelCopy}>
          광고 시청 완료 시 1회씩 하루 최대 10회, 친구 공유 완료 시 하루 한 번 3회를 받을 수 있어요.
        </Text>
        <View style={styles.quotaSummary}>
          <Text style={styles.quotaSummaryText}>광고 보상 {usage?.adRewardsUsed || 0} / {usage?.adRewardsLimit || 10}</Text>
          <Text style={styles.quotaSummaryText}>공유 보상 {usage?.shareRewardUsed ? '완료' : '미사용'}</Text>
        </View>
        {message ? <Text style={styles.rewardStatus}>{message}</Text> : null}
        <View style={styles.quotaActions}>
          {hasCredit ? <PrimaryButton label="추천 시작하기" onPress={onStart} /> : null}
          <PrimaryButton
            disabled={
              adLimitReached ||
              adStatus === 'unsupported' ||
              adStatus === 'loading' ||
              adStatus === 'showing' ||
              granting
            }
            label={adButtonLabel}
            loading={adStatus === 'loading' || granting}
            onPress={onWatchAd}
          />
          <SecondaryButton disabled={shareUnavailable || granting} label={shareButtonLabel} onPress={onShare} />
          <SecondaryButton label="처음으로 돌아가기" onPress={onBack} />
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
      accessibilityLabel={`${number}번 선택지, ${option.label}, ${option.caption}`}
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
        <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.optionCaption}>
          {option.caption}
        </Text>
      </View>
    </Pressable>
  );
}

function RewardGate({
  hasRewardAccess,
  message,
  onRetryRecommendation,
  onWatchAd,
  recommendationStatus,
  status,
}: {
  hasRewardAccess: boolean;
  message: string;
  onRetryRecommendation: () => void;
  onWatchAd: () => void;
  recommendationStatus: RecommendationStatus;
  status: RewardAdStatus;
}) {
  const isAdLoading = status === 'loading';
  const isRecommendationLoading = recommendationStatus === 'loading';
  const isRecommendationError = recommendationStatus === 'error';
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

  const isButtonDisabled = status === 'loading' || status === 'showing' || (hasRewardAccess && !isRecommendationError);
  const buttonLabel = isRecommendationError
    ? '추천 다시 시도'
    : hasRewardAccess
      ? '추천 마무리 중'
      : rewardButtonLabel(status, isRecommendationLoading);
  const pillLabel = isRecommendationError
    ? '추천 재시도 필요'
    : isRecommendationDone
      ? '추천 준비 완료'
      : hasStartedRecommendation
        ? 'AI 추천 준비'
        : '결과 확인 전';
  const title = isRecommendationError
    ? '추천을 다시 시도해주세요.'
    : isRecommendationDone
    ? '추천 카드 준비가 끝났어요.'
    : hasStartedRecommendation
      ? 'AI가 맞춤 여행지를 고르고 있어요.'
      : '광고를 보면 맞춤 여행지를 추천해드려요.';
  const copy = isRecommendationError
    ? '임시 추천을 보여주지 않고, 관광정보와 방문자수 기반 추천을 다시 요청할게요.'
    : isRecommendationDone
    ? '광고가 끝나면 추천 카드와 지도 연결을 바로 열어드릴게요.'
    : isAdLoading
      ? '광고를 불러오는 동안에도 버튼은 유지됩니다. 준비가 끝나면 바로 시청할 수 있어요.'
    : hasStartedRecommendation
      ? '한국관광공사 관광정보와 방문자수 데이터를 비교해 결과 카드를 만들고 있어요.'
      : '전면 광고를 확인하면 AI가 관광정보와 방문자수 데이터를 비교해 추천 카드를 만들어요.';

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
                ? '전면 광고를 준비하고 있어요.'
                : 'AI가 관광정보와 방문자수 데이터를 비교하고 있어요.'}
            </Text>
          </View>
        ) : null}
        {message ? <Text style={styles.rewardStatus}>{message}</Text> : null}
        <PrimaryButton
          disabled={isButtonDisabled}
          label={buttonLabel}
          onPress={isRecommendationError ? onRetryRecommendation : onWatchAd}
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
  message,
  onHome,
  onMap,
  onSave,
  result,
}: {
  message: string;
  onHome: () => void;
  onMap: () => void;
  onSave: () => void;
  result: DemoResult;
}) {
  const locationText = resultLocationText(result);

  return (
    <View style={styles.resultScreen}>
      <View style={styles.resultCard}>
        <View style={styles.resultArt}>
          {result.imageUrl ? (
            <Image source={{ uri: result.imageUrl }} style={styles.resultImage} />
          ) : (
            <>
              <View style={styles.sun} />
              <View style={styles.hill} />
            </>
          )}
        </View>
        {result.imageUrl && result.imageAttribution ? (
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
          <View style={styles.resultActions}>
            <SecondaryButton grow label="카드 저장하기" onPress={onSave} />
            <SecondaryButton grow label="지도 열기" onPress={onMap} />
          </View>
          {message ? <Text style={styles.resultMessage}>{message}</Text> : null}
        </View>
      </View>
      <SecondaryButton label="처음으로 돌아가기" onPress={onHome} viewStyle={styles.homeButton} />
    </View>
  );
}

const ResultCardPngSource = React.forwardRef<
  Svg,
  {
    result: DemoResult;
  }
>(function ResultCardPngSource({ result }, ref) {
  const hasHeroImage = Boolean(result.imageUrl);
  const placeLines = svgTextLines(result.place, 13, 2);
  const personaLines = svgTextLines(result.persona, 19, 2);
  const reasonLines = svgTextLines(result.reason, 25, 5);
  const locationLines = svgTextLines(resultLocationText(result), 25, 2);
  const factorLines = svgTextLines(resultCardFactorText(result), 30, 5);
  const heroTitleColor = hasHeroImage ? '#FFFFFF' : '#1E63D6';
  const heroPlaceColor = hasHeroImage ? '#FFFFFF' : '#191F28';
  const cardX = 135;
  const cardY = 64;
  const cardWidth = 810;
  const cardHeight = 1222;
  const cardRight = cardX + cardWidth;
  const contentX = cardX + 48;
  const contentWidth = cardWidth - 96;
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
          {result.imageUrl ? (
            <>
              <SvgImage
                height={RESULT_CARD_HERO_HEIGHT}
                href={{ uri: result.imageUrl }}
                preserveAspectRatio="xMidYMid slice"
                width={cardWidth}
                x={cardX}
                y={cardY}
              />
              <Rect fill="#000000" height={RESULT_CARD_HERO_HEIGHT} opacity={0.28} width={cardWidth} x={cardX} y={cardY} />
            </>
          ) : (
            <>
              <Rect fill="#EAF3FF" height={RESULT_CARD_HERO_HEIGHT} width={cardWidth} x={cardX} y={cardY} />
              <Circle cx={830} cy={225} fill="#FFE1A3" r={92} />
              <Path
                d={`M${cardX} 456 C210 348 327 410 438 342 C592 258 746 388 ${cardRight} 276 L${cardRight} 524 L${cardX} 524 Z`}
                fill="#B9E6CF"
              />
              <Path
                d={`M${cardX} 496 C232 402 352 454 500 406 C640 358 766 454 ${cardRight} 372 L${cardRight} 524 L${cardX} 524 Z`}
                fill="#86D1F2"
                opacity={0.72}
              />
            </>
          )}
        </G>
        {hasHeroImage && result.imageAttribution ? (
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
          어디고 추천 카드
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

function BannerAd() {
  return (
    <View style={styles.bannerAd}>
      <InlineAd
        adGroupId={BANNER_AD_GROUP_ID}
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
}: {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <TDSButton
      disabled={disabled}
      display="block"
      loading={loading}
      onPress={onPress}
      size="big"
      type="primary"
      viewStyle={[styles.primaryButton, disabled ? styles.disabledButton : null]}
    >
      {label}
    </TDSButton>
  );
}

function SecondaryButton({
  disabled,
  grow,
  label,
  onPress,
  viewStyle,
}: {
  disabled?: boolean;
  grow?: boolean;
  label: string;
  onPress: () => void;
  viewStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <TDSButton
      disabled={disabled}
      display="block"
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

async function resolveAnonymousUserKey(): Promise<string> {
  try {
    const result = await getAnonymousKey();
    if (result && result !== 'ERROR' && result.type === 'HASH') {
      return result.hash;
    }
  } catch (_) {
    // Use an installation key when the anonymous-key bridge is unavailable.
  }

  try {
    const stored = await Storage.getItem(ANONYMOUS_STORAGE_KEY);
    if (stored) {
      return stored;
    }
    const generated = `install-${createWheregoSessionId()}`;
    await Storage.setItem(ANONYMOUS_STORAGE_KEY, generated);
    return generated;
  } catch (_) {
    return `runtime-${createWheregoSessionId()}`;
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
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
    isFallback: false,
    mapLink: place.mapLink,
  };
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

function rewardGateMessage(adMessage: string, status: RecommendationStatus) {
  const recommendationMessage =
    status === 'loading'
      ? 'AI가 한국관광공사 관광정보에서 후보를 고르는 중이에요.'
      : status === 'ready'
        ? '추천 카드 준비가 끝났어요.'
        : status === 'error'
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
  if (status === 'unsupported') return isRecommendationLoading ? '추천 마무리 중' : '미리보기로 결과 보기';
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
    minHeight: 580,
    paddingBottom: 58,
    paddingTop: 18,
  },
  introHero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingTop: 0,
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
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 33,
    marginTop: 16,
    textAlign: 'center',
  },
  introCopy: {
    color: '#4E5968',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 22,
    marginTop: 12,
    textAlign: 'center',
  },
  introActions: {
    marginTop: 34,
    paddingTop: 0,
  },
  usageBadge: {
    alignItems: 'center',
    backgroundColor: '#EAF3FF',
    borderRadius: 12,
    flexDirection: 'row',
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  usageBadgeText: {
    color: '#1E63D6',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    marginLeft: 6,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    marginTop: 12,
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
  optionCaption: {
    color: '#6B7684',
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '800',
    includeFontPadding: false,
    lineHeight: 17,
    marginTop: 8,
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
  imageAttributionCaption: {
    color: '#8B95A1',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 15,
    paddingHorizontal: 16,
    paddingTop: 7,
    textAlign: 'right',
  },
  sun: {
    alignSelf: 'flex-end',
    backgroundColor: '#FFD25C',
    borderRadius: 38,
    height: 76,
    marginRight: 34,
    marginTop: 28,
    width: 76,
  },
  hill: {
    alignSelf: 'center',
    backgroundColor: '#54CCA6',
    borderTopLeftRadius: 90,
    borderTopRightRadius: 90,
    height: 78,
    marginTop: -12,
    width: '76%',
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
  resultMessage: {
    color: '#1E63D6',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
  },
  homeButton: {
    marginHorizontal: 4,
    marginTop: 12,
  },
  bannerAd: {
    alignItems: 'center',
    backgroundColor: '#F8FAFF',
    borderRadius: 12,
    height: 96,
    justifyContent: 'center',
    marginTop: 8,
    overflow: 'hidden',
    width: '100%',
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
