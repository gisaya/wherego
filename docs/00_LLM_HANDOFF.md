# LLM 이어받기 요약

최종 갱신: 2026-07-09 KST

## 제품

`어디고`는 토스 앱 안에서 가볍게 여행 취향을 고르고, 국내 여행지 추천 결과를 바로 받는 Apps in Toss 미니앱입니다.

핵심 흐름:

- 여행 취향 질문에 답한다.
- 답변을 바탕으로 여행 성향을 한 문장으로 정의한다.
- 한국관광공사 관광정보 기반 후보 중 적합한 여행지를 추천한다.
- 결과 카드에서 지도 앱으로 이동한다.

## 현재 결정

- 앱 이름은 `어디고`.
- MVP에서는 TMAP 혼잡도 API를 쓰지 않는다. 비용이 있는 혼잡도/교통 기능은 후순위 고도화로 둔다.
- 초기 데이터 소스는 한국관광공사 국문 관광정보 서비스_GW API가 적합하다.
- 지역 혼잡도는 한국관광공사 빅데이터 지역별 방문자수_GW API를 보조 신호로 쓴다.
- 공공데이터포털 개인 API 인증키와 한국관광공사 API 엔드포인트는 로컬 `.env.local`에 저장했다. 원문 키는 문서나 Git에 남기지 않는다.
- AI는 Gemini Flash-Lite를 사용할 예정이며, 여행 성향 문장과 추천 카피 생성 및 관광지 API function calling 계획에 사용한다.
- AI/API 키는 클라이언트에 넣지 않는다.
- 실제 Apps in Toss 앱 구현은 Granite/TDS 기준으로 진행한다.
- 질문은 필수 3개 + 랜덤 5개 구조로 간다. 랜덤 5개는 서로 다른 태그 그룹에서 뽑는다.
- 위치 필터는 현재 위치 또는 사용자가 선택한 출발지를 기준으로 한다. MVP에서는 직선거리 x 1.35, 평균 45km/h, 15분 버퍼로 주행시간을 추정한다.

## 현재 구현 상태

- 앱 자산:
  - `assets/logo.png`
  - `assets/thumbnail.png`
- 약관/개인정보 정적 페이지:
  - `public/index.html`
  - `public/terms/service/index.html`
  - `public/terms/privacy/index.html`
- Vercel 배포:
  - `https://wherego-lake.vercel.app`
  - `https://wherego-lake.vercel.app/terms/service`
  - `https://wherego-lake.vercel.app/terms/privacy`
  - GitHub 자동 연결은 실패했고 현재는 CLI 수동 배포 상태.
- Vercel 정적 빌드:
  - `scripts/build-vercel-terms.cjs`
  - `vercel.json`
- Git remote:
  - `https://github.com/gisaya/wherego.git`
- 질문/추천 실험 파일:
  - `data/source-question-blueprint.json`
  - `data/general-question-bank.json`
  - `scripts/build-general-question-bank.cjs`
  - `scripts/probe-question-bank-result.cjs`
- 최근 검증:
  - 2026-07-08 21:57 KST: Vercel 정적 약관 빌드 성공.
  - 2026-07-08 22:05 KST: `.env.local` Git 제외 확인, 커밋 대상 인증키 패턴 검사 통과, Vercel 정적 약관 빌드 성공.
  - 2026-07-08 22:16 KST: Vercel production 배포 성공, `/`, `/terms/service`, `/terms/privacy` 모두 HTTP 200 확인.
  - 2026-07-09 KST: `scripts/probe-question-bank-result.cjs`로 국문 관광정보 API, 지역별 방문자수 API, 위치/왕복시간 필터, 주차 확인 필터까지 성공 확인.

## 운영 규칙

- 문서는 `docs/README.md` 기준으로 현재 문서만 따라간다.
- `저장` 요청은 `SAVE_PROTOCOL.md` 기준으로 handoff 갱신, 검증, commit, push까지 포함한다.
- `.env`, API 키, `.vercel/`, `node_modules/`, `dist/`, `.ait`는 커밋하지 않는다.
- 생성 자산은 실제 눈으로 확인한 뒤 프로젝트에 저장한다.

## 남은 우선순위

1. Vercel GitHub 자동 배포 연결.
2. Apps in Toss/Granite 앱 구조 스캐폴딩.
3. Apps in Toss 앱에서 서버 API route와 Gemini function calling 연결.
4. 결과 카드 UI와 리워드 광고 진입 흐름 설계.
