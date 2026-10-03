# Wherego Runbook

최종 갱신: 2026-10-03 KST

## 경로와 런타임

```powershell
$wherego = 'C:\Users\ESOL\Documents\wherego-weekend-web'
$jbg = 'C:\Users\ESOL\Documents\jbg-wherego-review-20261003'
$node = 'C:\Users\ESOL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
```

- 앱 Git: `https://github.com/gisaya/wherego.git`, 작업 브랜치 `codex/weekend-web-20260929`, 운영 브랜치 `master`
- 서버 Git: `https://github.com/gisaya/jbg.git`, 운영 브랜치 `main`. 위 격리 작업 트리에서 기능 변경은 이미 운영에 반영됐다.
- 2026-10-03 출시 검토 서버 보완은 별도 `C:\Users\ESOL\Documents\jbg-wherego-review-20261003`에 있다. `2a3e0bc`의 main 푸시·Server QC·Render gitCommit 일치와 잘못된 보상 키의 HTTP 401을 확인했다. 기존 `jbg-wherego-six-daily`의 공백 변경은 건드리지 않는다.
- 기본 `wherego`와 `jbg`의 기존 변경은 건드리지 않는다. 작업 트리 경로를 확인하고 실행한다.
- 운영 API: `https://jbg.onrender.com`
- 약관: `https://wherego-lake.vercel.app/terms/service`, `https://wherego-lake.vercel.app/terms/privacy`
- 로컬 비밀값은 `.env.local` 또는 JBG의 비추적 환경 파일에만 둔다.

## 앱 검증

```powershell
Set-Location $wherego
& $node .yarn\releases\yarn-4.9.1.cjs test
& $node .yarn\releases\yarn-4.9.1.cjs web:test
& $node .yarn\releases\yarn-4.9.1.cjs typecheck
& $node --check scripts\probe-question-bank-result.cjs
git diff --check
```

Jest는 `@granite-js/react-native/jest` 설정을 사용한다. React Native 0.84의 Flow/TypeScript 혼합 문법은 테스트 환경에서만 `babel-plugin-syntax-hermes-parser`로 변환한다.

의존성이 없을 때만 설치한다.

```powershell
& $node .yarn\releases\yarn-4.9.1.cjs install
```

## AIT 빌드

앱 코드, 라우트, 네이티브 SDK 또는 Granite 설정이 바뀐 출시 저장에서 한 번 실행한다. 질문 JSON과 서버 로직만 바뀌면 만들지 않는다.

```powershell
Set-Location $wherego
powershell -ExecutionPolicy Bypass -File scripts\ait-build.ps1
```

- 생성물: `wherego.ait`
- Android/iOS와 React Native 호환 번들을 함께 만들기 때문에 시간이 걸린다.
- Apps in Toss framework의 손상된 inline source map 경고는 현재 알려진 비차단 경고다. `AIT build completed`와 deploymentId가 출력되고 번들 오류가 0인지 확인한다.
- 별도 Metro 번들과 AIT 빌드를 중복 실행하지 않는다.
- `wherego.ait`, `.granite`, `.swc`, `.codex-shims`, `node_modules`, `.vercel/output`은 Git 제외다.

출시 전 AIT에서 아래를 확인한다.

- 현재 코드의 라이브 프로모션 코드 `01KZ2QP9PXDJ4F6H0K0C5RAZE1`
- 프로모션 지급액 `100` (앱 소스와 서버 기본값 기준이며 운영 설정은 별도)
- `TEST_` 문자열 없음
- 라이브 광고 ID만 포함

## 서버 검증

```powershell
Set-Location $jbg
$env:PYTHONPATH='apps/server'
python -m unittest discover -s apps/server/backend/tests -p 'test_wherego*.py'
python -m compileall -q apps/server/backend/app apps/server/backend/tests
```

운영 배포 후:

```powershell
Invoke-RestMethod 'https://jbg.onrender.com/api/health'
Invoke-RestMethod -Method Post -Uri 'https://jbg.onrender.com/api/wherego/usage' -ContentType 'application/json' -Body '{"anonymousKey":"smoke-runbook","usagePolicy":"uncapped-v1"}'
```

실사용 QC:

```powershell
Set-Location $jbg
$env:PYTHONPATH='apps/server'
python -m backend.scripts.wherego_qc_report --hours 12 --limit 5000 --json
python -m backend.scripts.wherego_qc_report --hours 24 --limit 5000 --json
python -m backend.scripts.wherego_qc_report --hours 168 --limit 10000 --json
```

사용자 QC 지시는 12시간 표본이 10건 미만일 때만 24시간을 추가하고, 한국시간 월요일 00:00~02:59 첫 실행에서만 168시간을 추가하는 것이다. 실제 일정은 저장된 자동화 설정이 기준이며 이번 저장에서 변경하지 않는다.

원시 JSON에는 사용자 식별 정보가 포함될 수 있으므로 공유하거나 문서에 붙이지 않는다.

격리 작업 트리에 DB 설정이 없으면 기본 `jbg`로 이동해 실행하지 않는다. 기본 작업 트리의 오래된 모듈이 먼저 로드되어 최신 6문항을 잘못 판정할 수 있다. 격리 작업 트리에서 최신 코드를 실행하면서 기존 비추적 환경 파일만 읽기 전용으로 로드한다. 파일을 복사하거나 환경값을 출력하지 않는다.

```powershell
Set-Location $jbg
$env:PYTHONPATH='apps/server'
python -B -c "import sys,runpy; from backend.app.infrastructure.config.env import load_dotenv_if_exists; load_dotenv_if_exists(r'C:\Users\ESOL\Documents\jbg\.env'); sys.argv=['wherego_qc_report','--hours','12','--limit','5000','--json']; runpy.run_module('backend.scripts.wherego_qc_report',run_name='__main__')"
```

## 운영 설정

클라이언트 공개 설정:

```text
API_BASE_URL=https://jbg.onrender.com
banner=ait.v2.live.67b07bf813d74267
result interstitial=ait.v2.live.69c443b05e6a42ea
quota rewarded ad=ait.v2.live.7f9040b7cff746c5
share reward module=1e6b212b-9093-4546-9991-99f478262910
promotion=01KZ2QP9PXDJ4F6H0K0C5RAZE1 / 100 won
```

Render 필수 계열:

```text
WHEREGO_PUBLIC_DATA_PORTAL_SERVICE_KEY
KTO_KOR_SERVICE_ENDPOINT
KTO_DATALAB_SERVICE_ENDPOINT
GEMINI_API_KEY
GEMINI_WHEREGO_MODEL=gemini-3.1-flash-lite
WHEREGO_USAGE_LIMIT_ENABLED=true
WHEREGO_ANALYTICS_ENABLED=true
WHEREGO_ANALYTICS_HMAC_SECRET
WHEREGO_IAP_3_CREDIT_SKU
WHEREGO_LOGIN_IDENTITY_SECRET
WHEREGO_LOGIN_UNLINK_BASIC_AUTH
WHEREGO_RESULT_PROMOTION_CODE=01KZ2QP9PXDJ4F6H0K0C5RAZE1
WHEREGO_RESULT_PROMOTION_AMOUNT=100
APPS_IN_TOSS_MTLS_CERT_PEM
APPS_IN_TOSS_MTLS_KEY_PEM
APPS_IN_TOSS_MTLS_KEY_PASSWORD
```

조정 가능한 검색·지연·캐시 값은 JBG `apps/server/env/prod.example`을 단일 기준으로 삼는다. 실제 값이나 인증서를 이 문서에 복사하지 않는다.

## 진입과 SDK 확인

- 일반: `intoss://wherego`
- 혜택: `intoss://wherego/promotion`
- 프로모션 테스트 코드는 `TEST_01KZ2QP9PXDJ4F6H0K0C5RAZE1`다. 전용 테스트 AIT에만 잠시 넣고 저장·출시 전 운영 코드로 복구한다.
- 새 AIT는 `POST /api/wherego/promotion/grant`로 hash 검증, 지급 key 발급, 100원 지급을 JBG에 요청한다. 2026-10-03에는 오래된 문서만 정정했으며 운영 프로모션·환경변수는 바꾸지 않았다.
- 이전 출시 AIT용 `/api/wherego/promotion/attempt`와 클라이언트 SDK 흐름은 서버에서 계속 허용한다.
- 검증·지급 key 발급 단계 실패는 예약을 해제하고 재시도할 수 있다. 실제 지급 요청의 네트워크 결과가 불명확하면 중복 위험 때문에 예약과 로컬 guard를 유지한다.

실기기 필수 시나리오:

1. `/`에는 혜택 UI와 프로모션 지급 API 호출이 없다.
2. `/promotion` 최초 성공 결과에만 코드에 설정된 100원이 지급되는지 운영 설정과 대조한다.
3. 재진입, 결과 재렌더, 같은 사용자 재설치는 중복 지급되지 않는다.
4. KST 매일 첫 1회는 전면·배너 광고 없이 제공한다. 이후 리워드 광고 완료마다 +1회로 계속 추천하며 두 번째 전면광고는 없다. 광고 미완료·중복·표시 실패에는 미지급, 공유 +3 하루 1회는 유지한다. 서버 정책은 `3a52c4e`로 배포됐고 새 AIT는 `usagePolicy=uncapped-v1`을 사용한다.
5. 잔여 0회도 출발지와 6문항부터 선택하고 공공데이터 후보를 먼저 준비한다. 실제 SDK `impression` 이후 20초에 비공개 AI 준비, 보상이 먼저 오면 서버 지급 직후 추천. 보상·서버 지급·광고 종료 후에만 결과 표시. 20초 이전 종료/실패/이탈에서 타이머 취소, 이후 중도 종료는 AI 비용 가능. 과거 유한 상한은 `최신 추천 횟수 확인`으로 복구. 구매 UI 없음. 상세한 준비 캐시/한계는 `docs/MINIAPP_GROWTH_UX.md` 참조.
6. 기존 보유 이용권 사용, 저장 로그인 세션의 미지급 주문 복원, 중복 주문 미지급, 환불 회수가 맞다. 새 주문이나 로그인 모달은 호출하지 않는다.
7. 결과 PNG 저장은 공유 API를 호출하지 않고 지도 버튼은 네이버지도를 연다.
8. 관광공사 이미지가 없으면 화면과 PNG에 같은 컨셉 이미지와 오른쪽 아래 `예시 이미지 · 실제 장소 사진 아님` 고지가 표시된다.
9. 관광공사 미등록 AI 자체 추천도 `예시 이미지 · 실제 장소 사진 아님`으로 표시되고 운영시간·주차·입장료를 단정하지 않는다.
10. 마지막 제출 전 뒤로가기는 이전 선택 단계로 돌아가 답변을 수정할 수 있고, 이후 상태에서는 홈 복귀·종료 확인이 의도대로 동작한다.
11. 앱 시작 중에는 전용 로딩 화면만 보이고 횟수·저장 로그인 조회 뒤 인트로가 한 번에 표시된다. 기존 주문 복원은 저장 세션이 있을 때만 뒤에서 실행한다.
12. 2지선다와 4지선다에서 질문 배너가 별도 하단 영역에 있고 안전영역·카드와 겹치지 않는다.
13. 성공 결과를 2회 확인하면 리뷰 CTA가 한 번만 표시되고 이후 재노출되지 않는다.
14. `/promotion` 지급 시 실제 hash만 허용되고 `install-`, `runtime-`, 로그인 파생 키는 포인트 지급에 사용되지 않는다.
15. 출시 검토 보완 버전에서는 질문 수신 대기·AI 준비 대기·추천 오류·보관함 오버레이에 배너가 없다. 실제 질문과 완료 결과에서만 기존 무료/이용권 배너 제외 정책을 적용한다.
16. SDK 보상 완료 후 서버 반영이 실패하면 `보상 반영 다시 시도`로 같은 grant ID를 다시 보내며 광고를 다시 보지 않고 답변을 유지한다. 수동 재시도 중 중복 지급과 새 광고 호출이 없고 홈 복귀 후 늦은 응답이 화면을 되돌리지 않는지 확인한다. 앱 완전 종료 후 미반영 보상 영속 복원은 구현하지 않았다.
17. 새 서버 보완은 게스트 식별키를 mTLS로 검사하고 검증 실패/장애 때 크레딧을 주지 않는다. 유효 저장 로그인은 서버 로그인 세션으로 검증한다. 실제 토스 키로 성공·잘못된 키로 실패·장애 후 같은 ID 재시도를 운영 반영 전 확인한다. 식별키 검사는 광고/공유 완료의 서버 증명은 아니다.

결과 컨셉 이미지는 `https://wherego-lake.vercel.app/assets/results/`에서 제공한다. AIT 업로드 전 대표 테마 URL이 HTTP 200인지 확인하고, 관광공사 이미지 URL이 깨진 경우에도 컨셉 이미지로 전환되는지 실기기에서 확인한다.

## 기존 주문과 로그인

- 신규 상품 판매·가격·구매 버튼·`appLogin()`·`IAP.createOneTimePurchaseOrder()`를 제거했다.
- 일반 진입에서는 상품 API와 `IAP.getProductItemList()`를 호출하지 않는다.
- 유효한 저장 로그인 세션의 기존 주문만 복원하며 로그인 만료·기기 변경에 따른 이용권 문의는 약관의 이메일로 안내한다.
- 유료 이용권 잔액이 있거나 유료 횟수로 추천을 진행 중이면 배너광고를 노출하지 않는다.
- 서버가 Toss 주문 상태를 mTLS로 확인한 뒤 주문 ID 기준 한 번만 +3을 지급한다.
- 과거 등록값은 `docs/IAP_PRODUCT_REGISTRATION.md`에 보존한다. 판매 재개 지시로 사용하지 않는다. 운영 콘솔 상품 상태는 별도로 확인한다.

## 로컬 Android

필요할 때만 Granite 개발 서버를 켠다.

```powershell
Set-Location $wherego
& $node .yarn\releases\yarn-4.9.1.cjs dev
adb connect <device-ip>:<port>
adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW -d 'intoss://wherego'
```

테스트가 끝나면 개발 서버를 종료한다. 배포 AIT 검증에는 로컬 Granite 서버가 필요하지 않다.

## 저장

사용자가 2026-10-01 버전 등록을 직접 하겠다고 지시했다. AIT 빌드 요청은 파일 생성·검증까지만 진행하며 토스 업로드·버전 등록·검토 요청·출시는 수행하지 않는다. 출시 메모는 공백/문장부호 포함 120자 이하이며 `docs/RELEASE_MEMO.md`를 사용한다.

사용자가 `저장`이라고 하면 `SAVE_PROTOCOL.md`를 따른다.

```powershell
git status --short
git diff --stat
git diff --check
git branch --show-current
git remote -v
git add <검토한 파일만>
git commit -m '<변경을 설명하는 메시지>'
git push origin <현재 브랜치>
```

문서에는 최신 AIT deploymentId 하나와 최종 검증 결과만 남긴다. 비밀값, 생성물, 캐시, 원시 QC 데이터는 커밋하지 않는다.

현재 브랜치 저장/푸시는 `master` 병합, Vercel 공개 배포, 토스 버전 등록과 다르다. 검증된 최신 AIT가 있으면 문서 저장만을 위해 다시 빌드하지 않는다.

웹 실행 명령은 `yarn web:dev`, 검증은 `yarn web:test`, 공개 웹 빌드는 `yarn web:build`다. `web/`, `public/web/`, `web-server/`는 소스이며 `.vercel/output/`은 생성물이다. 공개 배포는 사진 권한과 별도 지시를 확인한 뒤 진행한다. 빌드는 출력 폴더를 재생성하므로 작업 트리 안의 `.vercel/output` 경로임을 먼저 확인한다.

2026-10-03 웹은 토스와 같은 6문항 카드 흐름·현재 위치 버튼·전국 11권역 선택을 제공한다. 질문 갱신은 `node scripts/sync-weekend-questions.mjs <최신-JBG-wherego-리소스-폴더>`, 권역 갱신은 `node scripts/sync-weekend-origins.mjs` 후 생성 사본과 테스트를 검토한다. 웹 빌드는 기존 미니앱 인트로 JPEG와 lucide 아이콘을 정적 출력으로 복사한다. 현재 위치는 사용자가 버튼을 누를 때만 요청하고 받은 좌표 그대로 거리 계산에 사용하며, 실패하면 직접 선택/재시도를 제공한다. 질문·좌표는 서버·공유·URL/history·저장소에 넣지 않는다. 대표 좌표는 지역을 직접 선택할 때만 사용한다. 여행지 데이터는 수도권 13곳으로 아직 제한되어 있다. 웹 수정만으로 AIT를 재빌드하지 않는다. 최신 로컬 미리보기는 `http://127.0.0.1:4174/`다.

웹 수익화 준비: 마지막 답변은 확인 화면으로 이동하며 결과 확인 버튼을 눌러야 `/recommendation/`에 한 곳을 표시한다. 후보 넘기기는 없다. 결과 요약만 같은 탭 sessionStorage에 30분간 전달하고 원래 답변/GPS는 저장하지 않는다. 기본 빌드는 AdSense meta/ads.txt만 제공하며 실제 광고 비활성이다. 사이트 승인·사진 상업 권한·CMP·공식 Offerwall 게시 후에만 `WEB_ADSENSE_ENABLED=true`와 `WEB_MEDIA_COMMERCIAL_USE_CONFIRMED=true`로 빌드한다. `WEB_ADSENSE_HOSTS`는 정확한 공개 호스트, `WEB_ADSENSE_DISPLAY_SLOT`은 선택적인 실제 반응형 배너 ID다. 운영 설정/배포는 이번 작업에 포함하지 않았다. 계정 설정 상세는 `docs/WEEKEND_WEB_EXPERIMENT.md`를 따른다.

`node scripts/verify-weekend-monetization.cjs`는 HTTPS 운영 호스트/광고 스크립트/단위를 전부 가로채 모의 응답으로만 검사한다. 실제 광고 조회·클릭·보상·수익이 발생하지 않는다. 실제 Offerwall은 사이트 승인/메시지 게시 후 콘솔의 미리보기와 첫 조회/반복 조회로 별도 확인한다. `result` 이벤트는 화면 준비이지 Google 보상 완료 증명이 아니다.

## 약관만 준비

공개 약관 반영 승인은 웹 실험이나 광고 활성화의 승인과 구분한다. 로컬 웹 미리보기를 덮어쓰지 않고 약관용 정적 출력만 준비한다.

```powershell
Set-Location $wherego
& $node scripts\build-vercel-terms.cjs .vercel/terms-review/output
```

별도 출력은 이 작업 트리 `.vercel` 아래 경로만 허용하고 junction/symlink 경유 경로는 거부한다. 기존 기본 출력은 `.vercel/output`이며 4174 웹 미리보기가 사용하므로 약관 준비에는 위 별도 경로를 쓴다. 이 명령은 빌드일 뿐 공개 배포가 아니다. 전체 작업 브랜치에는 미공개 웹 실험이 있으므로 약관 갱신을 위해 무조건 운영 브랜치에 병합하거나 전체 웹을 배포하지 않는다.

2026-10-03 저장 검증: 미니앱 94개, 웹 49개, 서버 218개 테스트·TypeScript·compileall 통과. 새 AIT `01a0ff4b-e967-7095-b258-2721fbfbf659`는 RN 0.84.0/0.72.6 네 번들에서 새 앱/API/설정 소스 일치를 확인했다. 서버 `2a3e0bc`는 운영 배포와 잘못된 식별키 지급 차단을 확인했다. 실제 광고 시청·유효 토스 키 성공·새 AIT 실기기/등록은 확인하지 않았다.

약관 전용 `C:\Users\ESOL\Documents\wherego-terms-20261003`에서 운영 master 기준 HTML 두 파일만 `87aaef0`으로 커밋·푸시했다. Vercel wherego 프로젝트는 Git 연결이 없고 기존 GitHub 앱의 허용 저장소에 wherego가 없어 자동 배포가 시작되지 않았다. 사용자에게 이 저장소만 허용할지 질문했으며 권한·연결 설정은 아직 변경하지 않았다. 공개 약관은 여전히 이전 배포다. 약관 배포에 미공개 웹 실험이나 광고 활성화를 섞지 않는다.
