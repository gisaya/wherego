# Wherego Runbook

최종 갱신: 2026-07-18 KST

## 경로와 런타임

```powershell
$wherego = 'C:\Users\ESOL\Documents\wherego'
$jbg = 'C:\Users\ESOL\Documents\jbg'
$node = 'C:\Users\ESOL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
```

- 앱 Git: `https://github.com/gisaya/wherego.git`, `master`
- 서버 Git: `https://github.com/gisaya/jbg.git`, `main`
- 운영 API: `https://jbg.onrender.com`
- 약관: `https://wherego-lake.vercel.app/terms/service`, `https://wherego-lake.vercel.app/terms/privacy`
- 로컬 비밀값은 `.env.local` 또는 JBG의 비추적 환경 파일에만 둔다.

## 앱 검증

```powershell
Set-Location $wherego
& $node .yarn\releases\yarn-4.9.1.cjs test
& $node .yarn\releases\yarn-4.9.1.cjs typecheck
& $node scripts\build-vercel-terms.cjs
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
- 별도 Metro 번들과 AIT 빌드를 중복 실행하지 않는다.
- `wherego.ait`, `.granite`, `.swc`, `.codex-shims`, `node_modules`, `.vercel/output`은 Git 제외다.

출시 전 AIT에서 아래를 확인한다.

- 운영 프로모션 코드 `01KXJHNBZ46JPHND9R3VH7S9TF`
- 프로모션 지급액 `50`
- `TEST_` 문자열 없음
- 라이브 광고 ID만 포함

## 서버 검증

```powershell
Set-Location $jbg
$env:PYTHONPATH='apps/server'
python -m unittest discover -s apps/server/backend/tests -p 'test_wherego*.py'
python -m compileall -q apps/server/backend/app apps/server/backend/scripts
```

운영 배포 후:

```powershell
Invoke-RestMethod 'https://jbg.onrender.com/api/health'
Invoke-RestMethod -Method Post -Uri 'https://jbg.onrender.com/api/wherego/usage' -ContentType 'application/json' -Body '{"anonymousKey":"smoke-runbook"}'
```

실사용 QC:

```powershell
$env:PYTHONPATH='apps/server'
python -m backend.scripts.wherego_qc_report --hours 3 --limit 5000 --json
python -m backend.scripts.wherego_qc_report --hours 24 --limit 5000 --json
python -m backend.scripts.wherego_qc_report --hours 168 --limit 10000 --json
```

자동화는 3시간 리포트를 먼저 실행하고 표본이 10건 미만일 때만 24시간을 추가한다. 168시간 리포트는 월요일 첫 실행에서만 사용한다.

원시 JSON에는 사용자 식별 정보가 포함될 수 있으므로 공유하거나 문서에 붙이지 않는다.

## 운영 설정

클라이언트 공개 설정:

```text
API_BASE_URL=https://jbg.onrender.com
banner=ait.v2.live.67b07bf813d74267
result interstitial=ait.v2.live.69c443b05e6a42ea
quota rewarded ad=ait.v2.live.7f9040b7cff746c5
share reward module=1e6b212b-9093-4546-9991-99f478262910
promotion=01KXJHNBZ46JPHND9R3VH7S9TF / 50 won
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
WHEREGO_IAP_10_CREDIT_SKU
WHEREGO_LOGIN_IDENTITY_SECRET
WHEREGO_LOGIN_UNLINK_BASIC_AUTH
APPS_IN_TOSS_MTLS_CERT_PEM
APPS_IN_TOSS_MTLS_KEY_PEM
APPS_IN_TOSS_MTLS_KEY_PASSWORD
```

조정 가능한 검색·지연·캐시 값은 JBG `apps/server/env/prod.example`을 단일 기준으로 삼는다. 실제 값이나 인증서를 이 문서에 복사하지 않는다.

## 진입과 SDK 확인

- 일반: `intoss://wherego`
- 혜택: `intoss://wherego/promotion`
- 프로모션 테스트 코드는 `TEST_01KXJHNBZ46JPHND9R3VH7S9TF`다. 전용 테스트 AIT에만 잠시 넣고 저장·출시 전 운영 코드로 복구한다.
- 프로모션 서버 guard 예약 실패 시 SDK를 호출하지 않는다.
- SDK 호출의 결과가 불명확한 rejection은 중복 위험 때문에 자동 재시도하지 않는다.
- 명확히 해제 가능한 일시 오류만 결과 화면의 `다시 확인하기`를 노출한다.

실기기 필수 시나리오:

1. `/`에는 혜택 UI와 프로모션 SDK 호출이 없다.
2. `/promotion` 최초 성공 결과에만 50원이 지급된다.
3. 재진입, 결과 재렌더, 같은 사용자 재설치는 중복 지급되지 않는다.
4. 기본 2회, 광고 +1 최대 2회, 공유 +3 하루 1회가 맞다.
5. 잔여 0회 첫 화면에서 광고와 구매가 별도 충전 화면 없이 즉시 열리고, 서버 횟수 불일치 때만 충전 화면 fallback이 열린다.
6. 구매 +10, 재시작 복원, 중복 주문, 환불 회수가 맞다.
7. 결과 PNG 저장은 공유 API를 호출하지 않고 지도 버튼은 네이버지도를 연다.
8. 모든 단계의 뒤로가기는 종료 확인창을 거친다.

## 상품과 로그인

- 상품: 소모성 `AI 여행지 추천 10회 이용권`
- 화면 가격은 `IAP.getProductItemList()` 응답을 사용하고 하드코딩하지 않는다.
- 로그인은 구매 시점에만 요청한다.
- 서버가 Toss 주문 상태를 mTLS로 확인한 뒤 주문 ID 기준 한 번만 +10을 지급한다.
- 상세 등록값은 `docs/IAP_PRODUCT_REGISTRATION.md`를 따른다.

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
