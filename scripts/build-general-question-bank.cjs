#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const OUTPUT_PATH = path.resolve(__dirname, '../data/general-question-bank.json');

const TWO_PROMPTS = [
  '{label}, 어느 쪽이 더 좋아요?',
  '이번 여행의 {label}, 어떤 쪽이에요?',
  '{label} 중 더 끌리는 쪽은?',
  '오늘 가고 싶은 곳, {label} 기준은?',
  '{label}에서 더 중요한 건?',
  '지금 원하는 {label}, 어느 쪽이에요?',
  '여행지를 고를 때 보는 {label} 기준은?',
  '오늘 기분에 맞는 {label}, 어느 쪽이에요?',
  '{label}에서 피하고 싶은 쪽은?',
  '{label} 기준으로 하나를 고르면?',
  '도착했을 때 원하는 {label}, 어느 쪽이에요?',
  '이번 여행의 {label} 취향은?',
  '내 선택에 가까운 {label}, 어느 쪽이에요?',
  '{label}에서 놓치기 싫은 건?',
  '지금 더 끌리는 {label}, 어떤 쪽이에요?'
];

const FOUR_PROMPTS = [
  '{label}, 조금 더 구체적으로 고르면?',
  '목적지에서 원하는 {label}, 하나를 고르면?',
  '{label} 중 하나를 고르면?',
  '이번 여행에서 우선할 {label}, 하나를 고르면?',
  '도착해서 느끼고 싶은 {label}, 하나를 고르면?',
  '이번 여행에서 중요한 {label}, 하나를 고르면?',
  '{label}, 장소 조건으로 고르면?',
  '{label} 중 더 끌리는 건?',
  '오늘 하루에 맞는 {label}, 하나를 고르면?',
  '내 취향에 가까운 {label}, 하나를 고르면?',
  '여행지에서 기대하는 {label}, 하나를 고르면?',
  '내 선택과 가까운 {label}, 하나를 고르면?',
  '여행지 분위기를 좌우할 {label}, 하나를 고르면?',
  '{label}, 어느 방향이 좋아요?',
  '오늘 원하는 {label}, 하나를 고르면?'
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

const SIMILAR_OPTION_GROUPS = {
  crowd: [
    ['low_crowd', 'weekday', 'off_peak'],
    ['controlled', 'quiet_reservation'],
    ['spacious', 'popular_spacious']
  ],
  mobility: [
    ['minimal_walk', 'drive_view'],
    ['barrier_free', 'stroller', 'low_stairs'],
    ['public_transport', 'short_transfer']
  ],
  weather: [
    ['shade', 'heat_safe', 'canopy'],
    ['indoor', 'fine_dust_safe']
  ],
  activity: [
    ['experience', 'kids_experience', 'light_play'],
    ['walk', 'exhibition_walk']
  ],
  time_mood: [
    ['morning', 'early_start', 'sunrise'],
    ['sunset', 'evening'],
    ['half_day', 'last_minute']
  ],
  culture_style: [
    ['vintage', 'industrial_heritage'],
    ['street', 'art_village']
  ],
  food_link: [
    ['cafe', 'cafe_street', 'bakery'],
    ['destination_only', 'no_food_focus']
  ],
  accessibility: [
    ['baby', 'nursing'],
    ['safety', 'emergency_safe'],
    ['low_stairs', 'indoor_rest']
  ],
  season: [
    ['flower', 'spring_flower'],
    ['autumn', 'autumn_grass'],
    ['winter', 'winter_light'],
    ['water_season', 'summer_water'],
    ['evergreen', 'seasonless']
  ],
  photo: [
    ['photo_required', 'shareable'],
    ['nature_photo', 'flower_photo'],
    ['private_hidden', 'rest_first']
  ],
  healing_energy: [
    ['healing', 'comfort', 'meditative'],
    ['novelty', 'light_stimulus'],
    ['active_energy', 'kids_energy']
  ],
  route_style: [
    ['single', 'slow'],
    ['multi', 'packed'],
    ['stopover', 'return_stop']
  ]
};

const GROUPS = [
  {
    tagGroup: 'crowd',
    label: '인파 정도',
    why: 'DataLab 방문자수 기반 혼잡도 가중치와 직접 연결된다.',
    options: [
      opt('low_crowd', '한산한 숨은 곳', ['low_crowd', 'hidden'], ['한적한', '숨은 명소', '방문자수 낮은 지역']),
      opt('hotplace', '활기찬 인기 명소', ['hotplace', 'crowd_ok'], ['핫플', '인기 명소', '활기찬 거리']),
      opt('medium_crowd', '적당히 붐비는 유명지', ['medium_crowd', 'popular'], ['유명 관광지', '적당한 인파']),
      opt('controlled', '예약/정원 제한 공간', ['controlled_crowd', 'reservation'], ['예약제', '정원 제한', '관리형 공간']),
      opt('weekday', '평일에 여유로운 곳', ['weekday_low_crowd'], ['평일 추천', '여유로운 방문']),
      opt('weekend', '주말 에너지 있는 곳', ['weekend_lively'], ['주말 명소', '활기 있는 장소']),
      opt('local', '현지인 로컬 명소', ['local_crowd'], ['로컬 명소', '현지인 추천']),
      opt('landmark', '관광객 많은 랜드마크', ['tourist_landmark'], ['랜드마크', '대표 관광지']),
      opt('off_peak', '시간대 피해서 여유롭게', ['off_peak', 'crowd_flexible'], ['오전 방문', '평일', '혼잡 시간 회피']),
      opt('spacious', '넓고 여유로운 곳', ['spacious', 'low_density'], ['넓은 공원', '넓은 광장', '개방감']),
      opt('popular_spacious', '유명해도 넓은 곳', ['popular', 'spacious'], ['대표 관광지', '넓은 동선']),
      opt('quiet_reservation', '조용한 예약제 공간', ['quiet', 'reservation'], ['예약제', '소규모 관람'])
    ]
  },
  {
    tagGroup: 'mobility',
    label: '걷기/이동',
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
      opt('drive_view', '차에서 보는 풍경', ['drive_view', 'minimal_walk'], ['드라이브 코스', '전망'])
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
      opt('fine_dust_safe', '미세먼지 피하기', ['fine_dust_safe', 'indoor_required'], ['실내 관광지', '전시관']),
      opt('canopy', '나무 그늘 산책', ['canopy_walk', 'forest'], ['숲길', '나무 그늘'])
    ]
  },
  {
    tagGroup: 'landscape',
    label: '풍경 취향',
    why: '관광지 검색 키워드의 핵심 축이다.',
    options: [
      opt('sea', '바다와 수평선', ['sea', 'coast'], ['바다', '해변', '해안']),
      opt('forest', '숲과 나무 그늘', ['forest', 'shade'], ['숲', '수목원', '휴양림']),
      opt('lake', '호수와 데크길', ['lake', 'deck_walk'], ['호수', '저수지', '데크길']),
      opt('city_view', '도시 전망과 야경', ['city_view', 'night_view'], ['전망대', '야경', '도시뷰']),
      opt('valley', '계곡과 물소리', ['valley', 'river'], ['계곡', '강', '폭포']),
      opt('garden', '정원과 꽃길', ['garden', 'flower'], ['정원', '꽃', '식물원']),
      opt(
        'geological_wonder',
        '동굴과 지질 절경',
        ['cave', 'geology', 'unique_landscape'],
        ['동굴', '지질공원', '주상절리']
      ),
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
    tagGroup: 'outdoor_stay',
    label: '야외 체류 여부',
    why: '원할 때만 캠핑장, 야영장, 글램핑, 피크닉 가능한 공원을 목적지 후보로 좁힌다.',
    options: [
      opt('picnic_park', '돗자리 피크닉', ['picnic', 'outdoor_stay', 'light_stay'], ['피크닉', '도시공원', '잔디광장'], { destinationCategory: 'picnic', ktoContentTypeIds: ['12'] }),
      opt('picnic_waterfront', '물가 피크닉', ['picnic', 'waterfront', 'light_stay'], ['호수공원', '강변공원', '피크닉'], { destinationCategory: 'picnic', ktoContentTypeIds: ['12'] }),
      opt('picnic_forest', '숲 그늘 피크닉', ['picnic', 'forest', 'quiet'], ['수목원', '생태공원', '피크닉'], { destinationCategory: 'picnic', ktoContentTypeIds: ['12'] }),
      opt('campnic', '당일 캠크닉', ['campnic', 'day_camping', 'outdoor_stay'], ['캠핑장', '야영장', '캠크닉'], { destinationCategory: 'camping', ktoContentTypeIds: ['28'] }),
      opt('auto_camping', '오토캠핑장', ['camping', 'auto_camping', 'car_access'], ['오토캠핑장', '캠핑장'], { destinationCategory: 'camping', ktoContentTypeIds: ['28'] }),
      opt('glamping', '편한 글램핑', ['glamping', 'comfort_stay', 'camping'], ['글램핑', '캠핑장'], { destinationCategory: 'camping', ktoContentTypeIds: ['28'] }),
      opt('car_camping', '차박 가능한 곳', ['car_camping', 'drive_stay', 'camping'], ['차박', '오토캠핑장', '야영장'], { destinationCategory: 'camping', ktoContentTypeIds: ['28'] }),
      opt('forest_camp', '숲속 야영장', ['forest_camping', 'forest', 'quiet'], ['숲속야영장', '자연휴양림', '야영장'], { destinationCategory: 'camping', ktoContentTypeIds: ['28'] }),
      opt('waterfront_camp', '물가 캠핑장', ['waterfront_camping', 'waterfront', 'camping'], ['강변 캠핑장', '해변 캠핑장', '야영장'], { destinationCategory: 'camping', ktoContentTypeIds: ['28'] }),
      opt('family_camp', '가족 캠핑장', ['family_camping', 'kids', 'camping'], ['가족캠핑장', '오토캠핑장', '캠핑장'], { destinationCategory: 'camping', ktoContentTypeIds: ['28'] }),
      opt('facility_camp', '시설 좋은 캠핑장', ['camping_facility', 'comfort', 'restroom'], ['캠핑장', '오토캠핑장', '글램핑'], { destinationCategory: 'camping', ktoContentTypeIds: ['28'] }),
      opt('no_outdoor_stay', '캠핑·피크닉 제외', ['no_outdoor_stay'], [], { destinationCategory: 'standard', ktoContentTypeIds: ['12'] }, '일반 관광지')
    ]
  },
  {
    tagGroup: 'time_mood',
    label: '시간대/분위기',
    why: '운영시간, 야경, 노을, 오전 방문 같은 추천 맥락을 만든다.',
    options: [
      opt('morning', '상쾌한 오전', ['morning'], ['오전 방문', '아침 산책']),
      opt('daylight', '사진 잘 나오는 낮', ['daylight'], ['낮 풍경', '자연광']),
      opt('sunset', '노을 지는 저녁', ['sunset'], ['노을명소', '낙조']),
      opt('night', '조명 켜진 밤', ['night_view'], ['야경', '빛축제']),
      opt('always_open', '상시 개방 선호', ['always_open_preferred'], ['상시 개방', '공원']),
      opt('reservation_ok', '예약제도 괜찮음', ['reservation_ok'], ['예약제', '운영시간']),
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
    label: '문화공간 취향',
    why: '자연 외 후보를 추천할 때 장소의 성격을 구체화한다.',
    options: [
      opt('traditional', '한옥과 전통 골목', ['traditional', 'hanok'], ['한옥마을', '전통거리']),
      opt('modern', '모던한 건축물', ['modern', 'architecture'], ['건축명소', '복합문화공간']),
      opt('vintage', '오래된 공간 재생', ['vintage', 'culture_space'], ['폐공장', '문화공간']),
      opt(
        'temple_meditation',
        '사찰과 명상 공간',
        ['temple', 'meditation', 'heritage'],
        ['사찰', '산사', '템플스테이']
      ),
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
    label: '먹거리/카페',
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
    label: '편의 조건',
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
    label: '사진 취향',
    why: '결과 카드와 SNS 공유에 적합한 장소를 고르는 데 쓰인다.',
    options: [
      opt('photo_required', '사진이 중요한 곳', ['photo_required'], ['포토존', '사진명소']),
      opt('rest_first', '사진보다 휴식', ['rest_first'], ['휴식', '힐링']),
      opt('nature_photo', '자연 풍경 사진', ['nature_photo'], ['자연풍경', '수목원']),
      opt('architecture_photo', '건축물 사진', ['architecture_photo'], ['건축명소']),
      opt('night_photo', '야경 사진', ['night_photo'], ['야경', '조명']),
      opt('street_photo', '감성 골목 사진', ['street_photo'], ['골목', '벽화마을']),
      opt('shareable', 'SNS 공유용 사진', ['shareable'], ['SNS', '공유']),
      opt('private_hidden', '나만 알고 싶은 곳', ['private_hidden'], ['숨은 명소']),
      opt('landmark_object', '큰 조형물 앞 사진', ['landmark_object', 'photo_required'], ['조형물', '랜드마크']),
      opt('reflection_photo', '물가 반영 사진', ['reflection_photo', 'waterfront'], ['호수', '반영 사진']),
      opt('flower_photo', '꽃 배경 사진', ['flower_photo', 'flower'], ['꽃밭', '정원']),
      opt('family_photo', '가족사진 남기기', ['family_photo', 'kids'], ['가족사진', '포토존'])
    ]
  },
  {
    tagGroup: 'healing_energy',
    label: '휴식/활동',
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

function opt(id, label, tags, searchHints, constraints = {}, caption = '') {
  return { id, label, tags, searchHints, constraints, caption };
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
      searchHints: source.searchHints,
      ...(Object.keys(source.constraints || {}).length > 0 ? { constraints: source.constraints } : {}),
      ...(source.caption ? { caption: source.caption } : {})
    };
  });
}

function makeQuestion(group, type, index, optionIndexes, questionOverride = '') {
  const prompt = type === 'select_2' ? TWO_PROMPTS[index] : FOUR_PROMPTS[index];
  const offset = type === 'select_2' ? index + 1 : index + 16;

  return {
    id: `gen_${group.tagGroup}_${String(offset).padStart(2, '0')}`,
    type,
    tagGroup: group.tagGroup,
    label: group.label,
    question: questionOverride || render(prompt, group),
    tags: [group.tagGroup],
    options: makeOptions(group, optionIndexes)
  };
}

function pairPatternsForGroup(group) {
  const allPairs = [...TWO_PAIR_PATTERNS];
  for (let left = 0; left < group.options.length; left += 1) {
    for (let right = left + 1; right < group.options.length; right += 1) {
      allPairs.push([left, right]);
    }
  }

  const similarGroups = SIMILAR_OPTION_GROUPS[group.tagGroup] || [];
  const seen = new Set();
  return allPairs
    .filter(([left, right]) => {
      const key = `${Math.min(left, right)}:${Math.max(left, right)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      const leftId = group.options[left].id;
      const rightId = group.options[right].id;
      return !similarGroups.some((ids) => ids.includes(leftId) && ids.includes(rightId));
    })
    .slice(0, TWO_PROMPTS.length);
}

function buildGroup(group) {
  if (group.tagGroup === 'outdoor_stay') {
    return buildOutdoorStayGroup(group);
  }

  const pairPatterns = pairPatternsForGroup(group);
  const twoQuestions = TWO_PROMPTS.map((_, index) => makeQuestion(group, 'select_2', index, pairPatterns[index]));
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

function buildOutdoorStayGroup(group) {
  const neutralIndex = group.options.findIndex((option) => option.id === 'no_outdoor_stay');
  const positiveIndexes = group.options.map((_, index) => index).filter((index) => index !== neutralIndex);
  const twoQuestions = TWO_PROMPTS.map((_, index) => {
    const positiveIndex = positiveIndexes[index % positiveIndexes.length];
    const positiveLabel = group.options[positiveIndex].label;
    const prompts = [
      `${positiveLabel} 가능한 곳도 후보에 넣을까요?`,
      `이번 여행에 ${positiveLabel}을 반영할까요?`,
      `${positiveLabel} 중심 여행지도 괜찮아요?`,
      `목적지가 ${positiveLabel}에 맞으면 더 좋아요?`
    ];
    return makeQuestion(group, 'select_2', index, [positiveIndex, neutralIndex], prompts[index % prompts.length]);
  });
  const fourPrompts = [
    '이번 여행에서 원하는 야외 체류 방식은?',
    '캠핑이나 피크닉을 넣는다면 어떤 쪽이에요?',
    '여행지에서 해보고 싶은 야외 체류는?',
    '오늘 일정에 가장 가까운 야외 방식은?',
    '목적지 조건으로 넣고 싶은 야외 체류는?',
    '낮부터 머물기 좋은 방식은?',
    '자연에서 시간을 보낸다면 어떤 형태가 좋아요?',
    '준비 부담까지 생각하면 어느 쪽이에요?',
    '차를 타고 떠나 즐기고 싶은 방식은?',
    '한 장소에 오래 머문다면 어떤 쪽이에요?',
    '바깥에서 쉬는 하루를 고른다면?',
    '이번 추천에 반영할 야외 활동은?',
    '여행지의 체류 형태를 하나 고르면?',
    '풍경과 휴식을 함께 즐길 방식은?',
    '야외에서 보내는 시간을 어떻게 만들까요?'
  ];
  const fourQuestions = FOUR_PROMPTS.map((_, index) => {
    const optionIndexes = [
      positiveIndexes[index % positiveIndexes.length],
      positiveIndexes[(index + 4) % positiveIndexes.length],
      positiveIndexes[(index + 7) % positiveIndexes.length],
      neutralIndex
    ];
    return makeQuestion(group, 'select_4', index, optionIndexes, fourPrompts[index]);
  });
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
  version: '2026-07-12',
  appName: '어디고',
  philosophy:
    '어디고의 질문은 성격 테스트가 아니라 여행지를 추천하기 위한 입력이다. 모든 질문은 관광지 검색어, 지역/이동 범위, 접근성 필터, 혼잡도 가중치 중 하나로 연결되어야 한다.',
  runtimeSelection: {
    randomTagGroupCount: 4,
    questionsPerSelectedTagGroup: 1,
    requiredTagGroups: ['crowd'],
    oneOfTagGroups: ['mobility', 'accessibility'],
    mutuallyExclusiveTagGroups: [
      ['mobility', 'accessibility'],
      ['activity', 'healing_energy'],
      ['landscape', 'photo'],
      ['weather', 'season']
    ],
    similarOptionGroups: SIMILAR_OPTION_GROUPS,
    excludedSourceQuestionIds: ['intent_mood_01'],
    sourceQuestionConflicts: {
      party_mobility_binary_01: ['mobility'],
      party_mobility_01: ['mobility'],
      party_pet_amenity_01: ['accessibility'],
      intent_landscape_01: ['landscape', 'photo'],
      intent_nature_city_binary_01: ['landscape', 'photo', 'culture_style'],
      intent_rest_active_binary_01: ['activity', 'healing_energy'],
      intent_edu_play_binary_01: ['activity', 'culture_style'],
      intent_activity_01: ['activity', 'healing_energy']
    },
    remainingRandomTagGroupCount: 1,
    rule: '일반질문 실행 시 crowd 1개, mobility/accessibility 중 1개, 목적지 유형을 직접 가르는 질문 1개를 포함한다. 나머지 1개는 다른 tagGroup에서 뽑되 상호배타 테마와 선택된 원천질문 주제는 함께 출제하지 않는다.'
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
