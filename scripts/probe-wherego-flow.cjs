#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env.local');

function loadEnv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

const env = loadEnv(ENV_PATH);
const SERVICE_KEY = env.PUBLIC_DATA_PORTAL_SERVICE_KEY;
const KOR_SERVICE_ENDPOINT =
  env.KTO_KOR_SERVICE_ENDPOINT || 'https://apis.data.go.kr/B551011/KorService2';
const DATALAB_ENDPOINT =
  env.KTO_DATALAB_SERVICE_ENDPOINT || 'https://apis.data.go.kr/B551011/DataLabService';

if (!SERVICE_KEY) {
  throw new Error('PUBLIC_DATA_PORTAL_SERVICE_KEY is missing in .env.local');
}

const selectedAnswers = [
  { question: '이번 주말 어디 쪽이 끌려요?', answer: '숲이랑 물가가 있는 조용한 곳' },
  { question: '누구랑 가요?', answer: '아이와 함께' },
  { question: '오늘 여행 텐션은?', answer: '빡센 일정 말고 쉬엄쉬엄' },
  { question: '사람 많은 곳은?', answer: '가능하면 피하고 싶음' },
  { question: '이동 방식은?', answer: '차로 당일치기' },
  { question: '중요한 편의는?', answer: '주차, 유모차, 걷기 편한 동선' },
];

function buildLocalPlanner(answers) {
  const answerText = answers.map((item) => item.answer).join(' ');

  const persona = {
    title: '아이와 함께하는 조용한 숲 힐링 드라이버',
    oneLine: '주차가 편하고 걷기 부담이 낮은 자연형 여행지가 잘 맞습니다.',
    tags: ['kids', 'quiet', 'nature', 'healing', 'parking', 'daytrip', 'low-crowd'],
  };

  return {
    plannerMode: 'local-mock-gemini',
    reason: `선택 답변에서 "${answerText}" 성향을 읽어 검색 키워드와 지역을 좁혔습니다.`,
    persona,
    toolPlan: [
      {
        tool: 'searchTourPlaces',
        args: {
          keywords: ['수목원', '숲', '자연휴양림', '생태공원'],
          areaCodes: ['31'],
          contentTypeId: '12',
          arrange: 'Q',
        },
      },
      { tool: 'getTourPlaceDetail', args: { topCandidates: 8 } },
      { tool: 'getLocalVisitorSignal', args: { visitorMetric: 'touristDemand' } },
    ],
  };
}

function ymd(date) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function firstDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function lastDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function todayInKst() {
  const override = process.env.WHEREGO_PROBE_TODAY;
  if (override) return new Date(`${override}T00:00:00+09:00`);

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(`${value.year}-${value.month}-${value.day}T00:00:00+09:00`);
}

async function getJson(base, operation, params) {
  const url = new URL(`${base}${operation}`);
  const merged = {
    serviceKey: SERVICE_KEY,
    MobileOS: 'ETC',
    MobileApp: 'wherego',
    _type: 'json',
    ...params,
  };

  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url);
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`JSON parse failed for ${operation}: ${text.slice(0, 300)}`);
  }

  const header = json.response?.header;
  if (header && header.resultCode !== '0000') {
    throw new Error(`${operation} failed: ${header.resultCode} ${header.resultMsg}`);
  }

  if (!header && json.resultCode && json.resultCode !== '0000') {
    throw new Error(`${operation} failed: ${json.resultCode} ${json.resultMsg}`);
  }

  return json;
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function bodyItems(json) {
  return asArray(json.response?.body?.items?.item);
}

async function searchTourPlaces(plan) {
  const candidates = new Map();

  for (const keyword of plan.toolPlan[0].args.keywords) {
    for (const areaCode of plan.toolPlan[0].args.areaCodes) {
      const json = await getJson(KOR_SERVICE_ENDPOINT, '/searchKeyword2', {
        keyword,
        areaCode,
        contentTypeId: plan.toolPlan[0].args.contentTypeId,
        arrange: plan.toolPlan[0].args.arrange,
        numOfRows: '12',
        pageNo: '1',
      });

      for (const item of bodyItems(json)) {
        const contentId = item.contentid || item.contentId;
        if (!contentId || candidates.has(contentId)) continue;

        candidates.set(contentId, {
          contentId,
          contentTypeId: item.contenttypeid || item.contentTypeId || '12',
          title: item.title,
          address: item.addr1,
          mapX: Number(item.mapx),
          mapY: Number(item.mapy),
          firstImage: item.firstimage || item.firstimage2,
          category: [item.cat1, item.cat2, item.cat3].filter(Boolean),
          matchedKeyword: keyword,
        });
      }
    }
  }

  return [...candidates.values()];
}

function initialScore(candidate) {
  const text = `${candidate.title || ''} ${candidate.address || ''}`;
  let score = 0;

  if (/수목원|숲|자연휴양림|생태|공원/.test(text)) score += 40;
  if (/경기도|파주|양평|남양주|가평|광주|수원|여주/.test(text)) score += 15;
  if (/유원지|테마파크|놀이공원/.test(text)) score -= 15;
  if (/시장|거리|축제|해수욕장/.test(text)) score -= 10;
  if (candidate.firstImage) score += 4;

  return score;
}

async function getPlaceDetails(candidate) {
  const commonJson = await getJson(KOR_SERVICE_ENDPOINT, '/detailCommon2', {
    contentId: candidate.contentId,
  });
  const common = bodyItems(commonJson)[0] || {};

  let intro = {};
  try {
    const introJson = await getJson(KOR_SERVICE_ENDPOINT, '/detailIntro2', {
      contentId: candidate.contentId,
      contentTypeId: candidate.contentTypeId || common.contenttypeid || '12',
      numOfRows: '10',
      pageNo: '1',
    });
    intro = bodyItems(introJson)[0] || {};
  } catch {
    intro = {};
  }

  let images = [];
  try {
    const imageJson = await getJson(KOR_SERVICE_ENDPOINT, '/detailImage2', {
      contentId: candidate.contentId,
      imageYN: 'Y',
      numOfRows: '5',
      pageNo: '1',
    });
    images = bodyItems(imageJson).map((image) => image.originimgurl || image.smallimageurl).filter(Boolean);
  } catch {
    images = [];
  }

  const merged = {
    ...candidate,
    title: common.title || candidate.title,
    address: common.addr1 || candidate.address,
    overview: common.overview || '',
    homepage: common.homepage || '',
    mapX: Number(common.mapx || candidate.mapX),
    mapY: Number(common.mapy || candidate.mapY),
    areaCode: common.areacode || candidate.areaCode,
    sigunguCode: common.sigungucode || candidate.sigunguCode,
    imageUrl: images[0] || common.firstimage || candidate.firstImage || '',
    intro: {
      infoCenter: intro.infocenter || '',
      restDate: intro.restdate || '',
      useTime: intro.usetime || '',
      parking: intro.parking || '',
      babyCarriage: intro.chkbabycarriage || '',
      pet: intro.chkpet || '',
    },
  };

  const detailText = `${merged.title} ${merged.address} ${merged.overview} ${Object.values(merged.intro).join(' ')}`;
  let score = initialScore(merged);
  if (/아이|어린이|가족|유모차/.test(detailText)) score += 10;
  if (/주차|가능/.test(merged.intro.parking)) score += 8;
  if (/연중무휴|무휴/.test(merged.intro.restDate)) score += 3;
  if (/숲|나무|산책|수목|자연|생태/.test(detailText)) score += 14;

  return { ...merged, score };
}

function parseRegionNames(address) {
  const parts = String(address || '').split(/\s+/).filter(Boolean);
  return {
    province: parts[0] || '',
    city: parts.find((part) => /시$|군$|구$/.test(part) && !/특별시$|광역시$|자치시$|자치도$|도$/.test(part)) || '',
  };
}

async function findLatestDatalabMonth(operation) {
  const cacheKey = operation;
  if (findLatestDatalabMonth.cache.has(cacheKey)) {
    return findLatestDatalabMonth.cache.get(cacheKey);
  }

  const today = todayInKst();

  for (let offset = 0; offset < 12; offset += 1) {
    const cursor = addMonths(today, -offset);
    const start = firstDayOfMonth(cursor);
    const end = offset === 0 ? today : lastDayOfMonth(cursor);
    const json = await getJson(DATALAB_ENDPOINT, operation, {
      startYmd: ymd(start),
      endYmd: ymd(end),
      pageNo: '1',
      numOfRows: '50000',
    });
    const items = bodyItems(json);
    if (items.length > 0) {
      const latestYmd = items.map((item) => item.baseYmd).sort().at(-1);
      const result = { latestYmd, items };
      findLatestDatalabMonth.cache.set(cacheKey, result);
      return result;
    }
  }

  const result = { latestYmd: null, items: [] };
  findLatestDatalabMonth.cache.set(cacheKey, result);
  return result;
}
findLatestDatalabMonth.cache = new Map();

function touristDemand(row) {
  const touDivCd = String(row.touDivCd || '');
  if (touDivCd === '1') return 0;
  return Number(row.touNum || 0);
}

function sumByDate(rows) {
  const byDate = new Map();
  for (const row of rows) {
    const value = touristDemand(row);
    byDate.set(row.baseYmd, (byDate.get(row.baseYmd) || 0) + value);
  }
  return [...byDate.entries()]
    .map(([baseYmd, value]) => ({ baseYmd, value }))
    .sort((a, b) => a.baseYmd.localeCompare(b.baseYmd));
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function labelCongestion(ratio, latestValue) {
  if (latestValue <= 0) return '데이터 부족';
  if (ratio < 0.85) return '여유';
  if (ratio <= 1.15) return '보통';
  if (ratio <= 1.35) return '약간 붐빔';
  return '붐빔';
}

async function getLocalVisitorSignal(place) {
  const { city } = parseRegionNames(place.address);
  const latest = await findLatestDatalabMonth('/locgoRegnVisitrDDList');
  const rows = latest.items.filter((item) => item.signguNm === city);
  const daily = sumByDate(rows);
  const latestRows = daily.filter((item) => item.baseYmd === latest.latestYmd);
  const latestValue = latestRows[0]?.value || 0;

  const latestWeekday = latest.items.find((item) => item.baseYmd === latest.latestYmd)?.daywkDivNm;
  const sameWeekdayDates = new Set(
    latest.items
      .filter((item) => item.daywkDivNm === latestWeekday)
      .map((item) => item.baseYmd),
  );
  const baselineValues = daily
    .filter((item) => sameWeekdayDates.has(item.baseYmd) && item.baseYmd !== latest.latestYmd)
    .map((item) => item.value);
  const fallbackValues = daily.filter((item) => item.baseYmd !== latest.latestYmd).map((item) => item.value);
  const baseline = median(baselineValues.length >= 2 ? baselineValues : fallbackValues);
  const ratio = baseline > 0 ? latestValue / baseline : 0;

  return {
    source: '한국관광공사_빅데이터_지역별 방문자수_GW',
    operation: 'locgoRegnVisitrDDList',
    regionName: city,
    latestBaseYmd: latest.latestYmd,
    metric: '외지인+외국인 방문자수',
    latestVisitorCount: Math.round(latestValue),
    baselineVisitorCount: Math.round(baseline),
    ratio: Number(ratio.toFixed(2)),
    label: labelCongestion(ratio, latestValue),
  };
}

function mapLink(place) {
  if (Number.isFinite(place.mapY) && Number.isFinite(place.mapX)) {
    return `https://map.kakao.com/link/map/${encodeURIComponent(place.title)},${place.mapY},${place.mapX}`;
  }
  return `https://map.kakao.com/link/search/${encodeURIComponent(place.title)}`;
}

async function main() {
  const plan = buildLocalPlanner(selectedAnswers);
  const candidates = await searchTourPlaces(plan);
  const rankedSeed = candidates
    .map((candidate) => ({ ...candidate, seedScore: initialScore(candidate) }))
    .sort((a, b) => b.seedScore - a.seedScore)
    .slice(0, 8);

  const detailed = [];
  for (const candidate of rankedSeed) {
    detailed.push(await getPlaceDetails(candidate));
  }

  const topPlaces = detailed.sort((a, b) => b.score - a.score).slice(0, 3);
  const placeResults = [];
  for (const place of topPlaces) {
    placeResults.push({
      title: place.title,
      address: place.address,
      score: place.score,
      matchedKeyword: place.matchedKeyword,
      aiReason: '선택 답변의 자연/조용함/아이 동반/주차 편의 조건과 가장 잘 맞는 후보입니다.',
      imageUrl: place.imageUrl,
      overview: String(place.overview || '').replace(/\s+/g, ' ').slice(0, 180),
      intro: place.intro,
      crowd: await getLocalVisitorSignal(place),
      mapLink: mapLink(place),
    });
  }

  const result = {
    selectedAnswers,
    planner: plan,
    candidateCount: candidates.length,
    resultCard: {
      personaTitle: `${plan.persona.title} 유형이에요!`,
      oneLine: plan.persona.oneLine,
      recommendedPlaces: placeResults,
      shareText: `${placeResults[0]?.title || '오늘의 여행지'} 어때요? 어디고가 취향에 맞춰 골라봤어요.`,
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
