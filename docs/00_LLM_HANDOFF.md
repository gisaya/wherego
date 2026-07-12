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
- AI는 Render 서버의 Gemini Flash-Lite를 최종 큐레이터로 사용한다. 클라이언트 선택지 메타데이터를 서버가 검색 계획으로 바꾸고, 관광공사/DataLab 후보를 5개 이하로 압축한 뒤, 전면광고 실제 노출 후 Gemini가 최종 1개 장소와 추천 카피를 고른다.
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
  - `C:\Users\ESOL\Documents\jbg\apps\server`에 `POST /api/wherego/questions`, `POST /api/wherego/candidates`, `POST /api/wherego/recommend` 라우트를 추가했다.
  - 서버는 선택지 메타데이터(tags/searchHints/constraints)로 검색 계획을 만들고, `/api/wherego/candidates`에서 한국관광공사 국문 관광정보 API 후보를 수집한다. 좌표/주소/종료 행사 필터, 동일 장소 군집화, 의도별 상위 6개 제한 뒤 DataLab 방문자수 신호를 붙여 재점수하고 5개 이하로 압축한다. 이 단계는 Gemini를 쓰지 않는다.
  - Gemini(`GEMINI_WHEREGO_MODEL=gemini-3.1-flash-lite`)는 전면광고 `show`/`impression` 뒤 `/api/wherego/recommend`에서 압축 후보와 메타데이터를 보고 최종 1개 장소와 이유를 고른다.
  - `/api/wherego/recommend`는 준비된 `candidateSet`이 있으면 관광공사 검색을 반복하지 않고, 없으면 기존 all-in-one fallback으로 검색부터 수행한다.
  - 답변을 장소 검색 의도 3개로 정규화하고 법정동 시도 코드, 콘텐츠 유형, 관광공사 대/중/소분류를 붙인다. 세 검색을 동시에 실행해 호출당 최대 50행을 모두 평가하며, 필터 통과 후보가 5개 미만일 때만 네 번째 보완 호출을 사용한다. `nationwide` 검색은 지역 코드 없이 호출한다. 최종 장소의 common/intro 상세도 병렬 조회한다.
  - 최종 선택 1개에만 상세 API를 조회하고, 검색/상세/DataLab 응답은 서버 메모리 캐시로 재사용한다.
  - 일부 관광공사 검색 호출이 타임아웃되어도 다른 호출에서 후보가 있으면 계속 진행한다.
  - 어디고 클라이언트는 `src/api/wheregoApi.ts`에서 이 API를 호출하고 45초 지연/실패 시 결과 화면으로 넘어가지 않는다. 리워드 게이트에 남아 `추천 다시 시도`를 보여준다.
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
  - 일반질문: 14개 태그 그룹, 총 420문항, 그룹당 원천 선택지 12개
  - 최신 추가 태그 그룹: `outdoor_stay` / `캠핑/피크닉`
  - 카피 검토용 JSON: `docs/wherego-copy-review.json`
- 질문 플로우 목업:
  - `public/mockups/question-flow/index.html`
  - 위치 기준 선택, 원천 3개 + 일반 5개 랜덤 질문, 광고 게이트, 결과 카드까지 포함한다.
  - 이미지 없이 카드만 사용한다.
  - 2지선다는 큰 카드 2장, 4지선다는 2x2 카드 4장으로 보여준다.
- 첫 Granite 앱 화면:
  - `pages/index.tsx`
  - 현재 위치 또는 지역 선택 fallback
  - `지역 직접 선택` 버튼은 TDS Button 대신 커스텀 `Pressable`을 써서 토스 화면에서 한글이 잘리지 않게 했다.
  - 현재 위치 권한은 첫 진입 즉시가 아니라 `현재 위치로 추천` 버튼을 누른 뒤에만 요청
  - 질문 8개 랜덤 생성
  - 질문 중 Apps in Toss 배너 광고
  - 결과 전 Apps in Toss 전면광고 게이트
  - 결과 카드의 네이버지도 열기 버튼
  - 전면광고 그룹 ID: `ait.v2.live.69c443b05e6a42ea`
  - 배너 광고 그룹 ID: `ait.v2.live.67b07bf813d74267`
  - 배너가 없는 첫 화면에서 `loadFullScreenAd`를 미리 호출하고, 질문 흐름을 시작할 때 로드된 광고를 취소하지 않는다. 앞선 로드가 실패하거나 타임아웃된 경우에만 광고 게이트에서 다시 로드한다. `showFullScreenAd`의 `show`/`impression` 이후 Gemini 추천을 시작하고, 이벤트가 생략된 환경에서는 `dismissed`를 한 번만 fallback으로 사용한다. 출시 소스에는 라이브 광고 그룹 ID만 두고 15초 로드 타임아웃과 재시도를 제공한다.
  - 질문 화면 하단 배너는 `InlineAd`로 렌더한다.
  - `granite.config.ts`의 `brand.icon`은 사용자 제공 Toss static 로고 URL `https://static.toss.im/appsintoss/51165/be941510-6da6-4bba-982c-11824ab9a089.png`를 사용한다.
  - 첫 화면은 상단 로고 없이 한국관광공사 기반 추천 문구와 시작 버튼을 보여준다. 문구 블록은 화면 위쪽에 붙지 않도록 중앙 쪽으로 내렸다.
  - 결과 화면 상단 `어디고 / 추천 완료` 헤더는 숨긴다. 결과 카드 저장/공유 중심 화면으로 보이게 하기 위한 의도적 처리다.
  - 질문 카드는 선택 직후 선택 상태와 1초 로딩을 보여준 뒤 다음 질문이나 광고 안내 화면으로 이동한다.
  - 마지막 질문 답변 직후 무료 공공데이터 후보 준비(`/api/wherego/candidates`)를 먼저 시작해 화면 전환과 광고 대기 시간에 겹친다. Gemini 최종 추천(`/api/wherego/recommend`)은 전면광고 `show`/`impression` 이후에만 호출한다.
  - Gemini 최종 선택은 `gemini-3.1-flash-lite`, `thinkingLevel=minimal`, 출력 640토큰, 최대 1회 재시도, 15초 타임아웃을 사용한다. 응답 `source.model`과 `source.timingsMs`로 실제 모델/단계별 지연을 확인한다.
  - DataLab은 관광지 검색과 동시에 약 30일 지연 구간의 14일 데이터를 조회한다. 최근 7일 평균과 직전 7일 평균을 비교하고, 데이터가 비었을 때만 이전 구간을 한 번 더 확인한다. 실패 결과는 5분 캐시한다.
  - KTO 이미지는 `cpyrhtDivCd=Type1`일 때만 결과 카드 합성에 사용하고 `사진 · 한국관광공사` 출처를 표시한다. Type3 이미지는 장소 추천에는 사용할 수 있지만 합성 카드 이미지에서는 제외한다.
  - Gemini는 전면광고가 실제 표시된 `show`/`impression` 시점부터 실행해 광고 노출 시간과 분석 시간을 겹친다. 광고가 닫힌 뒤에도 응답이 남아 있으면 전용 AI 로딩 화면을 보여준다. 이 화면은 `광고 확인 완료`, 스피너, `관광정보 후보 확인 / 방문자수 신호 비교 / AI 최종 장소 선택` 단계를 표시한다.
  - AI 분석 화면과 결과 화면 맨 아래에 각각 배너 광고를 표시한다. 전면광고와 숨은 배너가 동시에 잡히지 않도록 `dismissed` 이후에만 해당 배너를 마운트한다.
  - 추천 API 실패 시 임시/demo 결과를 열지 않는다. 리워드 게이트에서 `추천 다시 시도` 버튼을 보여준다.
  - 출발지 선택 뒤 서버 `POST /api/wherego/questions`에서 질문 세트를 받아온다. 서버 실패/미배포 상태에서는 앱 번들 문제은행으로 fallback한다.
  - 질문 세트 로딩 화면은 `질문지를 준비하고 있어요.` 문구를 사용한다. 선택지 번호는 긴 문구에 눌리지 않도록 우상단 고정 원형 배지로 렌더링한다.
  - 매 질문 세트는 원천 `destination_intent` 외에도 모든 선택지가 실제 관광지 검색 의도로 연결되는 일반 질문을 최소 1개 포함한다.
  - 선택 화면은 두 번째 보조문구를 숨기고 출발 기준, eyebrow, 질문 제목, 선택 카드만 보여준다.
  - 선택 카드의 작은 보조문구는 한 줄 첫 조각만 보여준다. 서버 caption이나 검색 힌트가 `A · B` 형태여도 화면에는 첫 조각만 보여 middle-dot이 남지 않게 한다.
  - `카드 저장하기`는 숨겨진 `react-native-svg` 결과 카드를 `toDataURL`로 캡처한 뒤 Apps in Toss `saveBase64Data`로 1080x1350 PNG 결과 카드를 저장한다. Android `5.218.0`, iOS `5.216.0` 미만에서는 저장 미지원 메시지만 보여주며 공유창은 열지 않는다.
  - 저장용 SVG는 Arial 고정 폰트를 제거했고, 화면 밖이 아니라 투명 상태로 화면 안에 렌더해 PNG 저장 깨짐 위험을 줄였다.
  - 저장용 PNG 카드는 화면 안쪽으로 더 좁게 중앙 배치했고, 추천 이유/AI 선택 근거 줄 수를 늘렸으며, 위치 박스의 라벨과 주소 세로 정렬을 다시 맞췄다. 맨 아래 작은 출처/답변 기준 문구는 제거했다.
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
  - 2026-07-09 KST 저장 검증: 결과 화면 헤더 제거, 질문 카드 2열 고정, 리워드 게이트 로딩 표시, 초기 SVG 카드 저장 기능 구현. 약관 정적 빌드, `scripts/probe-question-bank-result.cjs --check`, `yarn typecheck`, `git diff --check`, `yarn build` 성공. 앱인토스 산출물 `wherego.ait` 최신 deploymentId는 `019f4666-aafa-7a02-b955-c802dffc027d`이며 Git 제외. 목업 브라우저 테스트에서 결과 헤더가 숨겨졌고 legacy SVG 카드 저장을 확인했다.
  - 2026-07-09 KST 저장 오류 수정 검증: 카드 저장을 SVG 파일 저장에서 `react-native-svg` `toDataURL` 기반 PNG 저장으로 변경했다. `yarn typecheck`, `git diff --check`, `yarn build` 성공. 앱인토스 산출물 `wherego.ait` 최신 deploymentId는 `019f4675-4c16-7bf2-b6a2-caef2741f1f7`이며 Git 제외.
  - 2026-07-10 KST 저장 검증: 첫 화면 문구 블록을 앱과 목업 모두 중앙 쪽으로 내렸다. 약관 정적 빌드, `scripts/probe-question-bank-result.cjs --check`, `yarn typecheck`, `git diff --check`, `yarn build` 성공. 앱인토스 산출물 `wherego.ait` 최신 deploymentId는 `019f4916-8162-7022-8180-1e354788acc6`이며 Git 제외.
  - 2026-07-10 KST 저장 검증: 선택 카드 전환 로딩을 1초로 조정하고, 광고 전 화면 상단 헤더/진행 바 제거와 광고 CTA 시점 추천 분석 시작 흐름을 반영했다. 약관 정적 빌드, `scripts/probe-question-bank-result.cjs --check`, `yarn typecheck`, `git diff --check`, `yarn build` 성공. 앱인토스 산출물 `wherego.ait` 최신 deploymentId는 `019f492e-81c6-7044-986f-2f3028a34528`이며 Git 제외.
  - 2026-07-10 KST 저장 검증: 지역 직접 선택 버튼/지역 카드 텍스트 클리핑 수정, 추천 실패 시 결과 fallback 차단, `추천 다시 시도` 흐름, 카드 저장 공유 fallback 제거, 저장용 SVG 폰트/렌더링 수정 반영. Render smoke는 HTTP 200, `source.curator=gemini`, 추천 `서울어린이대공원`, 이미지 URL 존재. 약관 정적 빌드, `scripts/probe-question-bank-result.cjs --check`, `yarn typecheck`, `git diff --check`, `yarn build` 성공. 앱인토스 산출물 `wherego.ait` 최신 deploymentId는 `019f494b-cb34-72b1-a1f3-1ee8f64da56c`이며 Git 제외.
  - 2026-07-10 KST 저장 검증: `jbg` 백엔드 질문 생성 endpoint `POST /api/wherego/questions` 추가, 앱의 서버 질문 세트 우선 호출/fallback, 질문지 생성 로딩 화면, TDS Button loading, 선택지 번호 고정 배지와 긴 문구 제한 반영. `jbg` Wherego route unittest 16개 성공, `wherego` `yarn typecheck`, `git diff --check`, `yarn build` 성공. 앱인토스 산출물 `wherego.ait` 최신 deploymentId는 `019f4a16-6e2b-7383-a0b6-6d42ff134754`이며 Git 제외.
  - 2026-07-10 KST 저장 검증: 추천 흐름을 무료 후보 준비(`/api/wherego/candidates`)와 Gemini 최종 선택(`/api/wherego/recommend`)으로 분리했다. 앱은 리워드 광고 CTA에서 KTO/DataLab 후보 준비를 시작하고, 광고 보상 완료 뒤에만 Gemini를 호출한다. 광고 완료 후에는 별도 AI 로딩 화면을 보여준다. `jbg` Wherego route unittest 18개, `wherego` `yarn typecheck`, `git diff --check`, `yarn build` 성공. 앱인토스 산출물 `wherego.ait` 최신 deploymentId는 `019f4a38-eefa-7f99-a0b0-217c6cb4363b`이며 Git 제외.
  - 2026-07-10 KST 저장 검증: 선택 화면 보조문구를 제거하고 저장용 PNG 카드의 가로 폭, 추천 이유/AI 선택 근거 줄 수, 위치 행 세로 정렬을 조정했다. `wherego` `yarn typecheck`, `git diff --check`, `yarn build` 성공. 앱인토스 산출물 `wherego.ait` 최신 deploymentId는 `019f4a54-006b-7c33-9188-b575b14278ef`이며 Git 제외.
  - 2026-07-10 KST 저장 검증: 선택 카드의 작은 보조문구를 한 줄 첫 조각으로 정리해 middle-dot이 남지 않게 했고, 저장용 PNG 카드 하단의 작은 출처/답변 기준 문구를 제거했다. `wherego` `yarn typecheck`, `git diff --check`, `yarn build` 성공. 앱인토스 산출물 `wherego.ait` 최신 deploymentId는 `019f4a6c-74da-7641-9d84-451de40c32f3`이며 Git 제외.
  - 2026-07-10 KST 저장 검증: 일반 질문은행을 14개 태그 그룹 / 420문항으로 확장하고 `캠핑/피크닉` 질문군을 추가했다. 질문카드 자동생성 문구에서 `형님`, 내부 기획어, 콜론식 어색한 문장을 제거했고, 외부 AI 검토용 `docs/wherego-copy-review.json`을 만들었다. `jbg` Gemini 결과카드 프롬프트는 짧은 한국어와 짧은 근거 2~3개를 요구하도록 조정했다. `jbg` Wherego route unittest 20개, `wherego` 위험 문구 scan 0건, terms build, `yarn typecheck`, `git diff --check`, `yarn build` 성공. 앱인토스 산출물 `wherego.ait` 최신 deploymentId는 `019f4a9d-4aa5-7dd9-a5b1-80d223a40738`이며 Git 제외.
  - 2026-07-12 KST 저장 검증: 질문 세트마다 목적지 유형을 직접 가르는 일반 질문을 최소 1개 보장하고 선택지 메타데이터를 관광공사 대/중/소분류 검색 조건까지 연결했다. 관광지 검색은 호출당 최대 50개를 모두 평가한 뒤 유효성 필터, 동일 장소 군집화, 의도별 최대 6개 제한을 거치며, DataLab 혼잡도를 반영한 뒤 Gemini 후보 5개로 압축한다. 실제 고양시 조합에서 `64 -> 13 -> 5` 후보 축소와 약 1.0초 후보 준비를 확인했다. `jbg` Wherego route unittest 41개, Python 컴파일, `wherego` TypeScript 검사, `git diff --check`, AIT build가 성공했다. 앱인토스 산출물 `wherego.ait` deploymentId는 `019f540b-ac97-7bf5-b5b8-df99a1057e95`이며 Git 제외.

## 운영 규칙

- 문서는 `docs/README.md` 기준으로 현재 문서만 따라간다.
- `저장` 요청은 `SAVE_PROTOCOL.md` 기준으로 handoff 갱신, 검증, commit, push까지 포함한다.
- `.env`, API 키, `.vercel/`, `node_modules/`, `dist/`, `.ait`는 커밋하지 않는다.
- 생성 자산은 실제 눈으로 확인한 뒤 프로젝트에 저장한다.

## 남은 우선순위

1. 실제 Apps in Toss 앱에서 Render 질문/후보/추천 API 연동 흐름 테스트.
2. 실기기에서 전면광고 로드, `show`/`impression` 이후 Gemini 호출, AI 로딩 화면, 결과 자동 이동이 정상인지 확인한다.
3. Apps in Toss 콘솔/실기기에서 navigation 로고와 콘솔 로고/썸네일이 의도대로 보이는지 확인한다.
4. PNG 카드 저장이 Toss 실기기에서 정상 저장되고 공유창이 열리지 않는지 확인한다.
5. `docs/wherego-copy-review.json`을 다른 AI/카피 검토자에게 돌리고, 검색 태그와 추천 목적을 해치지 않는 문구 개선만 반영한다.
6. 실기기 Toss 앱에서 위치 권한, 지역 fallback, 배너 광고, 전면광고, 결과 카드, 네이버지도 열기 검수.
7. Vercel GitHub 자동 배포 연결. 단, Vercel은 약관 URL 전용이다.
