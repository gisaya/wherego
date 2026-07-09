import { Accuracy, useGeolocation } from '@apps-in-toss/framework';
import { createRoute, openURL } from '@granite-js/react-native';
import React, { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import logoImage from '../assets/logo.png';

export const Route = createRoute('/', {
  component: Index,
});

type Step = 'intro' | 'origin' | 'question' | 'rewardGate' | 'rewardAd' | 'result';
type QuestionKind = 'source' | 'general';
type QuestionLayout = 'two' | 'four';

type Option = {
  label: string;
  caption: string;
};

type Question = {
  type: QuestionKind;
  id: string;
  eyebrow: string;
  question: string;
  subcopy: string;
  layout: QuestionLayout;
  options: Option[];
};

type SelectedAnswer = {
  question: string;
  answer: string;
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

type DemoResult = {
  persona: string;
  place: string;
  reason: string;
  region: string;
  address: string;
  travel: string;
  signal: string;
  comfort: string;
};

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
    label: '부산/경남',
    description: '부산·울산·경남',
    lat: 35.1796,
    lng: 129.0756,
    areaCodes: ['6', '7', '36'],
  },
];

const demoResultsByRegion: Record<string, DemoResult> = {
  '서울/수도권': {
    persona: '아이와 함께하는 근교 숲 힐링 드라이버',
    place: '일월수목원',
    reason: '짧게 이동해서 주차 부담 없이 숲 그늘과 산책을 즐기기 좋은 후보입니다.',
    region: '경기 수원 · 수목원/산책',
    address: '수원시 장안구 일월로 일대',
    travel: '서울/수도권 기준 약 1시간 내외',
    signal: '지역 방문자수 보통 · 오전 추천',
    comfort: '가벼운 산책, 그늘, 주차 정보 확인',
  },
  '경기 남부': {
    persona: '가까운 숲길을 고르는 여유형 드라이버',
    place: '일월수목원',
    reason: '경기 남부에서 부담 없이 다녀오기 좋고 산책 동선이 단순한 후보입니다.',
    region: '경기 수원 · 수목원/산책',
    address: '수원시 장안구 일월로 일대',
    travel: '경기 남부 기준 짧은 이동',
    signal: '지역 방문자수 보통 · 오전 추천',
    comfort: '평지 산책, 그늘, 가족 동선 확인',
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
};

const GENERAL_QUESTION_COUNT = 5;

function Index() {
  const geolocation = useGeolocation({
    accuracy: Accuracy.Balanced,
    distanceInterval: 50,
    timeInterval: 5000,
  });
  const [step, setStep] = useState<Step>('intro');
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [questionSet, setQuestionSet] = useState<Question[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<SelectedAnswer[]>([]);
  const [waitingForLocation, setWaitingForLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [adSeconds, setAdSeconds] = useState(3);
  const [resultMessage, setResultMessage] = useState('');

  useEffect(() => {
    if (!waitingForLocation || geolocation == null) {
      return;
    }

    startFlowWithOrigin({
      type: 'current_location',
      label: '현재 위치',
      description: '권한 허용 위치',
      lat: geolocation.coords.latitude,
      lng: geolocation.coords.longitude,
      areaCodes: [],
      accuracy: geolocation.coords.accuracy,
    });
  }, [geolocation, waitingForLocation]);

  useEffect(() => {
    if (step !== 'rewardAd') {
      return undefined;
    }

    setAdSeconds(3);
    const timer = setInterval(() => {
      setAdSeconds((seconds) => {
        if (seconds <= 1) {
          clearInterval(timer);
          setStep('result');
          return 0;
        }

        return seconds - 1;
      });
    }, 850);

    return () => clearInterval(timer);
  }, [step]);

  const currentQuestion = questionSet[questionIndex];
  const progress = questionSet.length > 0 ? (questionIndex + 1) / questionSet.length : 0;
  const result = getDemoResult(origin);

  function resetToIntro() {
    setStep('intro');
    setOrigin(null);
    setQuestionSet([]);
    setQuestionIndex(0);
    setSelectedAnswers([]);
    setWaitingForLocation(false);
    setLocationStatus('');
    setResultMessage('');
  }

  function startFlowWithOrigin(nextOrigin: Origin) {
    setOrigin(nextOrigin);
    setQuestionSet(buildQuestionSet());
    setQuestionIndex(0);
    setSelectedAnswers([]);
    setWaitingForLocation(false);
    setLocationStatus('');
    setResultMessage('');
    setStep('question');
  }

  function handleUseCurrentLocation() {
    if (geolocation != null) {
      startFlowWithOrigin({
        type: 'current_location',
        label: '현재 위치',
        description: '권한 허용 위치',
        lat: geolocation.coords.latitude,
        lng: geolocation.coords.longitude,
        areaCodes: [],
        accuracy: geolocation.coords.accuracy,
      });
      return;
    }

    setWaitingForLocation(true);
    setLocationStatus('현재 위치를 확인하고 있어요. 권한 팝업이 보이면 허용해주세요.');
  }

  function chooseOption(option: Option) {
    if (currentQuestion == null) {
      return;
    }

    setSelectedAnswers((answers) => [
      ...answers,
      {
        question: currentQuestion.question,
        answer: option.label,
      },
    ]);

    if (questionIndex < questionSet.length - 1) {
      setQuestionIndex((index) => index + 1);
      return;
    }

    setStep('rewardGate');
  }

  function openMap() {
    setResultMessage('');
    void openURL(naverSearchLink(result.place)).catch(() => {
      setResultMessage('지도 링크를 열지 못했어요. 잠시 후 다시 시도해주세요.');
    });
  }

  function saveCard() {
    setResultMessage('카드 저장은 결과 카드 캡처 기능으로 다음 구현 단계에서 연결합니다.');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.phone}>
          <Header counter={step === 'question' ? `${questionIndex + 1} / ${questionSet.length}` : headerLabel(step)} />
          {step === 'question' ? <ProgressBar progress={progress} /> : null}
          {step === 'intro' ? <IntroScreen onStart={() => setStep('origin')} /> : null}
          {step === 'origin' ? (
            <OriginScreen
              locationStatus={locationStatus}
              onShowRegions={() => setLocationStatus('아래 지역 중 하나를 선택하면 바로 추천을 시작합니다.')}
              onUseCurrentLocation={handleUseCurrentLocation}
              onSelectRegion={startFlowWithOrigin}
              waitingForLocation={waitingForLocation}
            />
          ) : null}
          {step === 'question' && currentQuestion != null ? (
            <QuestionScreen
              origin={origin}
              question={currentQuestion}
              onChoose={chooseOption}
            />
          ) : null}
          {step === 'rewardGate' ? <RewardGate onWatchAd={() => setStep('rewardAd')} /> : null}
          {step === 'rewardAd' ? <RewardAd seconds={adSeconds} /> : null}
          {step === 'result' ? (
            <ResultScreen
              answerCount={selectedAnswers.length}
              message={resultMessage}
              origin={origin}
              result={result}
              onHome={resetToIntro}
              onMap={openMap}
              onSave={saveCard}
            />
          ) : null}
          {step === 'question' ? <BannerAd /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ counter }: { counter: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <Image source={logoImage} style={styles.logo} />
        <Text style={styles.brandName}>어디고</Text>
      </View>
      <Text style={styles.counter}>{counter}</Text>
    </View>
  );
}

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <View style={styles.centerScreen}>
      <View style={styles.introPanel}>
        <Pill label="한국관광공사 관광정보 기반" />
        <Text style={styles.introTitle}>AI가 취향에 맞는 여행지를 골라드려요.</Text>
        <Text style={styles.introCopy}>
          출발 기준과 8개 선택지만 고르면 관광정보와 방문자수 신호를 바탕으로 오늘 갈 만한 곳을 추천합니다.
        </Text>
        <PrimaryButton label="시작하기" onPress={onStart} />
      </View>
    </View>
  );
}

function OriginScreen({
  locationStatus,
  onSelectRegion,
  onShowRegions,
  onUseCurrentLocation,
  waitingForLocation,
}: {
  locationStatus: string;
  onSelectRegion: (origin: Origin) => void;
  onShowRegions: () => void;
  onUseCurrentLocation: () => void;
  waitingForLocation: boolean;
}) {
  return (
    <View style={styles.centerScreen}>
      <View style={styles.panel}>
        <Pill label="위치 기반 추천" />
        <Text style={styles.panelTitle}>어디에서 출발하세요?</Text>
        <Text style={styles.panelCopy}>
          현재 위치를 허용하면 근처 후보를 먼저 보고, 아니면 지역을 골라서 바로 시작할 수 있어요.
        </Text>
        <View style={styles.actionStack}>
          <PrimaryButton
            disabled={waitingForLocation}
            label={waitingForLocation ? '위치 확인 중' : '현재 위치로 추천'}
            onPress={onUseCurrentLocation}
          />
          <SecondaryButton label="지역 선택으로 시작" onPress={onShowRegions} />
        </View>
        <Text style={styles.statusText}>
          {locationStatus || '위치 권한 없이도 아래 지역 선택으로 추천을 시작할 수 있어요.'}
        </Text>
        <View style={styles.regionGrid}>
          {regionOptions.map((region) => (
            <Pressable key={region.label} style={styles.regionButton} onPress={() => onSelectRegion(region)}>
              <Text style={styles.regionName}>{region.label}</Text>
              <Text style={styles.regionDesc}>{region.description}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function QuestionScreen({
  onChoose,
  origin,
  question,
}: {
  onChoose: (option: Option) => void;
  origin: Origin | null;
  question: Question;
}) {
  return (
    <View style={styles.questionScreen}>
      <Text style={styles.originChip}>출발 기준: {origin?.label || '지역 미선택'}</Text>
      <Text style={styles.eyebrow}>{question.eyebrow}</Text>
      <Text style={styles.questionTitle}>{question.question}</Text>
      <Text style={styles.questionCopy}>{question.subcopy}</Text>
      <View style={question.layout === 'four' ? styles.optionGrid : styles.optionStack}>
        {question.options.map((option, optionIndex) => (
          <OptionCard
            key={option.label}
            layout={question.layout}
            number={optionIndex + 1}
            onPress={() => onChoose(option)}
            option={option}
          />
        ))}
      </View>
    </View>
  );
}

function OptionCard({
  layout,
  number,
  onPress,
  option,
}: {
  layout: QuestionLayout;
  number: number;
  onPress: () => void;
  option: Option;
}) {
  return (
    <Pressable style={[styles.optionCard, layout === 'four' ? styles.optionCardGrid : styles.optionCardStack]} onPress={onPress}>
      <Text style={styles.optionIndex}>{number}</Text>
      <View style={styles.optionTextBox}>
        <Text style={styles.optionLabel}>{option.label}</Text>
        <Text style={styles.optionCaption}>{option.caption}</Text>
      </View>
    </Pressable>
  );
}

function RewardGate({ onWatchAd }: { onWatchAd: () => void }) {
  return (
    <View style={styles.centerScreen}>
      <View style={styles.panelCentered}>
        <Pill label="취향 분석 완료" />
        <Text style={styles.panelTitle}>취향에 맞는 여행지를 골라뒀어요.</Text>
        <Text style={styles.panelCopy}>짧은 광고를 보면 AI 추천 카드와 지도 연결을 바로 열어드릴게요.</Text>
        <PrimaryButton label="광고 보고 결과 보기" onPress={onWatchAd} />
      </View>
    </View>
  );
}

function RewardAd({ seconds }: { seconds: number }) {
  return (
    <View style={styles.centerScreen}>
      <View style={styles.rewardAd}>
        <Text style={styles.rewardAdBadge}>리워드 광고</Text>
        <Text style={styles.rewardAdTitle}>여행지 추천 카드를 준비하고 있어요</Text>
        <Text style={styles.rewardAdCopy}>{seconds}초 후 결과 열기</Text>
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
  origin,
  result,
}: {
  answerCount: number;
  message: string;
  onHome: () => void;
  onMap: () => void;
  onSave: () => void;
  origin: Origin | null;
  result: DemoResult;
}) {
  return (
    <View style={styles.resultScreen}>
      <View style={styles.resultCard}>
        <View style={styles.resultArt}>
          <View style={styles.sun} />
          <View style={styles.hill} />
        </View>
        <View style={styles.resultBody}>
          <Text style={styles.persona}>{result.persona}</Text>
          <Text style={styles.place}>{result.place}</Text>
          <Text style={styles.reason}>{result.reason}</Text>
          <View style={styles.infoTable}>
            <InfoRow label="출발" value={origin?.label || '지역 미선택'} />
            <InfoRow label="지역" value={result.region} />
            <InfoRow label="주소" value={result.address} />
            <InfoRow label="이동" value={result.travel} />
            <InfoRow label="방문 신호" value={result.signal} />
            <InfoRow label="편의" value={result.comfort} />
          </View>
          <Text style={styles.sourceNote}>
            한국관광공사 관광정보와 지역별 방문자수 데이터를 함께 반영했어요. {answerCount}개 답변 기준 추천입니다.
          </Text>
          <View style={styles.resultActions}>
            <SecondaryButton label="카드 저장하기" onPress={onSave} />
            <SecondaryButton label="지도 열기" onPress={onMap} />
          </View>
          {message ? <Text style={styles.resultMessage}>{message}</Text> : null}
        </View>
      </View>
      <Pressable style={styles.homeButton} onPress={onHome}>
        <Text style={styles.homeButtonText}>처음으로 돌아가기</Text>
      </Pressable>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function BannerAd() {
  return (
    <View style={styles.bannerAd}>
      <Text style={styles.bannerText}>배너 광고 영역</Text>
    </View>
  );
}

function PrimaryButton({
  disabled,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable disabled={disabled} style={[styles.primaryButton, disabled ? styles.disabledButton : null]} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
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
  const generalQuestions = [...requiredGeneralQuestions, ...remainingGeneralQuestions];
  return shuffle([...sourceQuestionPool, ...generalQuestions]);
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

function getDemoResult(nextOrigin: Origin | null) {
  const fallback = demoResultsByRegion['서울/수도권'];
  if (fallback == null) {
    throw new Error('Default demo result is missing.');
  }

  const regionLabel = nextOrigin?.type === 'current_location' ? nearestRegionLabel(nextOrigin) : nextOrigin?.label;
  return demoResultsByRegion[regionLabel || '서울/수도권'] ?? fallback;
}

function naverSearchLink(keyword: string) {
  return `https://map.naver.com/p/search/${encodeURIComponent(keyword)}`;
}

function headerLabel(step: Step) {
  if (step === 'origin') return '출발 기준';
  if (step === 'rewardGate') return '결과 준비';
  if (step === 'rewardAd') return '광고';
  if (step === 'result') return '추천 완료';
  return '';
}

const cardBase: ViewStyle = {
  backgroundColor: '#FFFFFF',
  borderColor: '#E3E8F7',
  borderRadius: 22,
  borderWidth: 1,
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EEF3FF',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#EEF3FF',
  },
  phone: {
    flex: 1,
    minHeight: 720,
    padding: 18,
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
    borderRadius: 10,
    height: 30,
    marginRight: 9,
    width: 30,
  },
  brandName: {
    color: '#202438',
    fontSize: 18,
    fontWeight: '900',
  },
  counter: {
    color: '#67708A',
    fontSize: 13,
    fontWeight: '800',
  },
  progressTrack: {
    backgroundColor: '#DFE6FB',
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
    minHeight: 590,
  },
  introPanel: {
    ...cardBase,
    backgroundColor: '#F8FBFF',
    padding: 22,
  },
  panel: {
    ...cardBase,
    padding: 22,
  },
  panelCentered: {
    ...cardBase,
    alignItems: 'center',
    padding: 22,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(43, 132, 252, 0.1)',
    borderRadius: 999,
    minHeight: 28,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: {
    color: '#1E63D6',
    fontSize: 13,
    fontWeight: '900',
  },
  introTitle: {
    color: '#202438',
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 37,
    marginTop: 18,
  },
  introCopy: {
    color: '#67708A',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 22,
    marginTop: 12,
  },
  panelTitle: {
    color: '#202438',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
    marginTop: 14,
    textAlign: 'center',
  },
  panelCopy: {
    color: '#67708A',
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
    marginTop: 14,
  },
  regionButton: {
    ...cardBase,
    margin: 5,
    minHeight: 64,
    padding: 11,
    width: '46.8%',
  },
  regionName: {
    color: '#202438',
    fontSize: 15,
    fontWeight: '900',
  },
  regionDesc: {
    color: '#67708A',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  questionScreen: {
    flex: 1,
    minHeight: 590,
  },
  originChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(43, 132, 252, 0.1)',
    borderRadius: 999,
    color: '#1E63D6',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  eyebrow: {
    color: '#1E63D6',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 7,
  },
  questionTitle: {
    color: '#202438',
    fontSize: 27,
    fontWeight: '900',
    lineHeight: 33,
  },
  questionCopy: {
    color: '#67708A',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    marginBottom: 12,
    marginTop: 8,
  },
  optionStack: {
    flex: 1,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  optionCard: {
    ...cardBase,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 142,
    padding: 15,
  },
  optionCardStack: {
    flex: 1,
    marginBottom: 12,
  },
  optionCardGrid: {
    margin: 6,
    minHeight: 156,
    width: '46.8%',
  },
  optionIndex: {
    alignSelf: 'flex-end',
    color: '#1E63D6',
    fontSize: 12,
    fontWeight: '900',
  },
  optionTextBox: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  optionLabel: {
    color: '#202438',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
    textAlign: 'center',
  },
  optionCaption: {
    color: '#67708A',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 7,
    textAlign: 'center',
  },
  rewardAd: {
    backgroundColor: '#25345F',
    borderRadius: 24,
    justifyContent: 'space-between',
    minHeight: 420,
    padding: 26,
  },
  rewardAdBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.17)',
    borderRadius: 999,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  rewardAdTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 32,
    textAlign: 'center',
  },
  rewardAdCopy: {
    color: 'rgba(255, 255, 255, 0.84)',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
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
    height: 162,
    overflow: 'hidden',
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
    fontWeight: '900',
  },
  place: {
    color: '#202438',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
    marginTop: 5,
  },
  reason: {
    color: '#67708A',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 8,
  },
  infoTable: {
    borderBottomColor: '#E3E8F7',
    borderBottomWidth: 1,
    borderTopColor: '#E3E8F7',
    borderTopWidth: 1,
    marginTop: 14,
  },
  infoRow: {
    borderTopColor: 'rgba(227, 232, 247, 0.75)',
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingVertical: 9,
  },
  infoLabel: {
    color: '#67708A',
    fontSize: 12,
    fontWeight: '900',
    width: 74,
  },
  infoValue: {
    color: '#202438',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
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
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 14,
    justifyContent: 'center',
    marginHorizontal: 4,
    marginTop: 12,
    minHeight: 48,
  },
  homeButtonText: {
    color: '#67708A',
    fontSize: 14,
    fontWeight: '900',
  },
  bannerAd: {
    alignItems: 'center',
    backgroundColor: '#F6F8FF',
    borderColor: '#B7C2DF',
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    marginTop: 12,
  },
  bannerText: {
    color: '#7C86A0',
    fontSize: 13,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2B84FC',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 56,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#F6F8FF',
    borderColor: '#E3E8F7',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 5,
    minHeight: 50,
  },
  secondaryButtonText: {
    color: '#202438',
    fontSize: 15,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.62,
  },
});

function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(0.08, progress) * 100}%` }]} />
    </View>
  );
}
