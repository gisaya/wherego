# LLM 이어받기

최종 갱신: 2026-07-15 KST

## 먼저 읽을 문서

1. 루트 `AI_HANDOFF.md`: 현재 제품 결정, 최근 변경, 위험, 다음 작업
2. `docs/01_프로젝트_현황.md`: 사용자 기능과 출시 상태
3. `docs/02_구조와_흐름.md`: 앱-서버-외부 API 흐름
4. `RUNBOOK.md`: 검증, 빌드, 배포, 운영 명령

Git 이력이 과거 변경과 빌드 기록을 보존한다. 현재 문서에는 최신 상태만 유지한다.

## 프로젝트 경계

- 앱 저장소: `C:\Users\ESOL\Documents\wherego`, `gisaya/wherego`, `master`
- 서버 저장소: `C:\Users\ESOL\Documents\jbg`, `gisaya/jbg`, `main`
- 운영 API: `https://jbg.onrender.com`
- 약관: `https://wherego-lake.vercel.app/terms/service`, `https://wherego-lake.vercel.app/terms/privacy`
- Vercel은 약관 정적 페이지 전용이다.
- 질문과 선택지의 런타임 단일 원본은 JBG의 `apps/server/backend/app/resources/wherego/`다.

## 현재 핵심 상태

- 일반 진입은 `/`, 혜택 진입은 `/promotion`이다.
- 질문은 원천 3개 + 핵심 일반 3개 + 재미 일반 1개, 총 7개다.
- 서버가 한국관광공사 KorService2/DataLab 후보를 준비하고 5~7개로 압축한다.
- Gemini 3.1 Flash-Lite는 압축 후보에서 최종 1개와 짧은 근거만 만든다.
- 기본 추천 2회/일, 리워드 광고 +1 최대 2회/일, 공유 +3 하루 1회, 구매 10회권을 사용한다.
- 결과 전 전면광고는 무료·보상 횟수에 노출하고 유료 횟수에는 생략한다.
- `/promotion` 결과에서 운영 코드로 토스 포인트 50원을 1인 1회 지급한다.
- 프로모션 서버 중복 방지 예약이 실패하면 SDK를 호출하지 않는 fail-closed 정책이다.

## 수정 원칙

- 질문 카피와 메타데이터는 앱이 아니라 서버 JSON에서 수정한다.
- API 키, 인증서, 사용자 원문, 익명 사용자 식별값, `.env*`를 문서나 Git에 넣지 않는다.
- `.ait`, `.vercel/output`, `node_modules`, 빌드 캐시를 커밋하지 않는다.
- 사용자가 `저장`이라고 하면 `SAVE_PROTOCOL.md`에 따라 문서 갱신, 최소 검증, 커밋, 푸시까지 수행한다.
- 앱 코드 또는 네이티브 SDK 설정이 바뀐 저장에서만 AIT를 다시 만든다.

## Next Recommended Steps

1. 최신 AIT에서 일반/혜택 진입을 각각 QR 테스트한다.
2. 프로모션 최초 지급, 재진입 차단, guard 장애 시 미지급을 확인한다.
3. 광고·공유·구매 횟수와 로그인 후 유료 잔여 복원을 확인한다.
4. 카드 PNG 저장, 지도 열기, 광고, 뒤로가기 종료 확인을 실기기에서 회귀한다.
5. 일일 QC의 후보 0건, 거리·지역 위반, Gemini fallback, 목적지 집중도를 계속 확인한다.
