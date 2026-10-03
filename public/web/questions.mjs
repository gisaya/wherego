// Generated from the JBG question banks; regenerate with scripts/sync-weekend-questions.mjs.
export const questionBankVersion = {
  "source": "2026-07-22-v2.2",
  "general": "2026-07-20-v2.1",
  "sourceDigest": "1eaf9e0e350c369b87db72c59ea306606491d4b8b63c2aa140516e20ba43a851",
  "generalDigest": "7bdf33736050f904fccb94d47a98ca98f5bfe137cd52cd020f4e4b85205a623b"
};
export const questions = [
  {
    "id": "move_time_binary_01",
    "type": "source",
    "theme": "movement_scope",
    "eyebrow": "이동 범위",
    "question": "오늘은 가볍게 갈까요, 멀리 제대로 갈까요?",
    "options": [
      {
        "key": "A",
        "label": "가볍게 근교로",
        "tags": [
          "nearby",
          "short_drive",
          "daytrip"
        ],
        "constraints": {
          "maxRoundTripMinutes": 120
        }
      },
      {
        "key": "B",
        "label": "멀리 제대로",
        "tags": [
          "wide_area",
          "long_drive_ok",
          "destination_first"
        ],
        "constraints": {
          "areaScope": "nationwide"
        }
      }
    ]
  },
  {
    "id": "party_companion_binary_01",
    "type": "source",
    "theme": "party_constraints",
    "eyebrow": "동행자/인원/제약",
    "question": "오늘 동행은 어느 쪽에 가까워요?",
    "options": [
      {
        "key": "A",
        "label": "혼자·친구와 가볍게",
        "tags": [
          "solo_or_friends",
          "flexible",
          "low_constraint_party"
        ],
        "constraints": {
          "partyConstraintLevel": "low"
        }
      },
      {
        "key": "B",
        "label": "아이·부모님과 편하게",
        "tags": [
          "family_care",
          "kids_or_senior",
          "safe",
          "easy_walk"
        ],
        "constraints": {
          "partyConstraintLevel": "high",
          "preferFlatWalk": true
        }
      }
    ]
  },
  {
    "id": "intent_nature_city_binary_01",
    "type": "source",
    "theme": "destination_intent",
    "eyebrow": "장소 취향/목적",
    "question": "자연이 좋아요, 공간이 좋아요?",
    "options": [
      {
        "key": "A",
        "label": "자연 속으로",
        "tags": [
          "nature",
          "forest",
          "waterfront"
        ],
        "constraints": {
          "contentPreference": "nature",
          "intentSelectionPolicy": "semantic"
        }
      },
      {
        "key": "B",
        "label": "문화공간으로",
        "tags": [
          "culture",
          "city",
          "indoor_ok"
        ],
        "constraints": {
          "contentPreference": "culture_city",
          "ktoContentTypeIds": [
            "14"
          ],
          "intentSelectionPolicy": "strict"
        }
      }
    ]
  },
  {
    "id": "gen_weather_01",
    "type": "general",
    "theme": "weather",
    "eyebrow": "날씨 대응",
    "question": "날씨 대응, 어느 쪽이 더 좋아요?",
    "options": [
      {
        "key": "A",
        "label": "실내 대안 필수",
        "tags": [
          "indoor_required",
          "weather_safe"
        ],
        "constraints": {}
      },
      {
        "key": "B",
        "label": "비 와도 운치 있는 곳",
        "tags": [
          "rain_ok",
          "cloudy_mood"
        ],
        "constraints": {}
      }
    ]
  },
  {
    "id": "gen_photo_02",
    "type": "general",
    "theme": "photo",
    "eyebrow": "사진 취향",
    "question": "이번 여행의 사진 취향, 어떤 쪽이에요?",
    "options": [
      {
        "key": "A",
        "label": "자연 풍경 사진",
        "tags": [
          "nature_photo"
        ],
        "constraints": {}
      },
      {
        "key": "B",
        "label": "건축물 사진",
        "tags": [
          "architecture_photo"
        ],
        "constraints": {}
      }
    ]
  },
  {
    "id": "gen_healing_energy_01",
    "type": "general",
    "theme": "healing_energy",
    "eyebrow": "휴식/활동",
    "question": "휴식/활동, 어느 쪽이 더 좋아요?",
    "options": [
      {
        "key": "A",
        "label": "회복과 휴식",
        "tags": [
          "healing",
          "rest"
        ],
        "constraints": {}
      },
      {
        "key": "B",
        "label": "자극과 활동",
        "tags": [
          "active",
          "novelty"
        ],
        "constraints": {}
      }
    ]
  }
];
