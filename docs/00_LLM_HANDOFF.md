# LLM 이어받기 요약

최종 갱신: 2026-07-10 KST

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
- AI는 Render 서버의 Gemini Flash-Lite를 최종 큐레이터로 사용한다. 클라이언트 선택지 메타데이터를 서버가 검색 계획으로 바꾸고, 관광지 후보를 5개 이하로 압축한 뒤 Gemini가 최종 1개 장소와 추천 카피를 고른다.
- AI/API 키는 클라이언트에 넣지 않는다.
- 실제 Apps in Toss 앱 구현은 Granite React Native 기준이다. 메인 앱은 TDS Provider로 감싸고 TDS `Text`/`Button`을 사용한다. 선택/지역 카드는 React Native `Pressable` 기반 고정 크기 카드다. 제출 전 실기기 시각 검수는 아직 필요하다.
- 질문은 필수 3개 + 랜덤 5개 구조로 간다. 랜덤 5개는 `crowd` 1개와 `mobility`/`accessibility` 중 1개를 포함하고, 나머지 3개는 서로 다른 태그 그룹에서 뽑는다.
- 위치 필터는 현재 위치 또는 사용자가 선택한 출발지를 기준으로 한다. MVP에서는 직선거리 x 1.35, 평균 45km/h, 15분 주행시간 버퍼, 10km 거리 버퍼로 이동 조건을 추정한다.
- 거리/지역 제약은 `max*`뿐 아니라 `min*`, `regionScope`, `preferredRegionGroup`, `stayType`까지 추천 프로브에서 해석한다.

## 현재 구현 상태

- 앱 자산:
  - `assets/logo.png`
  - `assets/thumbnail.png`
  - `public/assets/logo.png` (로컬/목업 정적 페이지용 복사본)
- 앱인토스/Granite 앱 구조:
  - `package.json`
  - `granite.config.ts`
  - `index.ts`
  - `require.context.ts`
  - `pages/index.tsx`
  - `pages/_404.tsx`
  - `src/_app.tsx`
  - `src/router.gen.ts`
  - `src/types/assets.d.ts`
  - `scripts/ait-build.ps1`
  - `.yarn/releases`, `.yarn/patches`
- 약관/개인정보 정적 페이지:
  - `public/index.html`
  - `public/terms/service/index.html`
  - `public/terms/privacy/index.html`
- Vercel 배포:
  - `https://wherego-lake.vercel.app`
  - `https://wherego-lake.vercel.app/terms/service`
  - `https://wherego-lake.vercel.app/terms/privacy`
  - GitHub 자동 연결은 실패했고 현재는 CLI 수동 배포 상태.
- 서버/API:
  - 기존 뭐샀지 Render 서버 `https://jbg.onrender.com`을 재사용한다.
  - `C:\Users\ESOL\Documents\jbg\apps\server`에 `POST /api/wherego/recommend` 라우트를 추가했다.
  - 서버는 선택지 메타데이터(tags/searchHints/constraints)로 검색 계획을 만들고, 한국관광공사 국문 관광정보 API 후보를 수집한 뒤 5개 이하로 압축한다.
  - Gemini(`GEMINI_WHEREGO_MODEL=gemini-3.1-flash-lite`)는 압축 후보와 메타데이터를 보고 최종 1개 장소와 이유를 고른다.
  - 지역별 방문자수는 최종 선택 전 crowd 보조 신호로 붙인다.
  - 검색 호출은 요청당 6회 기본값이며, `nationwide` 검색은 areaCode 없이 키워드 중심으로 호출한다.
  - 최종 선택 1개에만 상세 API를 조회하고, 검색/상세/DataLab 응답은 서버 메모리 캐시로 재사용한다.
  - 일부 관광공사 검색 호출이 타임아웃되어도 다른 호출에서 후보가 있으면 계속 진행한다.
  - 어디고 클라이언트는 `src/api/wheregoApi.ts`에서 이 API를 호출하고 45초 지연/실패 시 demo 결과로 fallback한다.
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
- 질문풀 현재 구조:
  - 원천질문: `movement_scope` 6개, `party_constraints` 7개, `destination_intent` 5개 변형
  - 일반질문: 13개 태그 그룹, 총 390문항, 그룹당 원천 선택지 12개
- 질문 플로우 목업:
  - `public/mockups/question-flow/index.html`
  - 위치 기준 선택, 원천 3개 + 일반 5개 랜덤 질문, 광고 게이트, 결과 카드까지 포함한다.
  - 이미지 없이 카드만 사용한다.
  - 2지선다는 큰 카드 2장, 4지선다는 2x2 카드 4장으로 보여준다.
- 첫 Granite 앱 화면:
  - `pages/index.tsx`
  - 현재 위치 또는 지역 선택 fallback
  - 현재 위치 권한은 첫 진입 즉시가 아니라 `현재 위치로 추천` 버튼을 누른 뒤에만 요청
  - 질문 8개 랜덤 생성
  - 질문 중 Apps in Toss 배너 광고
  - 결과 전 Apps in Toss 리워드 광고 게이트
  - 결과 카드의 네이버지도 열기 버튼
  - 리워드 광고 그룹 ID: `ait.v2.live.7f9040b7cff746c5`
  - 배너 광고 그룹 ID: `ait.v2.live.67b07bf813d74267`
  - `loadFullScreenAd`로 미리 로드하고 `showFullScreenAd`의 `userEarnedReward` 이벤트 이후 결과 화면을 연다.
  - 질문 화면 하단 배너는 `InlineAd`로 렌더한다.
  - `granite.config.ts`의 `brand.icon`은 사용자 제공 Toss static 로고 URL `https://static.toss.im/appsintoss/51165/be941510-6da6-4bba-982c-11824ab9a089.png`를 사용한다.
  - 첫 화면은 상단 로고 없이 한국관광공사 기반 추천 문구와 시작 버튼을 보여준다. 문구 블록은 화면 위쪽에 붙지 않도록 중앙 쪽으로 내렸다.
  - 결과 화면 상단 `어디고 / 추천 완료` 헤더는 숨긴다. 결과 카드 저장/공유 중심 화면으로 보이게 하기 위한 의도적 처리다.
  - 질문 카드는 선택 직후 선택 상태와 1초 로딩을 보여준 뒤 다음 질문이나 광고 안내 화면으로 이동한다.
  - 마지막 질문 선택은 추천 API를 호출하지 않는다. 추천/관광공사 분석은 `광고 보고 결과 보기` CTA를 누르는 시점에 시작하고, 광고 시청과 분석 완료가 모두 끝난 뒤 결과를 연다.
  - `카드 저장하기`는 숨겨진 `react-native-svg` 결과 카드를 `toDataURL`로 캡처한 뒤 Apps in Toss `saveBase64Data`로 1080x1350 PNG 결과 카드를 저장한다. Android `5.218.0`, iOS `5.216.0` 미만에서는 Apps in Toss `share` 텍스트로 fallback한다.
  - 리워드 게이트는 상단 헤더/진행 바를 숨기고, 추천 API/관광정보 준비가 시작된 뒤 로딩 스피너를 보여준다.
- 최근 검증:
  - 2026-07-08 21:57 KST: Vercel 정적 약관 빌드 성공.
  - 2026-07-08 22:05 KST: `.env.local` Git 제외 확인, 커밋 대상 인증키 패턴 검사 통과, Vercel 정적 약관 빌드 성공.
  - 2026-07-08 22:16 KST: Vercel production 배포 성공, `/`, `/terms/service`, `/terms/privacy` 모두 HTTP 200 확인.
  - 2026-07-09 KST: `scripts/probe-question-bank-result.cjs`로 국문 관광정보 API, 지역별 방문자수 API, 위치/왕복시간 필터, 주차 확인 필터까지 성공 확인.
  - 2026-07-09 KST: 질문지 보완 후 생성기/추천 프로브 문법 검사 통과, 질문풀 구조 검증 통과, 실제 API 프로브 성공.
  - 2026-07-09 KST: 질문 카드 목업에서 2지선다/4지선다, 배너 광고 영역, 리워드 게이트, 결과 카드 흐름 확인.
  - 2026-07-09 KST: `yarn install`, `yarn typecheck`, `yarn build` 성공. 앱인토스 산출물 `wherego.ait` 생성 확인. 최신 deploymentId는 `019f4475-b925-7a22-bca3-fed52822aee1`. 산출물은 Git 제외.
  - 2026-07-09 KST 저장 검증: `yarn typecheck`, `yarn build` 성공. 추천 API client, 리워드 광고 ID `ait.v2.live.7f9040b7cff746c5`, 15초 fallback timeout, 첫 화면 문구 변경 확인. 최신 build deploymentId는 `019f456c-799d-7d93-94d3-fd6ba89e22e5`.
  - 2026-07-09 KST push 후 Render smoke 성공: `jbg` health commit `3b7a8b6844e9e32ea47db6da9d04ab23387850b8`, `/api/wherego/recommend` HTTP 200, `source.planner=gemini`, 추천 3개, 첫 추천 `국립중앙박물관 전통염료식물원`.
  - 2026-07-09 KST 저장 검증: Wherego `yarn typecheck`, `yarn build` 성공. 앱인토스 산출물 `wherego.ait` 최신 deploymentId는 `019f45b7-4889-72c6-ac16-3d27c8c1336b`이며 Git 제외. jbg Wherego route 테스트 13개 성공, `py_compile` 성공. 실제 관광공사 랜덤 조합 테스트에서 원천 3개 + 일반 5개 답변으로 후보 수집 후 5개 이하 압축 확인. 전국 검색은 long-distance 후보를 허용하고, 단일 검색 타임아웃은 건너뛰도록 보강했다.
  - 2026-07-09 KST push 후 Render smoke 성공: `jbg` health commit `47013953a6b4ceaac5fa0927ba08941a0d376b11`, `/api/wherego/recommend` HTTP 200, `source.planner=metadata`, `source.curator=gemini`, 추천 1개, 첫 추천 `서울어린이대공원`, 네이버 지도 링크 존재.
  - 2026-07-09 KST Apps in Toss 가이드 재검토: MCP transport가 닫혀 공식 개발자센터 문서를 직접 확인했다. 비게임 TDS 적용, 위치 권한 요청 시점, 배너/리워드 광고 배치, 빌드/배포, 브랜드 아이콘 요구사항을 재점검했다. TDS 적용과 버튼 이후 위치 요청은 코드에 반영했고, Vercel은 약관 URL 전용으로 유지한다. 남은 출시 리스크는 `brand.icon`의 콘솔 로고 URL 확정과 실기기 Toss 앱 검수다.
  - 2026-07-09 KST 저장 검증: Vercel 약관 정적 빌드, `yarn typecheck`, `yarn build` 성공. 앱인토스 산출물 `wherego.ait` 최신 deploymentId는 `019f45e3-a0de-7e80-a3f8-464868942345`이며 Git 제외.
  - 2026-07-09 KST 저장 검증: 결과 화면 헤더 제거, 질문 카드 2열 고정, 리워드 게이트 로딩 표시, 초기 SVG 카드 저장 기능 구현. 약관 정적 빌드, `scripts/probe-question-bank-result.cjs --check`, `yarn typecheck`, `git diff --check`, `yarn build` 성공. 앱인토스 산출물 `wherego.ait` 최신 deploymentId는 `019f4666-aafa-7a02-b955-c802dffc027d`이며 Git 제외. 목업 브라우저 테스트에서 결과 헤더가 숨겨졌고 `C:\Users\ESOL\Downloads\wherego-일월수목원.svg` 저장을 확인했다.
  - 2026-07-09 KST 저장 오류 수정 검증: 카드 저장을 SVG 파일 저장에서 `react-native-svg` `toDataURL` 기반 PNG 저장으로 변경했다. `yarn typecheck`, `git diff --check`, `yarn build` 성공. 앱인토스 산출물 `wherego.ait` 최신 deploymentId는 `019f4675-4c16-7bf2-b6a2-caef2741f1f7`이며 Git 제외.
  - 2026-07-10 KST 저장 검증: 첫 화면 문구 블록을 앱과 목업 모두 중앙 쪽으로 내렸다. 약관 정적 빌드, `scripts/probe-question-bank-result.cjs --check`, `yarn typecheck`, `git diff --check`, `yarn build` 성공. 앱인토스 산출물 `wherego.ait` 최신 deploymentId는 `019f4916-8162-7022-8180-1e354788acc6`이며 Git 제외.
  - 2026-07-10 KST 저장 검증: 선택 카드 전환 로딩을 1초로 조정하고, 광고 전 화면 상단 헤더/진행 바 제거와 광고 CTA 시점 추천 분석 시작 흐름을 반영했다. 약관 정적 빌드, `scripts/probe-question-bank-result.cjs --check`, `yarn typecheck`, `git diff --check`, `yarn build` 성공. 앱인토스 산출물 `wherego.ait` 최신 deploymentId는 `019f492e-81c6-7044-986f-2f3028a34528`이며 Git 제외.

## 운영 규칙

- 문서는 `docs/README.md` 기준으로 현재 문서만 따라간다.
- `저장` 요청은 `SAVE_PROTOCOL.md` 기준으로 handoff 갱신, 검증, commit, push까지 포함한다.
- `.env`, API 키, `.vercel/`, `node_modules/`, `dist/`, `.ait`는 커밋하지 않는다.
- 생성 자산은 실제 눈으로 확인한 뒤 프로젝트에 저장한다.

## 남은 우선순위

1. 실제 Apps in Toss 앱에서 Render 추천 API 연동 흐름 테스트.
2. Apps in Toss 콘솔/실기기에서 navigation 로고와 콘솔 로고/썸네일이 의도대로 보이는지 확인한다.
3. PNG 카드 저장이 Toss 실기기와 주요 공유처에서 정상 동작하는지 확인한다.
4. 실기기 Toss 앱에서 위치 권한, 지역 fallback, 배너 광고, 리워드 광고, 결과 카드, 네이버지도 열기 검수.
5. Vercel GitHub 자동 배포 연결. 단, Vercel은 약관 URL 전용이다.
