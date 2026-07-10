import {
  Accuracy,
  InlineAd,
  isMinVersionSupported,
  loadFullScreenAd,
  saveBase64Data,
  showFullScreenAd,
  useGeolocation,
} from '@apps-in-toss/framework';
import { createRoute, openURL } from '@granite-js/react-native';
import { Button as TDSButton, TDSProvider, Text } from '@toss/tds-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  recommendWheregoDestination,
  type WheregoQuestion,
  type WheregoRecommendation,
  type WheregoRecommendedPlace,
} from '../src/api/wheregoApi';
import generalQuestionBank from '../data/general-question-bank.json';
import sourceQuestionBlueprint from '../data/source-question-blueprint.json';

export const Route = createRoute('/', {
  component: Index,
});

type Step = 'intro' | 'origin' | 'question' | 'rewardGate' | 'result';
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

type OptionMetadata = {
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

type BankQuestionType = 'select_2' | 'select_4';

type BankOption = {
  key?: string;
  sourceId?: string;
  label: string;
  tags?: string[];
  searchHints?: string[];
  constraints?: Record<string, boolean | number | string | string[]>;
};

type SourceQuestionVariant = {
  id: string;
  type: BankQuestionType;
  question: string;
  options: BankOption[];
};

type SourceQuestionAxis = {
  axis: string;
  label: string;
  why?: string;
  variants: SourceQuestionVariant[];
};

type SourceQuestionBlueprint = {
  requiredAxes: SourceQuestionAxis[];
};

type GeneralQuestionItem = {
  id: string;
  type: BankQuestionType;
  tagGroup: string;
  label: string;
  question: string;
  tags?: string[];
  options: BankOption[];
};

type GeneralQuestionGroup = {
  tagGroup: string;
  label: string;
  why?: string;
  questions: GeneralQuestionItem[];
};

type GeneralQuestionRuntimeSelection = {
  requiredTagGroups?: string[];
  oneOfTagGroups?: string[];
};

type GeneralQuestionBank = {
  runtimeSelection?: GeneralQuestionRuntimeSelection;
  tagGroups: GeneralQuestionGroup[];
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
  mapLink?: string;
  isFallback?: boolean;
};

const LOGO_IMAGE_URL = 'https://static.toss.im/appsintoss/51165/be941510-6da6-4bba-982c-11824ab9a089.png';
const sourceQuestionData = sourceQuestionBlueprint as SourceQuestionBlueprint;
const generalQuestionData = generalQuestionBank as GeneralQuestionBank;

const sourceQuestionPool: Question[] = [
  {
    type: 'source',
    id: 'move_time_binary_01',
    eyebrow: '거리',
    question: '오늘은 가볍게 갈까요, 멀리 제대로 갈까요?',
    subcopy: '출발지 기준으로 후보 지역을 먼저 좁힙니다.',
    layout: 'two',
    options: [
      { label: '가볍게 근교로', caption: '왕복 2시간 안쪽' },
      { label: '멀리 제대로', caption: '목적지 우선' },
    ],
  },
  {
    type: 'source',
    id: 'party_companion_01',
    eyebrow: '동행',
    question: '누구랑 가는 여행이에요?',
    subcopy: '같은 장소도 누구와 가는지에 따라 만족도가 달라집니다.',
    layout: 'four',
    options: [
      { label: '혼자 조용히', caption: '한산한 산책' },
      { label: '연인/친구와', caption: '사진과 카페' },
      { label: '아이와 가족끼리', caption: '안전한 동선' },
      { label: '부모님/시니어와', caption: '편한 길' },
    ],
  },
  {
    type: 'source',
    id: 'intent_landscape_01',
    eyebrow: '목적지',
    question: '오늘 끌리는 풍경은 어느 쪽이에요?',
    subcopy: '한국관광공사 검색 키워드를 정하는 핵심 질문입니다.',
    layout: 'four',
    options: [
      { label: '숲과 수목원', caption: '그늘과 산책' },
      { label: '바다와 해안', caption: '시원한 전망' },
      { label: '호수와 강변', caption: '데크길' },
      { label: '도심과 문화공간', caption: '전시와 카페' },
    ],
  },
];

const generalQuestionPool: Question[] = [
  {
    type: 'general',
    id: 'crowd',
    eyebrow: '혼잡도',
    question: '인파는 어느 쪽이 더 좋아요?',
    subcopy: '지역별 방문자수 데이터를 결과 보조 신호로 씁니다.',
    layout: 'two',
    options: [
      { label: '한산한 숨은 곳', caption: '여유 우선' },
      { label: '활기찬 인기 명소', caption: '핫플 우선' },
    ],
  },
  {
    type: 'general',
    id: 'mood',
    eyebrow: '무드',
    question: '오늘 여행의 온도는 어느 쪽이에요?',
    subcopy: '결과 카드의 한 줄 평과 장소 분위기를 맞춥니다.',
    layout: 'four',
    options: [
      { label: '차분한 힐링', caption: '쉬러 가기' },
      { label: '사진 남기기', caption: '예쁜 장면' },
      { label: '새로운 경험', caption: '이색 코스' },
      { label: '맛있는 하루', caption: '먹거리 중심' },
    ],
  },
  {
    type: 'general',
    id: 'mobility',
    eyebrow: '접근성',
    question: '도착 후 걷는 건 어디까지 괜찮아요?',
    subcopy: '주차, 보행, 계단 조건을 추천 점수에 반영합니다.',
    layout: 'four',
    options: [
      { label: '주차 후 5분 컷', caption: '최소 보행' },
      { label: '30분 산책 정도', caption: '가벼운 코스' },
      { label: '1시간 이상 걷기', caption: '트레킹 가능' },
      { label: '언덕/계단도 가능', caption: '전망대 가능' },
    ],
  },
  {
    type: 'general',
    id: 'budget',
    eyebrow: '예산',
    question: '오늘 지출은 어느 정도가 편해요?',
    subcopy: '입장료와 주변 소비가 큰 후보를 조절합니다.',
    layout: 'two',
    options: [
      { label: '가볍게 무료 위주', caption: '공원/산책' },
      { label: '괜찮으면 유료도', caption: '전시/체험' },
    ],
  },
  {
    type: 'general',
    id: 'weather',
    eyebrow: '날씨',
    question: '날씨가 애매하면 어떤 곳이 좋아요?',
    subcopy: '실내 대안과 그늘 조건을 후보 필터에 더합니다.',
    layout: 'four',
    options: [
      { label: '실내 대안 필수', caption: '비 와도 안정' },
      { label: '비 와도 운치', caption: '감성 우선' },
      { label: '맑은 날 야외', caption: '전망 우선' },
      { label: '그늘 많은 곳', caption: '더위 대응' },
    ],
  },
  {
    type: 'general',
    id: 'food',
    eyebrow: '먹거리',
    question: '밥이나 카페는 얼마나 중요해요?',
    subcopy: '목적지 주변 상권과 체류 방식을 함께 봅니다.',
    layout: 'four',
    options: [
      { label: '맛집까지 중요', caption: '식사 포함' },
      { label: '카페가 있으면 좋음', caption: '쉬는 시간' },
      { label: '간식 정도면 충분', caption: '가벼운 소비' },
      { label: '장소만 좋으면 됨', caption: '목적지 우선' },
    ],
  },
  {
    type: 'general',
    id: 'accessibility',
    eyebrow: '편의',
    question: '꼭 챙겨야 하는 편의 조건이 있어요?',
    subcopy: '강한 제약은 결과에서 필터처럼 반영합니다.',
    layout: 'four',
    options: [
      { label: '아이 편의시설', caption: '가족 동선' },
      { label: '반려동물 동반', caption: '펫 가능' },
      { label: '화장실/쉼터', caption: '쉬운 체류' },
      { label: '특별히 없음', caption: '넓게 추천' },
    ],
  },
  {
    type: 'general',
    id: 'photo',
    eyebrow: '기록',
    question: '사진은 어느 정도 챙길까요?',
    subcopy: '전망, 계절감, 포토존 성격을 추천에 더합니다.',
    layout: 'two',
    options: [
      { label: '사진 잘 나와야 함', caption: '장면 우선' },
      { label: '눈으로 보면 충분', caption: '체류 우선' },
    ],
  },
  {
    type: 'general',
    id: 'route_style',
    eyebrow: '동선',
    question: '오늘 동선은 어떤 쪽이 좋아요?',
    subcopy: '결과 카드에서 단일 목적지인지 주변 코스인지 결정합니다.',
    layout: 'two',
    options: [
      { label: '목적지 하나', caption: '한 곳에 오래' },
      { label: '주변까지 코스', caption: '여러 곳 묶기' },
    ],
  },
  {
    type: 'general',
    id: 'time_slot',
    eyebrow: '시간대',
    question: '출발 타이밍은 어느 쪽에 가까워요?',
    subcopy: '오전형, 오후형, 야경형 후보를 다르게 잡습니다.',
    layout: 'four',
    options: [
      { label: '아침부터 출발', caption: '긴 체류' },
      { label: '점심 먹고 출발', caption: '반나절' },
      { label: '해질녘 맞춰', caption: '노을' },
      { label: '밤 분위기', caption: '야경' },
    ],
  },
];

const optionMetadataByQuestionId: Record<string, Record<string, OptionMetadata>> = {
  move_time_binary_01: {
    '가볍게 근교로': {
      tags: ['nearby', 'short_trip', 'daytrip', 'low_fatigue'],
      searchHints: ['공원', '수목원', '산책'],
      constraints: { areaScope: 'nearby', maxRoundTripMinutes: 150, maxDistanceKm: 85 },
    },
    '멀리 제대로': {
      tags: ['wide_trip', 'destination_first', 'long_daytrip'],
      searchHints: ['전망대', '자연휴양림', '해변'],
      constraints: { areaScope: 'nationwide', minDistanceKm: 45 },
    },
  },
  party_companion_01: {
    '혼자 조용히': {
      tags: ['solo', 'quiet', 'low_crowd', 'healing'],
      searchHints: ['숲', '공원', '산책'],
      constraints: { preferLowCrowd: true },
    },
    '연인/친구와': {
      tags: ['couple_or_friends', 'photo', 'cafe_ok'],
      searchHints: ['전망대', '문화공간', '정원'],
      constraints: { preferPhotoSpot: true },
    },
    '아이와 가족끼리': {
      tags: ['kids', 'family', 'safe', 'parking'],
      searchHints: ['생태공원', '수목원', '어린이'],
      constraints: { preferParking: true, preferEasyWalk: true },
    },
    '부모님/시니어와': {
      tags: ['senior', 'easy_walk', 'restroom', 'low_slope'],
      searchHints: ['공원', '수목원', '무장애'],
      constraints: { preferParking: true, preferEasyWalk: true },
    },
  },
  intent_landscape_01: {
    '숲과 수목원': {
      tags: ['forest', 'arboretum', 'nature', 'shade'],
      searchHints: ['수목원', '숲', '자연휴양림', '생태공원', '정원'],
    },
    '바다와 해안': {
      tags: ['sea', 'coast', 'water', 'open_view'],
      searchHints: ['해변', '해안산책로', '바다', '전망대', '섬'],
    },
    '호수와 강변': {
      tags: ['lake', 'river', 'deck_walk', 'calm_water'],
      searchHints: ['호수', '강변', '저수지', '둘레길', '데크길'],
    },
    '도심과 문화공간': {
      tags: ['city', 'culture', 'exhibition', 'cafe_ok'],
      searchHints: ['박물관', '미술관', '문화공간', '전망대'],
    },
  },
  crowd: {
    '한산한 숨은 곳': {
      tags: ['low_crowd', 'hidden', 'quiet'],
      constraints: { preferLowCrowd: true },
    },
    '활기찬 인기 명소': {
      tags: ['popular', 'hotplace', 'lively'],
      constraints: { allowCrowd: true },
    },
  },
  mood: {
    '차분한 힐링': { tags: ['healing', 'rest', 'calm'], searchHints: ['숲', '수목원', '공원'] },
    '사진 남기기': { tags: ['photo', 'view', 'shareable'], searchHints: ['전망대', '정원', '문화공간'] },
    '새로운 경험': { tags: ['experience', 'novelty'], searchHints: ['체험마을', '박물관', '테마파크'] },
    '맛있는 하루': { tags: ['food', 'cafe', 'local_food'], searchHints: ['문화거리', '전통시장', '카페거리'] },
  },
  mobility: {
    '주차 후 5분 컷': {
      tags: ['minimal_walk', 'parking_close', 'easy_walk'],
      constraints: { preferParking: true, preferEasyWalk: true, maxOneWayMinutes: 90 },
    },
    '30분 산책 정도': { tags: ['easy_walk', 'walk'], searchHints: ['산책', '공원', '둘레길'] },
    '1시간 이상 걷기': { tags: ['long_walk', 'trail'], searchHints: ['둘레길', '숲길', '자연휴양림'] },
    '언덕/계단도 가능': { tags: ['slope_ok', 'view', 'active'], searchHints: ['전망대', '둘레길'] },
  },
  budget: {
    '가볍게 무료 위주': { tags: ['free_preferred', 'park', 'light_spend'], searchHints: ['공원', '산책'] },
    '괜찮으면 유료도': { tags: ['paid_ok', 'exhibition', 'experience'], searchHints: ['박물관', '미술관', '체험'] },
  },
  weather: {
    '실내 대안 필수': { tags: ['indoor_required', 'rain_safe'], searchHints: ['박물관', '미술관', '전시관'] },
    '비 와도 운치': { tags: ['rain_ok', 'mood'], searchHints: ['숲', '정원', '문화공간'] },
    '맑은 날 야외': { tags: ['outdoor', 'sunny', 'view'], searchHints: ['전망대', '해변', '공원'] },
    '그늘 많은 곳': { tags: ['shade', 'summer_safe', 'forest'], searchHints: ['숲', '수목원', '자연휴양림'] },
  },
  food: {
    '맛집까지 중요': { tags: ['food_required', 'local_food'], searchHints: ['전통시장', '문화거리'] },
    '카페가 있으면 좋음': { tags: ['cafe_required', 'rest'], searchHints: ['카페거리', '문화공간'] },
    '간식 정도면 충분': { tags: ['light_food', 'snack'], searchHints: ['공원', '문화공간'] },
    '장소만 좋으면 됨': { tags: ['destination_only'], searchHints: ['수목원', '전망대', '정원'] },
  },
  accessibility: {
    '아이 편의시설': {
      tags: ['kids_facility', 'family', 'easy_walk'],
      searchHints: ['어린이', '생태공원', '수목원'],
      constraints: { preferParking: true, preferEasyWalk: true },
    },
    '반려동물 동반': { tags: ['pet_friendly'], searchHints: ['공원', '산책'] },
    '화장실/쉼터': { tags: ['restroom', 'rest_area', 'comfort'], searchHints: ['공원', '수목원'] },
    '특별히 없음': { tags: ['no_constraints'] },
  },
  photo: {
    '사진 잘 나와야 함': { tags: ['photo_required', 'view'], searchHints: ['전망대', '정원', '야경'] },
    '눈으로 보면 충분': { tags: ['rest_first', 'simple_viewing'], searchHints: ['숲', '공원', '산책'] },
  },
  route_style: {
    '목적지 하나': { tags: ['single_destination', 'slow_route'], constraints: { singleDestination: true } },
    '주변까지 코스': { tags: ['multi_stop', 'route_link'], constraints: { multiStopOk: true } },
  },
  time_slot: {
    '아침부터 출발': { tags: ['morning', 'early_start'], constraints: { preferTimeSlot: 'morning' } },
    '점심 먹고 출발': { tags: ['late_start', 'half_day'], constraints: { preferTimeSlot: 'afternoon' } },
    '해질녘 맞춰': { tags: ['sunset', 'warm_photo'], searchHints: ['노을', '전망대'] },
    '밤 분위기': { tags: ['night', 'night_view'], searchHints: ['야경', '전망대', '문화공간'] },
  },
};

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

const GENERAL_QUESTION_COUNT = 5;
const REWARDED_AD_GROUP_ID = 'ait.v2.live.7f9040b7cff746c5';
const BANNER_AD_GROUP_ID = 'ait.v2.live.67b07bf813d74267';
const RESULT_CARD_IMAGE_WIDTH = 1080;
const RESULT_CARD_IMAGE_HEIGHT = 1350;
const RESULT_CARD_HERO_HEIGHT = 460;
const RESULT_CARD_FONT_FAMILY = Platform.select({
  android: 'sans-serif',
  ios: 'Apple SD Gothic Neo',
});
const QUESTION_ADVANCE_DELAY_MS = 1000;

function Index() {
  const rewardAdUnregisterRef = useRef<(() => void) | null>(null);
  const rewardGateLoadRequestedRef = useRef(false);
  const resultCardSvgRef = useRef<Svg | null>(null);
  const questionAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionSetRequestIdRef = useRef(0);
  const selectedAnswersRef = useRef<SelectedAnswer[]>([]);
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
  const [recommendation, setRecommendation] = useState<WheregoRecommendation | null>(null);
  const [recommendationStatus, setRecommendationStatus] = useState<RecommendationStatus>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const currentQuestion = questionSet[questionIndex];
  const progress = questionSet.length > 0 ? (questionIndex + 1) / questionSet.length : 0;
  const result = getResult(origin, recommendation);

  useEffect(() => {
    return () => {
      rewardAdUnregisterRef.current?.();
      rewardAdUnregisterRef.current = null;
      clearQuestionAdvanceTimer();
    };
  }, []);

  useEffect(() => {
    if (step !== 'rewardGate' || rewardGateLoadRequestedRef.current) {
      return;
    }

    rewardGateLoadRequestedRef.current = true;
    loadRewardAd();
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

  function resetToIntro() {
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
    resetRewardAdState();
    setRecommendation(null);
    setRecommendationStatus('idle');
    setResultMessage('');
  }

  function resetRewardAdState() {
    rewardAdUnregisterRef.current?.();
    rewardAdUnregisterRef.current = null;
    rewardGateLoadRequestedRef.current = false;
    setIsRewardAdLoaded(false);
    setRewardAdStatus('idle');
    setRewardAdMessage('');
    setHasRewardAccess(false);
  }

  function loadRewardAd() {
    const supportsRewardAd = loadFullScreenAd.isSupported() && showFullScreenAd.isSupported();

    rewardAdUnregisterRef.current?.();
    rewardAdUnregisterRef.current = null;
    setIsRewardAdLoaded(false);

    if (!supportsRewardAd) {
      setRewardAdStatus('unsupported');
      setRewardAdMessage('브라우저나 샌드박스는 리워드 광고를 지원하지 않아요. 콘솔 QR의 토스 앱 테스트에서 광고를 확인해주세요.');
      return;
    }

    setRewardAdStatus('loading');
    setRewardAdMessage('리워드 광고를 준비하고 있어요.');

    rewardAdUnregisterRef.current = loadFullScreenAd({
      options: {
        adGroupId: REWARDED_AD_GROUP_ID,
      },
      onEvent: (event) => {
        if (event.type === 'loaded') {
          setIsRewardAdLoaded(true);
          setRewardAdStatus('ready');
          setRewardAdMessage('');
        }
      },
      onError: (error) => {
        setIsRewardAdLoaded(false);
        setRewardAdStatus('error');
        setRewardAdMessage(`광고를 불러오지 못했어요. ${toErrorMessage(error)}`);
      },
    });
  }

  function startRecommendationAnalysis() {
    if (recommendationStatus === 'loading' || recommendationStatus === 'ready') {
      return;
    }

    void prepareRecommendation(selectedAnswersRef.current);
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
      startRecommendationAnalysis();
      setHasRewardAccess(true);
      setRewardAdMessage('AI가 관광정보와 방문자수 데이터를 비교하고 있어요.');
      return;
    }

    if (rewardAdStatus === 'error' || !isRewardAdLoaded) {
      loadRewardAd();
      setRewardAdMessage('광고를 다시 준비하고 있어요.');
      return;
    }

    startRecommendationAnalysis();

    let didEarnReward = false;
    let unregisterShowAd: (() => void) | null = null;

    setRewardAdStatus('showing');
    setRewardAdMessage('광고를 여는 중이에요. 동시에 추천 결과를 만들고 있어요.');

    unregisterShowAd = showFullScreenAd({
      options: {
        adGroupId: REWARDED_AD_GROUP_ID,
      },
      onEvent: (event) => {
        if (event.type === 'requested') {
          setRewardAdMessage('광고 요청이 완료됐어요.');
          return;
        }

        if (event.type === 'show') {
          setRewardAdMessage('광고 시청이 끝나면 결과를 열어드릴게요.');
          return;
        }

        if (event.type === 'userEarnedReward') {
          didEarnReward = true;
          setHasRewardAccess(true);
          setRewardAdMessage('광고 시청 완료. 추천 결과를 마무리하고 있어요.');
          return;
        }

        if (event.type === 'dismissed') {
          unregisterShowAd?.();
          setIsRewardAdLoaded(false);
          loadRewardAd();

          if (!didEarnReward) {
            setRewardAdMessage('광고 시청을 완료하면 결과를 볼 수 있어요.');
          }
          return;
        }

        if (event.type === 'failedToShow') {
          unregisterShowAd?.();
          setIsRewardAdLoaded(false);
          setRewardAdStatus('error');
          setRewardAdMessage('광고를 표시하지 못했어요. 다시 불러와 주세요.');
        }
      },
      onError: (error) => {
        unregisterShowAd?.();
        setIsRewardAdLoaded(false);
        setRewardAdStatus('error');
        setRewardAdMessage(`광고 표시 중 문제가 생겼어요. ${toErrorMessage(error)}`);
      },
    });
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
    resetRewardAdState();
    setRecommendation(null);
    setRecommendationStatus('idle');
    setResultMessage('');

    let nextQuestionSet = buildQuestionSet();
    try {
      const response = await fetchWheregoQuestionSet({ origin: nextOrigin });
      const remoteQuestions = normalizeRemoteQuestions(response.questions);
      if (remoteQuestions.length === 8) {
        nextQuestionSet = remoteQuestions;
      }
    } catch (_) {
      nextQuestionSet = buildQuestionSet();
    }

    if (questionSetRequestIdRef.current !== requestId) {
      return;
    }

    setQuestionSet(nextQuestionSet);
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

    const metadata = mergeOptionMetadata(optionMetadataByQuestionId[currentQuestion.id]?.[option.label], option);
    const nextAnswers = [
      ...selectedAnswers,
      {
        questionId: currentQuestion.id,
        questionType: currentQuestion.type,
        question: currentQuestion.question,
        answer: option.label,
        caption: option.caption,
        tags: uniqueStrings([...(currentQuestion.tags || []), ...(metadata.tags || [])]),
        searchHints: metadata.searchHints || [],
        constraints: metadata.constraints || {},
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

    questionAdvanceTimeoutRef.current = setTimeout(() => {
      questionAdvanceTimeoutRef.current = null;
      setSelectedOptionLabel(null);
      setIsQuestionAdvancing(false);
      setStep('rewardGate');
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
      const nextRecommendation = await recommendWheregoDestination({
        origin,
        answers,
      });
      setRecommendation(nextRecommendation);
      setRecommendationStatus('ready');
    } catch (error) {
      setRecommendation(null);
      setRecommendationStatus('error');
      setRewardAdMessage(`추천을 완료하지 못했어요. ${toErrorMessage(error)}`);
    }
  }

  function retryRecommendation() {
    setRewardAdMessage('');
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
            {step === 'intro' ? <IntroScreen onStart={() => setStep('origin')} /> : null}
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
            {step === 'result' ? (
              <>
                <ResultScreen
                  answerCount={selectedAnswers.length}
                  message={resultMessage}
                  result={result}
                  onHome={resetToIntro}
                  onMap={openMap}
                  onSave={saveCard}
                />
                <ResultCardPngSource
                  ref={resultCardSvgRef}
                  answerCount={selectedAnswers.length}
                  result={result}
                />
              </>
            ) : null}
            {step === 'question' ? <BannerAd /> : null}
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
        <Image source={{ uri: LOGO_IMAGE_URL }} style={styles.logo} />
        <Text style={styles.brandName}>어디고</Text>
      </View>
      <Text style={styles.counter}>{counter}</Text>
    </View>
  );
}

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <View style={styles.introScreen}>
      <View style={styles.introHero}>
        <Pill label="한국관광공사 관광정보 기반" />
        <Text style={styles.introTitle}>AI가 오늘 갈 만한 여행지를 골라드려요.</Text>
        <Text style={styles.introCopy}>관광정보와 방문자수를 바탕으로 추천합니다.</Text>
      </View>
      <View style={styles.introActions}>
        <PrimaryButton label="시작하기" onPress={onStart} />
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
          <Text style={styles.panelTitle}>질문지를 준비하고 있어요.</Text>
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
      <Text style={styles.questionCopy}>{question.subcopy}</Text>
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
        <Text adjustsFontSizeToFit minimumFontScale={0.88} numberOfLines={2} style={styles.optionCaption}>
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
  const isButtonDisabled = status === 'showing' || (hasRewardAccess && !isRecommendationError);
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
    ? '광고 시청을 완료하면 추천 카드와 지도 연결을 바로 열어드릴게요.'
    : isAdLoading
      ? '광고를 불러오는 동안에도 버튼은 유지됩니다. 준비가 끝나면 바로 시청할 수 있어요.'
    : hasStartedRecommendation
      ? '한국관광공사 관광정보와 방문자수 데이터를 비교해 결과 카드를 만들고 있어요.'
      : '광고를 시작하면 AI 분석도 함께 시작되고, 완료되면 추천 카드와 지도 연결을 열어드릴게요.';

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
                ? '리워드 광고를 준비하고 있어요.'
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

function ResultScreen({
  answerCount,
  message,
  onHome,
  onMap,
  onSave,
  result,
}: {
  answerCount: number;
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
        <View style={styles.resultBody}>
          <Text style={styles.persona}>{result.persona}</Text>
          <Text style={styles.place}>{result.place}</Text>
          <Text style={styles.reason}>{result.reason}</Text>
          <AiDecision result={result} />
          <View style={styles.locationSummaryBox}>
            <Text style={styles.locationSummaryLabel}>위치</Text>
            <Text style={styles.locationSummaryText}>{locationText}</Text>
          </View>
          <Text style={styles.sourceNote}>{resultSourceNote(result, answerCount)}</Text>
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
    answerCount: number;
    result: DemoResult;
  }
>(function ResultCardPngSource({ answerCount, result }, ref) {
  const hasHeroImage = Boolean(result.imageUrl);
  const placeLines = svgTextLines(result.place, 17, 2);
  const personaLines = svgTextLines(result.persona, 24, 2);
  const reasonLines = svgTextLines(result.reason, 29, 3);
  const sourceLines = svgTextLines(resultSourceNote(result, answerCount), 48, 2);
  const locationLines = svgTextLines(resultLocationText(result), 45, 2);
  const factorLines = svgTextLines(resultCardFactorText(result), 42, 4);
  const heroTitleColor = hasHeroImage ? '#FFFFFF' : '#1E63D6';
  const heroPlaceColor = hasHeroImage ? '#FFFFFF' : '#191F28';

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
            <Rect height={RESULT_CARD_HERO_HEIGHT} rx={48} width={952} x={64} y={64} />
          </ClipPath>
        </Defs>
        <Rect fill="#F5F7FA" height={RESULT_CARD_IMAGE_HEIGHT} width={RESULT_CARD_IMAGE_WIDTH} x={0} y={0} />
        <Rect fill="#FFFFFF" height={1222} rx={48} width={952} x={64} y={64} />
        <Rect fill="none" height={1222} rx={48} stroke="#E5E8EB" strokeWidth={2} width={952} x={64} y={64} />
        <G clipPath="url(#wherego-result-hero-clip)">
          {result.imageUrl ? (
            <>
              <SvgImage
                height={RESULT_CARD_HERO_HEIGHT}
                href={{ uri: result.imageUrl }}
                preserveAspectRatio="xMidYMid slice"
                width={952}
                x={64}
                y={64}
              />
              <Rect fill="#000000" height={RESULT_CARD_HERO_HEIGHT} opacity={0.28} width={952} x={64} y={64} />
            </>
          ) : (
            <>
              <Rect fill="#EAF3FF" height={RESULT_CARD_HERO_HEIGHT} width={952} x={64} y={64} />
              <Circle cx={855} cy={225} fill="#FFE1A3" r={92} />
              <Path
                d="M64 456 C210 348 327 410 438 342 C592 258 746 388 1016 276 L1016 524 L64 524 Z"
                fill="#B9E6CF"
              />
              <Path
                d="M64 496 C232 402 352 454 500 406 C640 358 766 454 1016 372 L1016 524 L64 524 Z"
                fill="#86D1F2"
                opacity={0.72}
              />
            </>
          )}
        </G>
        <SvgText fill={heroTitleColor} fontFamily={RESULT_CARD_FONT_FAMILY} fontSize={34} fontWeight="800" x={112} y={150}>
          어디고 추천 카드
        </SvgText>
        <SvgTextBlock color={heroPlaceColor} lineHeight={62} lines={placeLines} weight="800" x={112} y={234} />
        <SvgTextBlock color="#1E63D6" lineHeight={34} lines={personaLines} weight="800" x={112} y={588} />
        <SvgTextBlock color="#4E5968" lineHeight={36} lines={reasonLines} weight="700" x={112} y={662} />
        <Rect fill="#E5E8EB" height={2} width={856} x={112} y={770} />
        <Rect fill="#F9FAFB" height={86} rx={24} stroke="#E5E8EB" width={856} x={112} y={800} />
        <SvgText fill="#8B95A1" fontFamily={RESULT_CARD_FONT_FAMILY} fontSize={24} fontWeight="800" x={146} y={852}>
          위치
        </SvgText>
        <SvgTextBlock color="#191F28" lineHeight={29} lines={locationLines} weight="800" x={240} y={840} />
        <Rect fill="#F9FAFB" height={220} rx={28} stroke="#E5E8EB" width={856} x={112} y={920} />
        <SvgText fill="#1E63D6" fontFamily={RESULT_CARD_FONT_FAMILY} fontSize={27} fontWeight="800" x={146} y={970}>
          AI 선택 근거
        </SvgText>
        <SvgTextBlock color="#191F28" lineHeight={30} lines={factorLines} weight="700" x={146} y={1016} />
        <SvgTextBlock color="#8B95A1" lineHeight={23} lines={sourceLines} weight="700" x={112} y={1188} />
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
  if (!result.personaSummary && !highlights?.length && !result.aiTradeoff && !result.aiCrowdNote) {
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
      {result.aiTradeoff ? <Text style={styles.aiDecisionSubText}>{result.aiTradeoff}</Text> : null}
      {result.aiCrowdNote ? <Text style={styles.aiDecisionSubText}>{result.aiCrowdNote}</Text> : null}
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
  grow,
  label,
  onPress,
  viewStyle,
}: {
  grow?: boolean;
  label: string;
  onPress: () => void;
  viewStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <TDSButton
      display="block"
      onPress={onPress}
      size="large"
      style="weak"
      type="light"
      viewStyle={[styles.secondaryButton, grow ? styles.secondaryButtonGrow : null, viewStyle]}
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

function buildQuestionSet() {
  const sourceQuestions = buildSourceQuestions();
  const generalQuestions = buildGeneralQuestions();
  return shuffle([...sourceQuestions, ...generalQuestions]);
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
        options: question.options.map((option) => ({
          key: option.key,
          label: option.label,
          caption: option.caption || '추천 조건 반영',
          tags: option.tags || [],
          searchHints: option.searchHints || [],
          constraints: option.constraints || {},
        })),
      };
    });

  const sourceCount = normalized.filter((question) => question.type === 'source').length;
  const generalCount = normalized.filter((question) => question.type === 'general').length;
  return normalized.length === 8 && sourceCount === 3 && generalCount === GENERAL_QUESTION_COUNT ? normalized : [];
}

function buildSourceQuestions() {
  const questions = sourceQuestionData.requiredAxes
    .map((axis) => {
      const variant = randomItem(axis.variants);
      return variant == null ? null : toSourceQuestion(axis, variant);
    })
    .filter((question): question is Question => question != null);

  return questions.length === 3 ? questions : sourceQuestionPool;
}

function buildGeneralQuestions() {
  const groups = generalQuestionData.tagGroups;
  const selectedGroups: GeneralQuestionGroup[] = [];
  const selectedTagGroups = new Set<string>();
  const requiredTagGroups = generalQuestionData.runtimeSelection?.requiredTagGroups || ['crowd'];
  const oneOfTagGroups = generalQuestionData.runtimeSelection?.oneOfTagGroups || ['mobility', 'accessibility'];

  for (const tagGroup of requiredTagGroups) {
    addGeneralQuestionGroup(groups.find((group) => group.tagGroup === tagGroup), selectedGroups, selectedTagGroups);
  }

  addGeneralQuestionGroup(
    randomItem(shuffle(oneOfTagGroups).map((tagGroup) => groups.find((group) => group.tagGroup === tagGroup)).filter(isDefined)),
    selectedGroups,
    selectedTagGroups,
  );

  const remainingGroups = shuffle(groups.filter((group) => !selectedTagGroups.has(group.tagGroup)));
  for (const group of remainingGroups) {
    if (selectedGroups.length >= GENERAL_QUESTION_COUNT) {
      break;
    }
    addGeneralQuestionGroup(group, selectedGroups, selectedTagGroups);
  }

  const questions = selectedGroups
    .slice(0, GENERAL_QUESTION_COUNT)
    .map((group) => {
      const question = randomItem(group.questions);
      return question == null ? null : toGeneralQuestion(group, question);
    })
    .filter((question): question is Question => question != null);

  return questions.length === GENERAL_QUESTION_COUNT ? questions : buildFallbackGeneralQuestions();
}

function buildFallbackGeneralQuestions() {
  const crowdQuestion = generalQuestionPool.find((question) => question.id === 'crowd');
  const accessQuestion = shuffle(
    generalQuestionPool.filter((question) => question.id === 'mobility' || question.id === 'accessibility'),
  )[0];
  const requiredGeneralQuestions = [crowdQuestion, accessQuestion].filter(
    (question): question is Question => question != null,
  );
  const remainingGeneralQuestions = shuffle(
    generalQuestionPool.filter((question) => !requiredGeneralQuestions.includes(question)),
  ).slice(0, GENERAL_QUESTION_COUNT - requiredGeneralQuestions.length);
  return [...requiredGeneralQuestions, ...remainingGeneralQuestions];
}

function addGeneralQuestionGroup(
  group: GeneralQuestionGroup | undefined,
  selectedGroups: GeneralQuestionGroup[],
  selectedTagGroups: Set<string>,
) {
  if (group == null || selectedTagGroups.has(group.tagGroup)) {
    return;
  }

  selectedGroups.push(group);
  selectedTagGroups.add(group.tagGroup);
}

function toSourceQuestion(axis: SourceQuestionAxis, variant: SourceQuestionVariant): Question {
  return {
    type: 'source',
    id: variant.id,
    eyebrow: axis.label,
    question: variant.question,
    subcopy: sourceQuestionSubcopy(axis),
    layout: questionLayout(variant.type, variant.options.length),
    tags: [axis.axis],
    options: variant.options.map(toQuestionOption),
  };
}

function toGeneralQuestion(group: GeneralQuestionGroup, question: GeneralQuestionItem): Question {
  return {
    type: 'general',
    id: question.id,
    eyebrow: group.label || question.label,
    question: question.question,
    subcopy: group.why || '선택한 취향을 관광지 검색 조건과 추천 근거에 반영합니다.',
    layout: questionLayout(question.type, question.options.length),
    tags: uniqueStrings([question.tagGroup, ...(question.tags || [])]),
    options: question.options.map(toQuestionOption),
  };
}

function toQuestionOption(option: BankOption): Option {
  const searchHints = option.searchHints || [];
  const tags = option.tags || [];

  return {
    key: option.key || option.sourceId,
    label: option.label,
    caption: optionCaption(searchHints),
    tags,
    searchHints,
    constraints: option.constraints || {},
  };
}

function questionLayout(type: BankQuestionType, optionCount: number): QuestionLayout {
  return type === 'select_2' || optionCount <= 2 ? 'two' : 'four';
}

function sourceQuestionSubcopy(axis: SourceQuestionAxis) {
  if (axis.why) {
    return axis.why;
  }

  if (axis.axis === 'movement_scope') {
    return '출발지 기준으로 추천 가능한 지역 후보를 먼저 좁힙니다.';
  }
  if (axis.axis === 'party_constraints') {
    return '동행자와 이동 제약을 추천 조건에 반영합니다.';
  }
  return '관광지 검색 키워드와 목적지 분위기를 정합니다.';
}

function optionCaption(searchHints: string[]) {
  return searchHints.slice(0, 2).join(' · ') || '추천 조건 반영';
}

function mergeOptionMetadata(fallback: OptionMetadata | undefined, option: Option): OptionMetadata {
  return {
    tags: uniqueStrings([...(fallback?.tags || []), ...(option.tags || [])]),
    searchHints: uniqueStrings([...(fallback?.searchHints || []), ...(option.searchHints || [])]),
    constraints: { ...(fallback?.constraints || {}), ...(option.constraints || {}) },
  };
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items.filter((item) => item.length > 0)));
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function chunkOptions(options: Option[], size: number) {
  const rows: Option[][] = [];
  for (let index = 0; index < options.length; index += size) {
    rows.push(options.slice(index, index + size));
  }
  return rows;
}

function shuffle<T>(items: T[]) {
  return [...items]
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
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

function resultSourceNote(result: DemoResult, answerCount: number) {
  if (result.isFallback) {
    return '서버 추천이 지연되어 임시 추천을 보여주고 있어요. 다시 시도하면 AI가 관광정보와 방문자수 데이터를 비교해 추천합니다.';
  }

  return `AI가 한국관광공사 관광정보 후보와 지역별 방문자수 데이터를 함께 비교했어요. ${answerCount}개 답변 기준 추천입니다.`;
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
    return cleanedFactors.join(' · ');
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
  if (status === 'loading') return '광고 보기';
  if (status === 'showing') return '광고 여는 중';
  if (status === 'unsupported') return isRecommendationLoading ? '추천 마무리 중' : '미리보기로 결과 보기';
  if (status === 'error') return '광고 다시 불러오기';
  return isRecommendationLoading ? '광고 보기' : '광고 보고 결과 보기';
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
  questionCopy: {
    color: '#4E5968',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    marginBottom: 12,
    marginTop: 8,
  },
  optionRows: {
    marginTop: 10,
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
    lineHeight: 17,
    marginTop: 7,
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
  aiDecisionSubText: {
    color: '#6B7684',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 6,
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
  sourceNote: {
    color: '#7C86A0',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 10,
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
