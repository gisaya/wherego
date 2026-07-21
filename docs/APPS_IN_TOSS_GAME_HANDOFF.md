# Apps in Toss 게임 개발 Handoff

최종 갱신: 2026-07-21 KST

이 문서는 새 Apps in Toss 게임 저장소의 첫 작업자가 읽을 공통 진입점이다. 특정 게임의 기획은 새 저장소 `AI_HANDOFF.md`에 기록하고, 이 문서에는 플랫폼 공통 규칙만 유지한다.

## 0. 작업 시작 순서

1. 앱인토스 콘솔에서 게임 카테고리, `appName`, 국문 앱 이름, 워크스페이스와 담당 사업자를 확정한다.
2. 공식 Apps in Toss MCP로 `시작하기`, `게임 출시 가이드`, 사용할 SDK 기능을 다시 검색한다. 정책은 수시로 바뀌므로 이 문서만 믿고 출시하지 않는다.
3. WebView, React Native, Unity 중 런타임을 정하고 Granite 1.0 이상을 사용한다.
4. 저장소 루트에 `AI_HANDOFF.md`, `SAVE_PROTOCOL.md`, `RUNBOOK.md`를 먼저 만든다.
5. 첫 화면, 사용자 식별키, 세이브 복원을 먼저 완성한 뒤 광고·결제·프로모션을 붙인다.
6. 서버 API가 필요하면 앱별 mTLS 인증서를 발급하고 서버 secret에만 저장한다.
7. 약관과 개인정보 처리방침을 공개 HTTPS 주소로 배포한다.
8. 실기기 QR 테스트 후 `.ait`를 업로드하고 게임 출시 체크리스트로 검수한다.

공식 기준:

- [게임 출시 가이드](https://developers-apps-in-toss.toss.im/checklist/app-game.html)
- [미니앱 출시](https://developers-apps-in-toss.toss.im/development/deploy.html)
- [사용자 식별키 발급](https://developers-apps-in-toss.toss.im/user-hash-key/develop.html)
- [인앱 광고](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/%EA%B4%91%EA%B3%A0/IntegratedAd.html)
- [인앱 결제](https://developers-apps-in-toss.toss.im/iap/intro.html)

## 1. 저장소 기본 문서

새 저장소에는 아래 파일을 둔다.

| 파일 | 역할 |
| --- | --- |
| `AI_HANDOFF.md` | 현재 기획, 구조, 운영 ID, 최근 변경, 검증 결과, 위험, 다음 작업 |
| `SAVE_PROTOCOL.md` | 사용자가 `저장`이라고 했을 때 수행할 고정 절차 |
| `RUNBOOK.md` | 설치, 개발, 테스트, AIT 빌드, 서버 배포, 장애 대응 명령 |
| `docs/README.md` | 문서 인덱스와 읽는 순서 |
| `docs/TERMS.md` | 약관·개인정보 페이지 항목과 공개 URL |
| `docs/RELEASE_CHECKLIST.md` | 콘솔 등록부터 QR 검수까지 출시 체크리스트 |

`AI_HANDOFF.md`에는 최소한 다음 정보를 적는다.

- 앱 이름, `appName`, 카테고리와 화면 방향
- 저장소·브랜치·운영 API·약관 URL
- 게임 루프, 승패/점수/스테이지 규칙
- 사용자 hash, 세이브, 랭킹, 결제 데이터의 단일 원본
- 광고 그룹 ID, 상품 SKU, 프로모션 코드의 테스트/운영 구분
- 최신 AIT 빌드 결과와 배포 버전
- 알려진 위험과 `Next Recommended Steps`

## 2. 저장 프로토콜

새 저장소의 `SAVE_PROTOCOL.md`는 다음 규칙을 사용한다.

1. `git status --short`로 사용자 변경을 먼저 확인하고 덮어쓰지 않는다.
2. 코드와 함께 `AI_HANDOFF.md`, 명령이 바뀌면 `RUNBOOK.md`, 정책이 바뀌면 관련 문서를 갱신한다.
3. 변경 범위에 맞는 가장 좁은 테스트를 먼저 실행하고 출시 변경이면 전체 테스트를 실행한다.
4. 클라이언트, 라우트, SDK, Granite 설정이 바뀐 경우에만 AIT를 다시 만든다. 서버·질문·밸런스 데이터만 바뀌면 AIT를 만들지 않는다.
5. `*.ait`, 인증서, `.env*`, 사용자 원문 로그, 빌드 캐시를 Git에 넣지 않는다.
6. `git diff --check`, `git diff --stat`, 현재 브랜치와 remote를 확인한다.
7. 변경 파일만 명시적으로 stage하고 의미가 드러나는 커밋을 만든 뒤 push한다.
8. Render/Vercel 자동 배포는 push만으로 성공했다고 간주하지 않고 health와 공개 URL을 확인한다.
9. AIT 빌드는 성공 여부, 경고, 파일 크기, `TEST_` 문자열과 테스트 광고 ID 포함 여부를 확인한다.

커밋 예시:

- `Add game save and identity flow`
- `Integrate rewarded ad lifecycle`
- `Prepare Apps in Toss release`
- `Save game handoff state`

## 3. 런타임 선택

- Unity: 이미 Unity 게임이 있거나 물리·애니메이션·씬 관리가 핵심인 게임에 사용한다. Apps in Toss Unity SDK와 WebGL 최적화 가이드를 따른다.
- WebView: Canvas/WebGL 기반 2D 게임, 웹 게임 엔진, 빠른 반복이 중요한 경우에 사용한다. iframe과 SSR은 사용하지 않고 CSR 또는 SSG로 만든다.
- React Native: 네이티브 UI와 간단한 게임 상호작용이 중심일 때 사용한다. 새 프로젝트는 Granite와 `@apps-in-toss/framework`를 사용한다.

압축 해제된 AIT 번들은 100MB 이하여야 한다. 큰 이미지·사운드·영상은 초기 번들에서 분리하고 CDN 실패 fallback과 캐시 정책을 둔다.

운영 CORS 허용 origin:

- `https://<appName>.apps.tossmini.com`
- `https://<appName>.private-apps.tossmini.com`

## 4. 사용자 식별과 세이브

게임은 `getUserKeyForGame()`을 사용한다. 비게임용 `getAnonymousKey()`를 게임에서 호출하지 않는다.

```ts
import { getUserKeyForGame } from '@apps-in-toss/framework';

const result = await getUserKeyForGame();
if (result?.type === 'HASH') {
  const userHash = result.hash;
}
```

- 게임 카테고리에서만 사용할 수 있다.
- 토스앱 5.232.0 이상이 필요하고 샌드박스는 mock 값을 반환하므로 실제 QR 테스트가 필수다.
- hash는 앱별로 고유하며 로그·분석·오류 메시지에 원문을 남기지 않는다.
- 로컬 저장은 즉시 재개용 캐시이고 서버 저장을 점수, 랭킹, 결제 아이템의 단일 원본으로 둔다.
- 저장 요청은 `saveVersion`, `updatedAt`, 멱등 키를 포함한다. 충돌은 서버 버전 또는 명시한 병합 규칙으로 해결한다.
- 앱 종료, 백그라운드 전환, 스테이지 종료 시 저장하고 재진입 시 복원한다.
- 점수와 보상은 클라이언트 값을 그대로 신뢰하지 말고 서버 규칙으로 검증한다.

2026-07-17 공지 이후 hash는 프로모션·스마트 발송·토스페이의 명시된 서버 API 인증에도 사용할 수 있다. 모든 Toss API에 통용되는 키는 아니므로 각 API 문서에 `x-anon-key` 지원이 적혀 있을 때만 사용한다.

민감한 서버 동작 전에 mTLS로 검증할 수 있다.

```text
POST https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/users/anon-key/verify
x-anon-key: <hash>
```

검증 결과를 짧게 캐시하되, 결제·프로모션 지급은 주문/지급 ID 기준 멱등 방어를 별도로 둔다.

## 5. mTLS와 서버

- 인증서와 private key는 앱별로 분리한다. 다른 미니앱 인증서를 공유하지 않는다.
- 인증서는 Render secret 또는 secret file로만 관리하고 Git, 문서, 클라이언트 번들에 넣지 않는다.
- 서버 API key, 결제 검증, 프로모션 지급, 랭킹 쓰기는 클라이언트에서 직접 수행하지 않는다.
- 외부 API에는 timeout, 제한된 retry, circuit breaker 또는 fallback을 둔다.
- 지급·아이템·점수 변경은 DB transaction과 고유 키로 중복을 차단한다.
- health 응답에는 secret 없이 버전, DB 연결, 필수 설정 누락 개수만 노출한다.
- 사용자 hash는 저장 전에 서버 secret으로 HMAC 또는 SHA-256 비식별화하고 원문을 QC에 내보내지 않는다.

## 6. 광고

- 전면형과 보상형은 `loadFullScreenAd`와 `showFullScreenAd`를 사용하고 광고 그룹 ID로 유형을 구분한다.
- 화면 단위로 `load → loaded 이벤트 → show → 다음 load` 순서를 지킨다.
- 광고를 누르는 순간 로드하지 말고 플레이 중 자연스러운 구간에 미리 로드한다.
- 인트로, 로딩, 컷신, 팝업 모달에는 광고를 넣지 않는다.
- 전면광고는 사용자가 예상할 수 있는 스테이지 종료나 결과 진입 전에만 노출한다.
- 보상은 `userEarnedReward` 이벤트 이후 서버에 지급하고 광고 시작·노출만으로 지급하지 않는다.
- 광고 중 게임 음악과 타이머를 멈추고 닫힘 뒤 복원한다.
- 배너는 상단 또는 하단에 고정하고 Safe Area, CTA, 조작 영역과 겹치지 않게 한다.
- 개발 광고 ID와 라이브 광고 ID를 분리하고 출시 AIT에 테스트 ID를 넣지 않는다.
- 광고 미지원, 로드 실패, 사용자가 닫은 경우에도 게임을 계속할 수 있어야 한다.

## 7. 인앱 결제

- 디지털 아이템은 Apps in Toss 인앱 결제를 사용한다.
- 소모성/비소모성을 먼저 정하고 콘솔 상품과 코드의 SKU를 정확히 일치시킨다.
- 상품명, 이미지, 실제 SDK 가격, 지급 수량, 환불/복원 정책을 구매 화면에 표시한다.
- 주문 생성 후 파트너 서버가 mTLS로 주문 상태와 SKU를 검증한 다음 아이템을 지급한다.
- `orderId`를 고유 키로 저장해 중복 지급을 막는다.
- pending 주문은 앱 시작과 결제 화면 진입 시 복원하고 지급 완료 API까지 마친다.
- 취소, 잔액 부족, 네트워크 실패를 각각 사용자에게 설명한다.
- 기기 변경 후에도 구매 아이템이 유지되어야 하므로 서버 사용자 hash에 연결한다.
- 결제창 동안 음악을 멈추고 복귀 후 상태를 다시 조회한다.
- Google 결제 테스트 환경과 실제 QR 환경을 모두 확인한다.

## 8. 프로모션과 공유 리워드

- 게임 기본 프로모션은 공식 문서의 `grantPromotionRewardForGame`을 사용하고 1인 1회 서버/로컬 방어를 둔다.
- 프로모션 시작 전 테스트 코드로 실제 토스앱 QR에서 최소 1회 호출한다.
- 테스트 코드와 운영 코드를 동시에 번들에 넣지 않는다.
- 새 hash S2S 지급을 사용하려면 해당 게임과 API에서 `x-anon-key` 지원이 명시됐는지 최신 문서와 콘솔에서 다시 확인한다.
- 프로모션 예산 소진, 종료, `4110` 일시 오류와 지급 결과 불명확 상태를 구분한다.
- 지급 요청이 불명확하면 자동 재지급하지 말고 지급 key로 상태를 조회한다.
- 공유 리워드는 실제 초대 완료 콜백 뒤에만 지급하고 초대/사용자 기준으로 멱등 처리한다.

## 9. TDS와 게임 UI

TDS는 비게임 미니앱에는 필수지만 게임에는 선택 사항이다. 게임 플레이 화면은 장르에 맞게 설계해도 되며, 결제·설정·동의·오류처럼 토스와 맞닿는 화면은 TDS 패턴을 우선 검토한다.

- React Native framework 1.0 이상: `@toss/tds-react-native`
- Web framework 1.0 이상: `@toss/tds-mobile`
- 버튼은 행동을 예측할 수 있는 문구를 사용하고 disabled/loading/error 상태를 구현한다.
- Safe Area와 Dynamic Island를 침범하지 않는다.
- 내비게이션 바에는 콘솔에 등록한 국문 이름과 로고를 반영한다.
- 앱 진입 즉시 바텀시트를 띄우거나 화면 전환을 바텀시트로 강제하지 않는다.
- 모든 화면에 종료 경로를 두고 종료 시 확인 모달을 표시한다.
- 글자 확대, 작은 화면, 긴 한국어 문구에서도 겹치거나 잘리지 않게 한다.
- 터치와 화면 전환 반응은 2초를 넘기지 않는다.

## 10. 사운드, 수명주기와 권한

- 배경음·효과음은 사용자가 켜고 끌 수 있어야 한다.
- 무음/진동 설정에서도 게임 규칙은 유지한다.
- 백그라운드 전환 즉시 사운드와 게임 루프를 멈추고 복귀 시 정상 재개한다.
- 광고와 결제창이 뜨는 동안 음악과 타이머를 일시 정지한다.
- 권한 요청 전 용도를 화면에서 먼저 설명하고 거부해도 핵심 기능을 계속 사용할 수 있게 한다.
- 운영체제 뒤로가기 동작과 앱 종료 확인은 최신 게임 출시 가이드에 맞춰 실기기에서 확인한다.

## 11. 약관과 개인정보 페이지

Notion도 가능하지만 출시 URL은 로그인, 앱 설치, 쿠키 동의 없이 열리는 안정적인 HTTPS 정적 페이지를 권장한다. 새 프로젝트에서는 `public/terms/service/index.html`, `public/terms/privacy/index.html`을 두고 별도 Vercel 정적 사이트로 배포한다.

서비스 이용약관에 포함할 항목:

- 사업자명, 대표자, 사업자 주소, 연락처
- 서비스와 게임 아이템의 정의
- 계정/식별키와 이용 제한
- 유료 상품, 청약철회, 환불, 복원
- 금지 행위, 부정 점수/치팅, 제재
- 서비스 변경·중단, 책임 제한, 분쟁 처리
- 시행일과 변경 고지

개인정보 처리방침에 포함할 항목:

- 수집 항목: 사용자 hash, 게임 기록, 결제 주문 ID, 광고/프로모션 이벤트, 오류 로그
- 수집 목적, 보유 기간, 파기 절차
- 처리 위탁, 국외 이전, 제3자 제공 여부
- 권리 행사와 문의 채널
- 보호책임자, 사업자 주소, 시행일
- 위치·연락처 등 선택 권한을 쓰면 목적과 거부 시 동작

게임마다 실제 수집·결제·광고 구조에 맞게 다시 작성한다. 어디고 문구를 그대로 복사하지 않는다.

Vercel 운영 원칙:

- 약관 프로젝트는 앱 서버와 분리한다.
- URL을 `/terms/service`, `/terms/privacy`로 고정한다.
- 배포 후 두 URL의 HTTP 200과 본문 사업자 정보를 확인한다.
- Yarn `patch:` 의존성이 있는 앱 저장소를 Vercel이 npm으로 설치하면 실패할 수 있다. 약관 전용 package를 분리하거나 정적 파일만 Build Output API로 배포한다.
- 약관 변경도 Git 커밋, 공개 배포, 실제 URL 확인까지 완료해야 저장이다.

## 12. 콘솔 등록

- 앱 이름, `appName`, 카테고리, 화면 방향
- 600x600 로고, 썸네일, 한 줄 소개
- 내비게이션 바 로고와 국문 앱 이름
- 고객센터와 사업자 정보
- 서비스 이용약관·개인정보 처리방침 URL
- 필요한 권한과 사전 고지 문구
- 미니앱 기능별 `intoss://<appName>/<screenName>` 딥링크
- 광고 그룹, 인앱결제 상품, 프로모션, 공유 리워드 등록
- mTLS 인증서와 서버 webhook/API 설정

## 13. 테스트와 출시

자동 검증:

- lint/typecheck/unit test
- 저장/복원, 점수 계산, 결제·보상 멱등 테스트
- production build와 AIT 크기 확인
- 번들 문자열에서 `TEST_`, 개발 광고 ID, localhost, secret 검사
- 정적 약관 build와 링크 검사

실기기 QR 검증:

1. 최초 화면이 10초 안에 뜨는지 확인한다.
2. 사용자 hash를 받고 신규/기존 세이브로 정상 시작하는지 확인한다.
3. 종료·재진입·백그라운드 복귀에서 레벨과 아이템이 유지되는지 확인한다.
4. Safe Area, 닫기, 종료 확인, 세로/가로 방향을 확인한다.
5. 광고 선로딩, 음악 일시 정지/복원, 보상 완료 후 지급을 확인한다.
6. 결제 성공·취소·실패·pending 복원·기기 변경을 확인한다.
7. 프로모션 테스트 코드 1회와 운영 코드 미포함 상태를 확인한다.
8. 라이브 CORS, API 실패, 느린 네트워크, CDN 실패를 확인한다.
9. 약관과 개인정보 URL을 토스 앱 안팎에서 연다.
10. 크래시, API p95, 지급 실패, 점수 이상치를 출시 직후 모니터링한다.

## 14. 출시 판정

아래가 모두 끝나야 검토를 요청한다.

- 게임 출시 체크리스트 충족
- 최신 `.ait` 100MB 이하
- 앱 이름·로고·내비게이션 일치
- 실기기에서 10초 이내 첫 화면
- hash 기반 세이브와 재접속 복원
- 광고·결제·프로모션의 운영 ID와 멱등 처리
- 테스트 코드와 secret 미포함
- 약관·개인정보 URL 공개 접근 가능
- 운영 API CORS와 health 정상
- 롤백 가능한 직전 AIT와 서버 버전 기록

검수 승인 뒤 `출시하기`를 누르면 전체 사용자에게 즉시 반영된다. 출시 직후 오류, API 지연, 광고·결제·지급 실패율을 집중 확인하고 문제가 있으면 이전 승인 버전으로 롤백한다.
