#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const env = loadEnv(path.join(ROOT, '.env.local'));
const SERVICE_KEY = env.PUBLIC_DATA_PORTAL_SERVICE_KEY;
const KOR_ENDPOINT = env.KTO_KOR_SERVICE_ENDPOINT || 'https://apis.data.go.kr/B551011/KorService2';
const DATALAB_ENDPOINT =
  env.KTO_DATALAB_SERVICE_ENDPOINT || 'https://apis.data.go.kr/B551011/DataLabService';
const DEFAULT_ORIGIN = {
  label: '서울시청 테스트 위치',
  lat: 37.5665,
  lng: 126.978,
  areaCodes: ['1', '31', '2'],
};
const AVERAGE_DRIVE_KMH = 45;
const ROAD_DISTANCE_FACTOR = 1.35;
const DISTANCE_FILTER_BUFFER_MINUTES = 15;

if (!SERVICE_KEY) throw new Error('PUBLIC_DATA_PORTAL_SERVICE_KEY is missing');

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

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function items(json) {
  return asArray(json.response?.body?.items?.item);
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
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }

  const response = await fetch(url);
  const text = await response.text();
  const json = JSON.parse(text);
  const header = json.response?.header;
  if (header && header.resultCode !== '0000') {
    throw new Error(`${operation} failed: ${header.resultCode} ${header.resultMsg}`);
  }
  if (!header && json.resultCode && json.resultCode !== '0000') {
    throw new Error(`${operation} failed: ${json.resultCode} ${json.resultMsg}`);
  }
  return json;
}

function findVariant(blueprint, id) {
  for (const axis of blueprint.requiredAxes) {
    const variant = axis.variants.find((item) => item.id === id);
    if (variant) return { axis: axis.axis, ...variant };
  }
  throw new Error(`Required variant not found: ${id}`);
}

function findQuestion(bank, id) {
  for (const group of bank.tagGroups) {
    const question = group.questions.find((item) => item.id === id);
    if (question) return question;
  }
  throw new Error(`General question not found: ${id}`);
}

function selectOption(question, key) {
  const option = question.options.find((item) => item.key === key);
  if (!option) throw new Error(`Option ${key} not found in ${question.id}`);
  return {
    id: question.id,
    tagGroup: question.axis || question.tagGroup,
    question: question.question,
    answerKey: key,
    answer: option.label,
    tags: option.tags || [],
    searchHints: option.searchHints || [],
    constraints: option.constraints || {},
  };
}

function buildSelectedAnswers() {
  const blueprint = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/source-question-blueprint.json'), 'utf8'));
  const bank = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/general-question-bank.json'), 'utf8'));

  const required = [
    selectOption(findVariant(blueprint, 'move_time_binary_01'), 'A'),
    selectOption(findVariant(blueprint, 'party_companion_01'), 'C'),
    selectOption(findVariant(blueprint, 'intent_landscape_01'), 'A'),
  ];

  const general = [
    selectOption(findQuestion(bank, 'gen_crowd_01'), 'A'),
    selectOption(findQuestion(bank, 'gen_mobility_01'), 'A'),
    selectOption(findQuestion(bank, 'gen_weather_02'), 'B'),
    selectOption(findQuestion(bank, 'gen_accessibility_01'), 'A'),
    selectOption(findQuestion(bank, 'gen_route_style_01'), 'A'),
  ];

  return { required, general, all: [...required, ...general] };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function getOrigin() {
  const lat = Number(process.env.WHEREGO_CURRENT_LAT);
  const lng = Number(process.env.WHEREGO_CURRENT_LNG);
  const label = process.env.WHEREGO_CURRENT_LABEL || DEFAULT_ORIGIN.label;
  const areaCodes = process.env.WHEREGO_SEARCH_AREA_CODES
    ? process.env.WHEREGO_SEARCH_AREA_CODES.split(',').map((item) => item.trim()).filter(Boolean)
    : DEFAULT_ORIGIN.areaCodes;

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { label, lat, lng, areaCodes };
  }

  return DEFAULT_ORIGIN;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceKm(origin, point) {
  if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) return null;
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;

  const earthKm = 6371;
  const dLat = toRadians(point.lat - origin.lat);
  const dLng = toRadians(point.lng - origin.lng);
  const lat1 = toRadians(origin.lat);
  const lat2 = toRadians(point.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthKm * c;
}

function estimateTravel(origin, point) {
  const straightDistanceKm = distanceKm(origin, point);
  if (!Number.isFinite(straightDistanceKm)) {
    return {
      straightDistanceKm: null,
      estimatedRoadDistanceKm: null,
      estimatedOneWayDriveMinutes: null,
      estimatedRoundTripDriveMinutes: null,
    };
  }

  const estimatedRoadDistanceKm = straightDistanceKm * ROAD_DISTANCE_FACTOR;
  const estimatedOneWayDriveMinutes = (estimatedRoadDistanceKm / AVERAGE_DRIVE_KMH) * 60;
  return {
    straightDistanceKm,
    estimatedRoadDistanceKm,
    estimatedOneWayDriveMinutes,
    estimatedRoundTripDriveMinutes: estimatedOneWayDriveMinutes * 2,
  };
}

function roundNullable(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function deriveDistanceConstraint(selected) {
  const constraints = Object.assign({}, ...selected.required.map((answer) => answer.constraints));
  if (Number.isFinite(constraints.maxDistanceKm)) {
    return {
      type: 'road_distance',
      maxDistanceKm: constraints.maxDistanceKm,
    };
  }
  if (Number.isFinite(constraints.maxOneWayMinutes)) {
    return {
      type: 'one_way_drive_time',
      maxOneWayMinutes: constraints.maxOneWayMinutes,
    };
  }
  if (Number.isFinite(constraints.maxRoundTripMinutes)) {
    return {
      type: 'round_trip_drive_time',
      maxRoundTripMinutes: constraints.maxRoundTripMinutes,
    };
  }
  return { type: 'none' };
}

function passesDistanceConstraint(candidate, constraint) {
  if (!constraint || constraint.type === 'none') return true;

  if (constraint.type === 'road_distance') {
    return (
      Number.isFinite(candidate.estimatedRoadDistanceKm) &&
      candidate.estimatedRoadDistanceKm <= constraint.maxDistanceKm
    );
  }

  if (constraint.type === 'one_way_drive_time') {
    return (
      Number.isFinite(candidate.estimatedOneWayDriveMinutes) &&
      candidate.estimatedOneWayDriveMinutes <=
        constraint.maxOneWayMinutes + DISTANCE_FILTER_BUFFER_MINUTES
    );
  }

  if (constraint.type === 'round_trip_drive_time') {
    return (
      Number.isFinite(candidate.estimatedRoundTripDriveMinutes) &&
      candidate.estimatedRoundTripDriveMinutes <=
        constraint.maxRoundTripMinutes + DISTANCE_FILTER_BUFFER_MINUTES
    );
  }

  return true;
}

function buildGeminiLikePlan(selected) {
  const tags = unique(selected.all.flatMap((answer) => answer.tags));
  const searchHints = unique(selected.all.flatMap((answer) => answer.searchHints));
  const origin = getOrigin();
  const distanceConstraint = deriveDistanceConstraint(selected);

  const keywords = unique([
    '수목원',
    '숲',
    '자연휴양림',
    '생태공원',
    ...searchHints.filter((hint) => /수목원|숲|휴양림|생태|산책|공원|정원/.test(hint)),
  ]).slice(0, 8);

  return {
    plannerMode: 'codex-local-gemini-substitute',
    persona: {
      title: '아이와 함께하는 근교 숲 힐링 드라이버',
      oneLine: '짧게 이동해서 주차 부담 없이 숲 그늘과 산책을 즐기는 여행지가 잘 맞습니다.',
      tags,
    },
    toolPlan: {
      searchTourPlaces: {
        keywords,
        areaCodes: origin.areaCodes,
        contentTypeId: '12',
        arrange: 'Q',
      },
      locationFilter: {
        origin,
        distanceConstraint,
        distanceMode: distanceConstraint.type === 'none' ? 'none' : 'estimated_drive_radius',
        averageDriveKmh: AVERAGE_DRIVE_KMH,
        roadDistanceFactor: ROAD_DISTANCE_FACTOR,
        bufferMinutes: DISTANCE_FILTER_BUFFER_MINUTES,
      },
      rankingWeights: {
        forest: 30,
        kids: 14,
        parking: 12,
        easyWalk: 10,
        lowCrowd: 8,
      },
    },
  };
}

async function searchTourPlaces(plan) {
  const candidates = new Map();
  const origin = plan.toolPlan.locationFilter.origin;
  const distanceConstraint = plan.toolPlan.locationFilter.distanceConstraint;
  for (const keyword of plan.toolPlan.searchTourPlaces.keywords) {
    for (const areaCode of plan.toolPlan.searchTourPlaces.areaCodes) {
      const json = await getJson(KOR_ENDPOINT, '/searchKeyword2', {
        keyword,
        areaCode,
        contentTypeId: plan.toolPlan.searchTourPlaces.contentTypeId,
        arrange: plan.toolPlan.searchTourPlaces.arrange,
        pageNo: '1',
        numOfRows: '10',
      });
      for (const item of items(json)) {
        const contentId = item.contentid || item.contentId;
        if (!contentId || candidates.has(contentId)) continue;
        const travel = estimateTravel(origin, { lat: Number(item.mapy), lng: Number(item.mapx) });
        candidates.set(contentId, {
          contentId,
          contentTypeId: item.contenttypeid || '12',
          title: item.title,
          address: item.addr1,
          firstImage: item.firstimage || item.firstimage2,
          mapX: Number(item.mapx),
          mapY: Number(item.mapy),
          ...travel,
          matchedKeyword: keyword,
        });
      }
    }
  }
  const allCandidates = [...candidates.values()];
  return allCandidates.filter((candidate) => passesDistanceConstraint(candidate, distanceConstraint));
}

function seedScore(candidate) {
  const text = `${candidate.title} ${candidate.address}`;
  let score = 0;
  if (/수목원|숲|휴양림|생태|공원|정원/.test(text)) score += 50;
  if (/경기도|파주|남양주|양평|수원|용인|광주|가평|여주/.test(text)) score += 20;
  if (/테마파크|놀이공원|유원지|시장|해수욕장/.test(text)) score -= 15;
  if (candidate.firstImage) score += 5;
  if (Number.isFinite(candidate.straightDistanceKm)) {
    score += Math.max(0, 20 - candidate.straightDistanceKm / 2);
  }
  return score;
}

async function detailPlace(candidate) {
  const commonJson = await getJson(KOR_ENDPOINT, '/detailCommon2', {
    contentId: candidate.contentId,
  });
  const common = items(commonJson)[0] || {};

  let intro = {};
  try {
    const introJson = await getJson(KOR_ENDPOINT, '/detailIntro2', {
      contentId: candidate.contentId,
      contentTypeId: candidate.contentTypeId || common.contenttypeid || '12',
      pageNo: '1',
      numOfRows: '10',
    });
    intro = items(introJson)[0] || {};
  } catch {
    intro = {};
  }

  let images = [];
  try {
    const imageJson = await getJson(KOR_ENDPOINT, '/detailImage2', {
      contentId: candidate.contentId,
      imageYN: 'Y',
      pageNo: '1',
      numOfRows: '5',
    });
    images = items(imageJson).map((item) => item.originimgurl || item.smallimageurl).filter(Boolean);
  } catch {
    images = [];
  }

  const place = {
    ...candidate,
    title: common.title || candidate.title,
    address: common.addr1 || candidate.address,
    overview: common.overview || '',
    mapX: Number(common.mapx || candidate.mapX),
    mapY: Number(common.mapy || candidate.mapY),
    straightDistanceKm: candidate.straightDistanceKm,
    estimatedRoadDistanceKm: candidate.estimatedRoadDistanceKm,
    estimatedOneWayDriveMinutes: candidate.estimatedOneWayDriveMinutes,
    estimatedRoundTripDriveMinutes: candidate.estimatedRoundTripDriveMinutes,
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

  const text = `${place.title} ${place.address} ${place.overview} ${Object.values(place.intro).join(' ')}`;
  let score = seedScore(place);
  if (/아이|어린이|가족|유모차|생태/.test(text)) score += 14;
  if (/주차|가능/.test(place.intro.parking)) score += 12;
  if (/평지|산책|데크|무장애|수목|숲|나무/.test(text)) score += 12;
  if (/연중무휴|상시|무휴/.test(`${place.intro.restDate} ${place.intro.useTime}`)) score += 3;

  return { ...place, score };
}

function todayKst() {
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

function ymd(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

async function latestDatalabRows() {
  if (latestDatalabRows.cache) return latestDatalabRows.cache;
  const today = todayKst();
  for (let offset = 0; offset < 12; offset += 1) {
    const cursor = addMonths(today, -offset);
    const start = monthStart(cursor);
    const end = offset === 0 ? today : monthEnd(cursor);
    const json = await getJson(DATALAB_ENDPOINT, '/locgoRegnVisitrDDList', {
      startYmd: ymd(start),
      endYmd: ymd(end),
      pageNo: '1',
      numOfRows: '50000',
    });
    const rows = items(json);
    if (rows.length > 0) {
      latestDatalabRows.cache = { rows, latestYmd: rows.map((row) => row.baseYmd).sort().at(-1) };
      return latestDatalabRows.cache;
    }
  }
  return { rows: [], latestYmd: null };
}

function touristDemand(row) {
  return String(row.touDivCd || '') === '1' ? 0 : Number(row.touNum || 0);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function congestionLabel(ratio, latestValue) {
  if (!latestValue) return '데이터 부족';
  if (ratio < 0.85) return '여유';
  if (ratio <= 1.15) return '보통';
  if (ratio <= 1.35) return '약간 붐빔';
  return '붐빔';
}

function cityFromAddress(address) {
  return String(address || '')
    .split(/\s+/)
    .find((part) => /시$|군$|구$/.test(part) && !/특별시$|광역시$|자치시$|자치도$|도$/.test(part));
}

async function crowdSignal(place) {
  const city = cityFromAddress(place.address);
  const latest = await latestDatalabRows();
  const rows = latest.rows.filter((row) => row.signguNm === city);
  const byDate = new Map();
  for (const row of rows) byDate.set(row.baseYmd, (byDate.get(row.baseYmd) || 0) + touristDemand(row));
  const latestValue = byDate.get(latest.latestYmd) || 0;
  const baseline = median([...byDate.entries()].filter(([date]) => date !== latest.latestYmd).map(([, value]) => value));
  const ratio = baseline ? latestValue / baseline : 0;
  return {
    regionName: city || '',
    latestBaseYmd: latest.latestYmd,
    metric: '외지인+외국인 방문자수',
    latestVisitorCount: Math.round(latestValue),
    baselineVisitorCount: Math.round(baseline),
    ratio: Number(ratio.toFixed(2)),
    label: congestionLabel(ratio, latestValue),
  };
}

function mapLink(place) {
  if (Number.isFinite(place.mapX) && Number.isFinite(place.mapY)) {
    return `https://map.kakao.com/link/map/${encodeURIComponent(place.title)},${place.mapY},${place.mapX}`;
  }
  return `https://map.kakao.com/link/search/${encodeURIComponent(place.title)}`;
}

async function main() {
  const selected = buildSelectedAnswers();
  const plan = buildGeminiLikePlan(selected);
  const candidates = await searchTourPlaces(plan);
  const seeds = candidates.map((candidate) => ({ ...candidate, seedScore: seedScore(candidate) }))
    .sort((a, b) => b.seedScore - a.seedScore)
    .slice(0, 8);

  const detailed = [];
  for (const seed of seeds) detailed.push(await detailPlace(seed));
  const selectedTags = new Set(selected.all.flatMap((answer) => answer.tags));
  const hardFiltered = applyHardFilters(detailed, selectedTags);
  const topPlaces = hardFiltered.sort((a, b) => b.score - a.score).slice(0, 3);

  const recommendedPlaces = [];
  for (const place of topPlaces) {
    recommendedPlaces.push({
      title: place.title,
      address: place.address,
      score: place.score,
      matchedKeyword: place.matchedKeyword,
      aiReason: '근교 숲/수목원, 아이 동반, 짧은 보행, 그늘, 편의조건에 잘 맞는 후보입니다.',
      imageUrl: place.imageUrl,
      overview: String(place.overview || '').replace(/\s+/g, ' ').slice(0, 180),
      intro: place.intro,
      crowd: await crowdSignal(place),
      straightDistanceKm: roundNullable(place.straightDistanceKm),
      estimatedRoadDistanceKm: roundNullable(place.estimatedRoadDistanceKm),
      estimatedOneWayDriveMinutes: roundNullable(place.estimatedOneWayDriveMinutes, 0),
      estimatedRoundTripDriveMinutes: roundNullable(place.estimatedRoundTripDriveMinutes, 0),
      mapLink: mapLink(place),
    });
  }

  const result = {
    selectedQuestions: selected.all.map((answer) => ({
      group: answer.tagGroup,
      question: answer.question,
      answer: answer.answer,
      tags: answer.tags,
    })),
    geminiSubstituteResult: {
      personaTitle: `형님은 ${plan.persona.title}입니다!`,
      oneLine: plan.persona.oneLine,
      searchPlan: plan.toolPlan.searchTourPlaces,
      locationFilter: plan.toolPlan.locationFilter,
      candidateCount: candidates.length,
      recommendedPlaces,
      shareText: `${recommendedPlaces[0]?.title || '오늘의 여행지'} 어때요? 어디고가 취향에 맞춰 골라봤어요.`,
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

function applyHardFilters(places, selectedTags) {
  let filtered = [...places];
  const needsParking =
    selectedTags.has('parking') ||
    selectedTags.has('parking_close') ||
    selectedTags.has('parking_required') ||
    selectedTags.has('minimal_walk');

  if (needsParking) {
    const knownParking = filtered.filter((place) => {
      const parking = place.intro.parking || '';
      return /주차|가능/.test(parking) && !/불가능|불가|없음|없다/.test(parking);
    });
    if (knownParking.length >= 3) {
      filtered = knownParking;
    } else {
      const parkingFiltered = filtered.filter((place) => !/불가능|불가|없음|없다/.test(place.intro.parking || ''));
      if (parkingFiltered.length >= 3) filtered = parkingFiltered;
    }
  }

  return filtered;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
