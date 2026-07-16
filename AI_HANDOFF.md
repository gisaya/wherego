# 어디고 AI Handoff

최종 갱신: 2026-07-16 KST

## 목표

`어디고`는 짧은 선택형 질문으로 국내 관광지를 1곳 추천하는 Apps in Toss 비게임 미니앱이다. 한국관광공사 관광정보와 지역별 방문자수 데이터를 서버에서 수집하고 Gemini가 압축 후보 중 최종 장소와 이유를 결정한다.

## 저장소와 서비스

- 앱/약관: `C:\Users\ESOL\Documents\wherego`, GitHub `gisaya/wherego`, 브랜치 `master`
- API: `C:\Users\ESOL\Documents\jbg`, GitHub `gisaya/jbg`, 브랜치 `main`
- 운영 API: `https://jbg.onrender.com`
- 약관: `https://wherego-lake.vercel.app/terms/service`, `https://wherego-lake.vercel.app/terms/privacy`
- 생성물 `*.ait`, 키, 인증서, `.env*`, 로컬 로그는 Git에 넣지 않는다.

## 현재 제품 결정

- 질문은 총 7개다. 원천 3개, 검색 영향이 큰 일반 3개, 약한 재미 질문 1개를 한 세트 안에서 중복 없이 섞는다.
- 질문과 선택지의 단일 원본은 `jbg/apps/server/backend/app/resources/wherego/`다. 앱에는 로컬 질문 fallback이 없다.
- 사용자는 현재 위치 또는 직접 선택한 출발 지역을 사용한다.
- 후보 준비는 한국관광공사 KorService2와 DataLab을 사용하고 Gemini를 호출하지 않는다.
- 서버가 유효성, 거리, 하드 제약, 동일 장소 군집화, 방문자수 신호를 적용해 5~7개로 압축한다.
- Gemini 3.1 Flash-Lite는 압축 후보와 답변 메타데이터를 보고 최종 1개와 짧은 근거만 만든다.
- 실제 길찾기 API는 사용하지 않는다. 거리는 직선거리 기반 도로거리/시간 추정치이며 지도 열기는 네이버지도 검색 링크를 사용한다.
- 방문자수는 지역 단위 참고 신호다. 장소 단위 실시간 혼잡도로 표현하지 않는다.

## 현재 앱 흐름

1. `/` 또는 `/promotion` 진입
2. 출발 기준 선택
3. 서버 질문 7개 수신
4. 카드 선택, 질문별 배너 광고
5. 마지막 답변 후 무료 후보 준비
6. 결과 전 전면광고 노출
7. 광고 `show`/`impression` 이후 Gemini 추천 시작
8. 필요 시 AI 로딩 화면
9. 결과 카드, 저장, 네이버지도, 홈 복귀

라우트 파일은 얇게 유지한다.

- `pages/index.tsx`: 일반 진입 `/`
- `pages/promotion.tsx`: 혜택 진입 `/promotion`
- `src/WheregoApp.tsx`: 공용 앱 UI와 상태 흐름
- `src/api/wheregoApi.ts`: 서버 API
- `src/promotion/resultPromotion.ts`: 프로모션 SDK와 로컬 1회 방어

## 사용량과 결제

- 기본 추천: KST 기준 하루 2회
- 리워드 광고: 완료 시 +1회, 하루 최대 2회
- 친구 공유: 완료 시 +3회, 하루 1회
- 인앱결제: 소모성 AI 추천 10회권, 일일 크레딧 뒤에 차감, 미사용 횟수는 만료 없음
- 서버가 예약/확정/환불과 주문 멱등성을 관리한다.
- 결제는 버튼 시점 Toss 로그인과 mTLS 주문 검증을 사용한다.

## 광고와 프로모션

- 배너 광고 ID: `ait.v2.live.67b07bf813d74267`
- 결과 전 전면광고 ID: `ait.v2.live.69c443b05e6a42ea`
- 횟수 충전 리워드 광고 ID: `ait.v2.live.7f9040b7cff746c5`
- 친구 공유 리워드 모듈 ID: `1e6b212b-9093-4546-9991-99f478262910`
- 일반 `/` 진입에서는 프로모션 UI와 SDK를 실행하지 않는다.
- 혜택 `/promotion` 진입에서만 결과 화면 프로모션을 실행한다.
- 운영 프로모션 코드: `01KXJHNBZ46JPHND9R3VH7S9TF`
- 운영 지급액: 50원
- 테스트 코드는 `RUNBOOK.md`에만 기록하며 출시 AIT에 넣지 않는다.
- 지급 전 서버 중복 방지 예약이 실패하면 SDK를 호출하지 않는다. 안전하게 해제된 일시 오류만 결과 화면에서 재시도할 수 있다.

## 결과 카드

- 화면과 저장 이미지는 관광공사 대표 이미지를 우선 사용한다.
- 저장은 `react-native-svg`를 1080x1350 PNG로 렌더링한 뒤 `saveBase64Data`를 호출한다.
- 저장 버튼은 공유창을 열지 않는다.
- 결과에는 관광지명, 성향 요약, 추천 이유, 위치, AI 선택 근거를 표시한다.

## 서버 핵심 경계

- `POST /api/wherego/questions`
- `POST /api/wherego/candidates`
- `POST /api/wherego/recommend`
- `POST /api/wherego/usage`, `/usage/reward`, `/usage/link`
- `POST /api/wherego/promotion/attempt`
- `POST /api/wherego/iap/products`, `/iap/grant`, `/iap/reconcile`
- `POST /api/wherego/login/exchange`, `/login/unlink`

API 키와 Gemini 키는 Render 환경변수에만 둔다. 클라이언트에는 공개 가능한 ID와 API base URL만 포함한다.

## 최근 변경

- 일반 진입과 프로모션 진입을 분리하고 공용 UI를 `src/WheregoApp.tsx`로 이동해 페이지 초기화 순환을 제거했다.
- 명시 지역 선택은 질문 JSON의 `regionPolicy`, 허용 지역 코드와 주소 prefix로 KTO 검색과 Gemini 후보를 함께 제한한다.
- 운영 프로모션 지급액을 50원으로 변경했다.
- 코드 리뷰에서 프로모션 서버 guard 장애 시 SDK를 계속 호출하던 fail-open 동작을 제거했다.
- Jest와 Granite 테스트 설정을 추가하고 프로모션 guard/SDK 경계 7개를 자동 검증한다.
- 이용권 구매 카드에 `이용권 횟수 사용 시 결과 전 전면광고 없음`과 미사용 횟수 무기한 보관을 핵심 혜택으로 표시한다.
- 최소 거리 하한이 있는 질문은 서버가 전국 검색으로 전환한다. `캠핑·피크닉 제외`에는 캠핑 검색 의도를 붙이지 않는다.
- Codex `qc` 자동화는 3시간마다 최근 결과를 검사하고, 최신 코드에서도 재현되는 좁은 서버·질문 메타데이터 결함만 테스트 후 보완한다.
- 최종 장소의 대표 이미지가 저장 카드에 부적합하면 `detailImage2`를 1회 조회하고 수정 가능한 `Type1` 이미지만 사용한다.
- 문서 역할을 분리하고 과거 빌드 로그를 현재 문서에서 제거했다.

## 현재 검증 상태

- 프런트 TypeScript strict 검사 통과
- 프런트 Jest 프로모션 단위 테스트 7개 통과
- 정적 약관 빌드와 질문 프로브 문법 검사 통과
- 백엔드 Wherego 테스트 95개와 Python compileall 통과
- 장거리 실패 조합은 원후보 40개, 압축 11개, Gemini 후보 5개로 재현 성공했으며 모두 최소 거리 조건을 충족
- 운영 Render 커밋: `23450fac90efa8378bd3b6ca81a254ccd8045bd4`
- 운영 질문 API는 7문항과 지역 메타데이터를 반환
- Android/iOS AIT 빌드 0 errors 완료. Apps in Toss 프레임워크 source map 경고만 존재
- 최신 AIT deploymentId: `019f65c4-a75f-7503-a052-9a2f9ae64f05`
- AIT 내부 운영 프로모션 코드, 50원, 라이브 광고 ID와 이용권 광고 없음 문구를 확인했고 `TEST_` 및 Jest 테스트 코드는 없다.

## 남은 위험

- 프로모션, 광고, 인앱결제, PNG 저장은 실제 최신 Toss 앱 QR에서 최종 확인해야 한다.
- 익명 키 기반 사용량/프로모션 방어는 일반 사용자 중복 방지용이다. 변조 클라이언트까지 강제하려면 Toss 로그인 기반 서버 지급이 필요하다.
- 후보 0건과 추천 집중도는 3시간 QC에서 계속 본다. 표본 10건 미만의 집중도는 결함으로 단정하지 않는다.
- 이동 시간은 추정치라 실제 내비게이션 시간과 다를 수 있다.

## Next Recommended Steps

1. 최신 운영 AIT를 업로드해 `/`와 `/promotion`을 각각 연다.
2. `/promotion` 결과에서 50원 1회 지급, 재진입 무지급, guard 장애 시 미지급을 확인한다.
3. 기본 2회, 광고 +1 최대 2회, 공유 +3, 구매 +10과 로그인 후 잔여 복원을 실기기에서 확인한다.
4. PNG 저장, 네이버지도, 전면광고/배너, 뒤로가기 종료 확인을 전체 회귀한다.
5. 3시간 QC와 보조 24시간 표본에서 후보 0건, 이미지 누락, 지역/거리 위반, 목적지 집중도를 재평가한다.

## 운영 규칙

- 작업 시작은 `docs/README.md`와 이 파일부터 읽는다.
- 사용자가 `저장`이라고 하면 `SAVE_PROTOCOL.md`에 따라 문서 갱신, 최소 검증, 커밋, 푸시를 진행한다.
- 질문 문구 변경은 서버 리소스에서만 한다. 앱 AIT를 다시 만들 필요가 없다.
- AIT는 출시 또는 네이티브 SDK 변경 때만 빌드한다. 일반 코드 검토는 TypeScript와 대상 테스트를 우선한다.
