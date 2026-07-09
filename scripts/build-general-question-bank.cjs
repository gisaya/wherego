#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const OUTPUT_PATH = path.resolve(__dirname, '../data/general-question-bank.json');

const TWO_PROMPTS = [
  '{label}, 어느 쪽이 더 좋아요?',
  '이번 여행에서 {label} 기준은?',
  '{label} 선택지를 하나만 고르면?',
  '오늘 목적지에서 {label}: 어떤 편이 맞을까요?',
  '{label} 쪽으로 더 끌리는 건?',
  '결과 추천에서 {label}: 어떻게 볼까요?',
  '여행지를 고를 때 {label}: 어느 쪽이에요?',
  '오늘은 {label} 기준을 어떤 느낌으로 잡을까요?',
  '{label}에서 피하고 싶은 쪽은?',
  '{label} 기준으로 좁히면?',
  '도착했을 때 {label}: 어떤 편이면 좋겠어요?',
  '이번 추천에서 {label} 우선순위는?',
  '{label} 선택지는 어느 쪽이 가까워요?',
  '여행 만족도를 위해 {label}에서 무엇이 중요해요?',
  '지금 기분에 맞는 {label} 선택지는?'
];

const FOUR_PROMPTS = [
  '{label} 기준을 조금 더 구체적으로 고르면?',
  '오늘 목적지에서 {label}: 어떤 쪽이면 좋겠어요?',
  '{label} 기준으로 네 가지 중 하나를 고르면?',
  '여행지 추천에서 {label}: 무엇을 우선할까요?',
  '도착 후 체감할 {label} 포인트는?',
  '이번 여행 카드에 담길 {label} 포인트는?',
  '{label} 기준을 여행지 검색어로 바꾸면?',
  '장소 후보를 좁히는 {label} 기준은?',
  '오늘 하루에 맞는 {label} 조합은?',
  '형님 취향에 가까운 {label} 선택지는?',
  '추천 결과에서 더 보고 싶은 {label} 포인트는?',
  '{label} 기준을 가장 잘 설명하는 선택지는?',
  '여행지 분위기를 좌우할 {label} 포인트는?',
  '장소를 특정하려면 {label} 기준은 어떻게 갈까요?',
  '마지막으로 {label} 기준을 고르면?'
];

const TWO_PAIR_PATTERNS = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [8, 9],
  [10, 11],
  [0, 2],
  [1, 3],
  [4, 8],
  [5, 9],
  [6, 10],
  [7, 11],
  [0, 11],
  [1, 10],
  [4, 9]
];

const FOUR_SET_PATTERNS = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [8, 9, 10, 11],
  [0, 2, 4, 8],
  [1, 3, 5, 9],
  [2, 6, 10, 11],
  [3, 7, 8, 11],
  [0, 5, 6, 10],
  [1, 4, 7, 9],
  [2, 3, 8, 10],
  [0, 6, 9, 11],
  [1, 5, 8, 10],
  [0, 3, 7, 11],
  [2, 4, 6, 8],
  [1, 5, 9, 11]
];

const GROUPS = [
  {
    tagGroup: 'crowd',
    label: '인파/혼잡도',
    why: 'DataLab 방문자수 기반 혼잡도 가중치와 직접 연결된다.',
    options: [
      opt('low_crowd', '한산한 숨은 곳', ['low_crowd', 'hidden'], ['한적한', '숨은 명소', '방문자수 낮은 지역']),
      opt('hotplace', '활기찬 인기 명소', ['hotplace', 'crowd_ok'], ['핫플', '인기 명소', '활기찬 거리']),
      opt('medium_crowd', '적당히 사람 있는 유명지', ['medium_crowd', 'popular'], ['유명 관광지', '적당한 인파']),
      opt('controlled', '예약/정원 제한 공간', ['controlled_crowd', 'reservation'], ['예약제', '정원 제한', '관리형 공간']),
      opt('weekday', '평일에 여유로운 곳', ['weekday_low_crowd'], ['평일 추천', '여유로운 방문']),
      opt('weekend', '주말 에너지 있는 곳', ['weekend_lively'], ['주말 명소', '활기 있는 장소']),
      opt('local', '현지인이 많은 로컬 장소', ['local_crowd'], ['로컬 명소', '현지인 추천']),
      opt('landmark', '관광객 많은 랜드마크', ['tourist_landmark'], ['랜드마크', '대표 관광지']),
      opt('off_peak', '시간대 피해서 여유롭게', ['off_peak', 'crowd_flexible'], ['오전 방문', '평일', '혼잡 시간 회피']),
      opt('spacious', '넓어서 답답하지 않은 곳', ['spacious', 'low_density'], ['넓은 공원', '넓은 광장', '개방감']),
      opt('popular_spacious', '유명하지만 동선 넓은 곳', ['popular', 'spacious'], ['대표 관광지', '넓은 동선']),
      opt('quiet_reservation', '조용한 예약제 공간', ['quiet', 'reservation'], ['예약제', '소규모 관람'])
    ]
  },
  {
    tagGroup: 'mobility',
    label: '보행/접근성',
    why: '추천지가 실제로 갈 수 있는 장소인지 결정한다.',
    options: [
      opt('minimal_walk', '주차 후 5분 컷', ['minimal_walk', 'parking_close'], ['입구 가까움', '주차장 가까움']),
      opt('easy_walk', '30분 산책 정도', ['easy_walk', 'promenade'], ['산책로', '평지', '둘레길']),
      opt('long_walk', '1시간 이상 걷기', ['long_walk', 'trail'], ['트레킹', '긴 산책', '숲길']),
      opt('slope_ok', '언덕/계단도 가능', ['slope_ok', 'active'], ['전망대', '계단', '등산로']),
      opt('public_transport', '대중교통 접근', ['public_transport_required'], ['대중교통', '역/터미널 근처']),
      opt('car_only', '차로만 접근해도 됨', ['car_only_ok'], ['차량 접근', '드라이브']),
      opt('barrier_free', '유모차/휠체어 편한 길', ['barrier_free', 'flat_walk'], ['무장애', '데크길', '평지']),
      opt('rough_path', '조금 거친 길도 감수', ['rough_path_ok'], ['흙길', '자연길', '오솔길']),
      opt('stroller', '유모차 밀기 편한 곳', ['stroller_ok', 'flat_walk'], ['유모차', '평지', '무장애']),
      opt('low_stairs', '계단 적은 곳', ['low_stairs', 'easy_path_required'], ['계단 적음', '완만한 길']),
      opt('short_transfer', '입구까지 환승 적은 곳', ['short_transfer', 'access_easy'], ['역 근처', '정류장 근처']),
      opt('drive_view', '차에서 풍경 보기 좋은 곳', ['drive_view', 'minimal_walk'], ['드라이브 코스', '전망'])
    ]
  },
  {
    tagGroup: 'weather',
    label: '날씨 대응',
    why: '실내/야외 후보와 비/더위 리스크를 조절한다.',
    options: [
      opt('indoor', '실내 대안 필수', ['indoor_required', 'weather_safe'], ['실내', '박물관', '전시관']),
      opt('rain_mood', '비 와도 운치 있는 곳', ['rain_ok', 'cloudy_mood'], ['비 오는 숲', '안개', '호수']),
      opt('sunny', '맑은 날 야외', ['sunny_outdoor', 'open_view'], ['야외', '전망', '정원']),
      opt('shade', '그늘 많은 곳', ['shade_required', 'summer_safe'], ['그늘', '숲길', '수목원']),
      opt('water_breeze', '강바람/바닷바람', ['water_breeze'], ['강변', '해변', '수변공원']),
      opt('evening', '저녁 산책에 좋은 곳', ['evening_walk'], ['저녁 산책', '노을', '야경']),
      opt('seasonless', '날씨 덜 타는 곳', ['seasonless', 'stable'], ['상시 방문', '사계절']),
      opt('outdoor_only', '완전 야외도 괜찮음', ['outdoor_only_ok'], ['야외 명소', '자연 경관']),
      opt('heat_safe', '더위 피하기 좋은 곳', ['heat_safe', 'shade_required'], ['그늘', '실내', '수목원']),
      opt('cold_safe', '추워도 괜찮은 곳', ['cold_safe', 'indoor_mix'], ['실내', '온실', '박물관']),
      opt('fine_dust_safe', '미세먼지 피할 수 있는 곳', ['fine_dust_safe', 'indoor_required'], ['실내 관광지', '전시관']),
      opt('canopy', '나무 그늘 산책', ['canopy_walk', 'forest'], ['숲길', '나무 그늘'])
    ]
  },
  {
    tagGroup: 'landscape',
    label: '풍경/지형',
    why: '관광지 검색 키워드의 핵심 축이다.',
    options: [
      opt('sea', '바다와 수평선', ['sea', 'coast'], ['바다', '해변', '해안']),
      opt('forest', '숲과 나무 그늘', ['forest', 'shade'], ['숲', '수목원', '휴양림']),
      opt('lake', '호수와 데크길', ['lake', 'deck_walk'], ['호수', '저수지', '데크길']),
      opt('city_view', '도시 전망과 야경', ['city_view', 'night_view'], ['전망대', '야경', '도시뷰']),
      opt('valley', '계곡과 물소리', ['valley', 'river'], ['계곡', '강', '폭포']),
      opt('garden', '정원과 꽃길', ['garden', 'flower'], ['정원', '꽃', '식물원']),
      opt('plain', '넓은 평지와 들판', ['open_plain', 'field'], ['들판', '초원', '평지']),
      opt('mountain', '높은 산과 조망', ['mountain', 'altitude_view'], ['산', '전망', '능선']),
      opt('wetland', '습지와 갈대길', ['wetland', 'reed'], ['습지', '갈대', '생태공원']),
      opt('island_port', '섬과 작은 항구', ['island', 'port'], ['섬', '항구', '해안 산책']),
      opt('hanok_alley', '한옥과 골목 풍경', ['hanok', 'street'], ['한옥마을', '전통거리']),
      opt('architecture', '예쁜 건축물', ['architecture', 'city_view'], ['건축명소', '복합문화공간'])
    ]
  },
  {
    tagGroup: 'activity',
    label: '활동/체험',
    why: '관광지 타입과 체류 방식을 결정한다.',
    options: [
      opt('walk', '천천히 산책', ['walk', 'healing'], ['산책로', '둘레길']),
      opt('photo', '사진 많이 찍기', ['photo', 'shareable'], ['포토존', '전망대']),
      opt('experience', '직접 체험하기', ['experience'], ['체험마을', '체험관']),
      opt('food_cafe', '맛집/카페까지 묶기', ['food', 'cafe'], ['카페', '맛집', '거리']),
      opt('active', '몸을 쓰는 액티비티', ['active', 'leports'], ['레포츠', '카트', '서핑']),
      opt('viewing', '보기만 해도 좋은 곳', ['viewing_ok'], ['전시', '관람', '전망']),
      opt('kids_experience', '아이와 체험하기', ['kids', 'family_activity'], ['생태체험', '어린이 체험']),
      opt('single_stay', '한 장소에 오래 머물기', ['single_destination', 'slow_travel'], ['체류형', '하루 코스']),
      opt('picnic', '돗자리 펴고 쉬기', ['picnic', 'rest'], ['피크닉', '잔디광장']),
      opt('exhibition_walk', '전시 보고 걷기', ['exhibition', 'walk'], ['미술관', '전시관', '문화공간']),
      opt('local_shopping', '로컬 상점 구경', ['local_shop', 'street'], ['소품샵', '전통시장', '골목']),
      opt('light_play', '가벼운 놀이시설', ['light_play', 'kids'], ['놀이터', '체험시설'])
    ]
  },
  {
    tagGroup: 'time_mood',
    label: '시간대/무드',
    why: '운영시간, 야경, 노을, 오전 방문 같은 추천 맥락을 만든다.',
    options: [
      opt('morning', '상쾌한 오전', ['morning'], ['오전 방문', '아침 산책']),
      opt('daylight', '사진 잘 나오는 낮', ['daylight'], ['낮 풍경', '자연광']),
      opt('sunset', '노을 지는 저녁', ['sunset'], ['노을명소', '낙조']),
      opt('night', '조명 켜진 밤', ['night_view'], ['야경', '빛축제']),
      opt('always_open', '상시 개방 선호', ['always_open_preferred'], ['상시 개방', '공원']),
      opt('reservation_ok', '예약/마감 있어도 괜찮음', ['reservation_ok'], ['예약제', '운영시간']),
      opt('early_start', '아침 일찍 출발', ['early_start'], ['일출', '오전']),
      opt('late_start', '느지막이 출발', ['late_start'], ['오후 코스', '저녁']),
      opt('half_day', '반나절만 가볍게', ['half_day', 'short_stay'], ['반나절', '짧은 외출']),
      opt('full_day', '하루 종일 머물기', ['full_day', 'long_stay'], ['하루 코스', '체류형']),
      opt('sunrise', '해 뜨는 시간', ['sunrise', 'early_start'], ['일출', '새벽']),
      opt('last_minute', '마감 전 짧게', ['last_minute', 'short_visit'], ['마감 전', '짧은 관람'])
    ]
  },
  {
    tagGroup: 'culture_style',
    label: '문화/공간 스타일',
    why: '자연 외 후보를 추천할 때 장소의 성격을 구체화한다.',
    options: [
      opt('traditional', '한옥과 전통 골목', ['traditional', 'hanok'], ['한옥마을', '전통거리']),
      opt('modern', '모던한 건축물', ['modern', 'architecture'], ['건축명소', '복합문화공간']),
      opt('vintage', '오래된 공간 재생', ['vintage', 'culture_space'], ['폐공장', '문화공간']),
      opt('raw_nature', '자연 그대로의 공간', ['raw_nature'], ['자연경관', '숲길']),
      opt('history', '역사와 유래 있는 곳', ['history', 'heritage'], ['문화재', '역사명소']),
      opt('trend', '요즘 새로 뜨는 곳', ['new_hotplace', 'trend'], ['신상 명소', '핫플']),
      opt('exhibition', '전시/해설이 있는 곳', ['learning', 'exhibition'], ['전시', '박물관']),
      opt('street', '골목과 거리 감성', ['street', 'local'], ['골목', '거리', '마을']),
      opt('book_space', '책방과 도서관', ['book_space', 'quiet'], ['도서관', '책방', '북카페']),
      opt('art_village', '예술마을', ['art_village', 'photo'], ['예술마을', '벽화마을']),
      opt('industrial_heritage', '산업유산 공간', ['industrial_heritage', 'culture_space'], ['폐공장', '문화비축기지']),
      opt('local_festival', '지역 축제 공간', ['local_festival', 'event'], ['지역축제', '행사'])
    ]
  },
  {
    tagGroup: 'food_link',
    label: '맛집/카페 연계',
    why: '관광지 하나만 추천할지 주변 코스까지 묶을지 결정한다.',
    options: [
      opt('cafe', '대형 카페', ['cafe'], ['대형 카페', '뷰 카페']),
      opt('local_food', '로컬 맛집', ['local_food'], ['로컬 맛집', '향토음식']),
      opt('market', '전통시장', ['market'], ['전통시장', '시장 먹거리']),
      opt('destination_only', '장소만 좋아도 됨', ['destination_only'], ['관광지 중심']),
      opt('safe_food', '검증된 식당', ['safe_food'], ['평점 좋은 식당']),
      opt('quiet_food', '한적한 식사', ['quiet_food'], ['조용한 식당']),
      opt('cafe_street', '카페 거리', ['cafe_street'], ['카페거리']),
      opt('no_food_focus', '먹거리는 제외', ['no_food_focus'], ['먹거리 제외']),
      opt('bakery', '베이커리까지', ['bakery', 'cafe'], ['베이커리 카페', '빵지순례']),
      opt('kids_food', '아이 식사 편한 곳', ['kids_food', 'family'], ['아이와 식사', '가족 식당']),
      opt('picnic_food', '도시락/피크닉', ['picnic_food', 'picnic'], ['피크닉', '도시락']),
      opt('many_choices', '먹거리 선택지 많은 곳', ['food_choices'], ['푸드코트', '맛집거리'])
    ]
  },
  {
    tagGroup: 'accessibility',
    label: '편의시설/무장애',
    why: '강한 제약으로 필터에 가까운 역할을 한다.',
    options: [
      opt('baby', '아이 편의시설', ['kids_facility_required', 'baby_facility'], ['수유실', '기저귀 교환대']),
      opt('pet', '반려동물 동반', ['pet_friendly', 'pet_required'], ['반려견 동반', '펫 프렌들리']),
      opt('restroom', '화장실/쉼터', ['restroom', 'rest_area'], ['화장실', '쉼터']),
      opt('no_constraints', '특별히 없음', ['no_constraints'], ['제약 없음']),
      opt('low_stairs', '계단 적은 곳', ['low_stairs'], ['계단 적음', '평지']),
      opt('parking', '주차 편의', ['parking'], ['주차 가능', '공영주차장']),
      opt('signage', '안내 표지 잘 된 곳', ['signage'], ['안내판', '관광안내']),
      opt('safety', '안전한 동선', ['safe_route'], ['안전', '가족']),
      opt('nursing', '수유/기저귀 편의', ['nursing_room', 'baby_facility'], ['수유실', '기저귀 교환대']),
      opt('indoor_rest', '실내 쉼터', ['indoor_rest', 'weather_safe'], ['실내 쉼터', '휴게공간']),
      opt('simple_booking', '예약/매표 간단', ['simple_booking'], ['현장 발권', '간편 예약']),
      opt('emergency_safe', '응급/안전 대응', ['emergency_safe', 'safe_route'], ['안전요원', '응급실 근처'])
    ]
  },
  {
    tagGroup: 'season',
    label: '계절감',
    why: '꽃, 단풍, 물놀이, 온천 등 계절성 장소 추천에 필요하다.',
    options: [
      opt('flower', '꽃과 정원', ['flower', 'garden'], ['꽃', '정원', '수목원']),
      opt('green', '푸른 숲', ['green', 'forest'], ['초록', '숲', '휴양림']),
      opt('autumn', '단풍/갈대', ['autumn', 'reed'], ['단풍', '갈대']),
      opt('winter', '눈/온천/실내', ['winter', 'hot_spring', 'indoor'], ['온천', '실내', '겨울']),
      opt('festival', '기간 한정 축제', ['festival_ok'], ['축제', '행사']),
      opt('evergreen', '언제 가도 좋은 곳', ['evergreen_place'], ['상시', '사계절']),
      opt('water_season', '물가 계절감', ['water_season'], ['물놀이', '수변']),
      opt('seasonless', '계절 덜 타는 곳', ['seasonless'], ['계절 무관']),
      opt('spring_flower', '봄꽃 명소', ['spring_flower', 'flower'], ['벚꽃', '봄꽃']),
      opt('summer_water', '여름 물놀이', ['summer_water', 'water_play'], ['물놀이', '계곡']),
      opt('autumn_grass', '가을 억새길', ['autumn_grass', 'reed'], ['억새', '갈대']),
      opt('winter_light', '겨울 빛/실내', ['winter_light', 'indoor'], ['빛축제', '실내'])
    ]
  },
  {
    tagGroup: 'photo',
    label: '사진/공유성',
    why: '결과 카드와 SNS 공유에 적합한 장소를 고르는 데 쓰인다.',
    options: [
      opt('photo_required', '사진이 중요한 곳', ['photo_required'], ['포토존', '사진명소']),
      opt('rest_first', '사진보다 휴식', ['rest_first'], ['휴식', '힐링']),
      opt('nature_photo', '자연 풍경 사진', ['nature_photo'], ['자연풍경', '수목원']),
      opt('architecture_photo', '건축물 사진', ['architecture_photo'], ['건축명소']),
      opt('night_photo', '야경 사진', ['night_photo'], ['야경', '조명']),
      opt('street_photo', '감성 골목 사진', ['street_photo'], ['골목', '벽화마을']),
      opt('shareable', 'SNS 공유하기 좋은 곳', ['shareable'], ['SNS', '공유']),
      opt('private_hidden', '나만 알고 싶은 곳', ['private_hidden'], ['숨은 명소']),
      opt('landmark_object', '큰 조형물 앞 사진', ['landmark_object', 'photo_required'], ['조형물', '랜드마크']),
      opt('reflection_photo', '물가 반영 사진', ['reflection_photo', 'waterfront'], ['호수', '반영 사진']),
      opt('flower_photo', '꽃 배경 사진', ['flower_photo', 'flower'], ['꽃밭', '정원']),
      opt('family_photo', '가족사진 남기기', ['family_photo', 'kids'], ['가족사진', '포토존'])
    ]
  },
  {
    tagGroup: 'healing_energy',
    label: '힐링/에너지',
    why: '추천 문구와 페르소나를 여행지 중심으로 만드는 데 쓰인다.',
    options: [
      opt('healing', '회복과 휴식', ['healing', 'rest'], ['힐링', '휴식']),
      opt('active_energy', '자극과 활동', ['active', 'novelty'], ['액티비티', '새로운 경험']),
      opt('comfort', '편안함', ['comfort'], ['편안한 장소']),
      opt('romance', '설렘', ['romance'], ['데이트', '노을']),
      opt('achievement', '성취감', ['achievement'], ['전망대', '트레킹']),
      opt('novelty', '새로움', ['novelty'], ['이색 명소']),
      opt('silent', '조용한 자연 소리', ['silent', 'nature_sound'], ['물소리', '숲소리']),
      opt('lively', '활기찬 소리', ['lively_sound'], ['버스킹', '시장']),
      opt('meditative', '멍 때리기 좋은 곳', ['meditative', 'quiet'], ['명상', '물멍', '숲멍']),
      opt('light_stimulus', '가벼운 자극', ['light_novelty', 'novelty'], ['이색 체험', '신상 명소']),
      opt('kids_energy', '아이 에너지 소진', ['kids_energy', 'family_activity'], ['놀이터', '체험시설']),
      opt('sentimental', '감성 충전', ['sentimental', 'photo'], ['감성 카페', '노을'])
    ]
  },
  {
    tagGroup: 'route_style',
    label: '동선/코스',
    why: '단일 목적지 추천인지 주변 코스 묶음인지 결정한다.',
    options: [
      opt('single', '목적지 하나', ['single_destination'], ['한 장소', '체류형']),
      opt('multi', '주변까지 코스', ['multi_stop'], ['주변 코스', '연계 관광']),
      opt('stopover', '경유지 들르기', ['stopover_ok'], ['경유지', '가는 길']),
      opt('direct', '바로 목적지', ['direct_route'], ['직행', '목적지 우선']),
      opt('slow', '느슨하게 1곳', ['slow_route'], ['느린 여행']),
      opt('packed', '여러 곳 촘촘히', ['packed_route'], ['도장깨기', '여러 장소']),
      opt('scenic_drive', '드라이브 풍경 중요', ['scenic_drive'], ['드라이브 코스']),
      opt('easy_return', '쉽게 귀가', ['easy_return'], ['복귀 편한 코스']),
      opt('short_parking_route', '주차장-목적지 짧게', ['short_parking_route', 'minimal_walk'], ['주차장 가까움', '입구 가까움']),
      opt('meal_link', '식사 전후 짧게', ['meal_link', 'short_visit'], ['식사 전후', '근처 관광']),
      opt('backup_plan', '비상 플랜 있는 코스', ['backup_plan', 'weather_safe'], ['실내 대안', '주변 코스']),
      opt('return_stop', '귀가길에 들르기', ['return_stop', 'stopover_ok'], ['귀가길', '경유지'])
    ]
  }
];

function opt(id, label, tags, searchHints) {
  return { id, label, tags, searchHints };
}

function render(template, group) {
  return template.replaceAll('{label}', group.label);
}

function makeOptions(group, indexes) {
  return indexes.map((optionIndex, index) => {
    const source = group.options[optionIndex];
    return {
      key: String.fromCharCode(65 + index),
      sourceId: source.id,
      label: source.label,
      tags: source.tags,
      searchHints: source.searchHints
    };
  });
}

function makeQuestion(group, type, index, optionIndexes) {
  const prompt = type === 'select_2' ? TWO_PROMPTS[index] : FOUR_PROMPTS[index];
  const offset = type === 'select_2' ? index + 1 : index + 16;

  return {
    id: `gen_${group.tagGroup}_${String(offset).padStart(2, '0')}`,
    type,
    tagGroup: group.tagGroup,
    label: group.label,
    question: render(prompt, group),
    tags: [group.tagGroup],
    options: makeOptions(group, optionIndexes)
  };
}

function buildGroup(group) {
  const twoQuestions = TWO_PROMPTS.map((_, index) =>
    makeQuestion(group, 'select_2', index, TWO_PAIR_PATTERNS[index])
  );
  const fourQuestions = FOUR_PROMPTS.map((_, index) =>
    makeQuestion(group, 'select_4', index, FOUR_SET_PATTERNS[index])
  );
  const questions = [...twoQuestions, ...fourQuestions];

  return {
    tagGroup: group.tagGroup,
    label: group.label,
    why: group.why,
    questionCount: questions.length,
    select2Count: twoQuestions.length,
    select4Count: fourQuestions.length,
    questions
  };
}

const tagGroups = GROUPS.map(buildGroup);

const output = {
  version: '2026-07-09',
  appName: '어디고',
  philosophy:
    '어디고의 질문은 성격 테스트가 아니라 여행지를 추천하기 위한 입력이다. 모든 질문은 관광지 검색어, 지역/이동 범위, 접근성 필터, 혼잡도 가중치 중 하나로 연결되어야 한다.',
  runtimeSelection: {
    randomTagGroupCount: 5,
    questionsPerSelectedTagGroup: 1,
    requiredTagGroups: ['crowd'],
    oneOfTagGroups: ['mobility', 'accessibility'],
    remainingRandomTagGroupCount: 3,
    rule: '일반질문 실행 시 crowd 1개와 mobility/accessibility 중 1개를 먼저 포함하고, 나머지 3개는 서로 다른 tagGroup에서 뽑는다.'
  },
  minimums: {
    tagGroupCount: 10,
    questionsPerTagGroup: 30,
    includeSelect2AndSelect4: true
  },
  counts: {
    tagGroupCount: tagGroups.length,
    totalQuestionCount: tagGroups.reduce((sum, group) => sum + group.questionCount, 0),
    questionsPerTagGroup: 30,
    select2PerTagGroup: 15,
    select4PerTagGroup: 15
  },
  tagGroups
};

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(
  JSON.stringify(
    {
      outputPath: OUTPUT_PATH,
      tagGroupCount: output.counts.tagGroupCount,
      totalQuestionCount: output.counts.totalQuestionCount
    },
    null,
    2
  )
);
