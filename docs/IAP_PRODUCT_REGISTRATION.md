# 어디고 인앱결제 상품 등록안

공식 가이드: https://developers-apps-in-toss.toss.im/iap/intro.html

## 사전 조건

- 워크스페이스 사업자 정보 등록 및 검토 완료
- 워크스페이스 정산 정보 등록 및 검토 완료
- 대표 관리자 계정에서 토스 로그인 약관 동의 완료
- 토스 로그인 설정에서 추가 개인정보 권한은 선택하지 않음
  - 앱 전용 `userKey`만 사용
  - 이름, 이메일, 전화번호, 생일, 성별, 국적, CI는 요청하지 않음
- 서비스 이용약관: https://wherego-lake.vercel.app/terms/service
- 개인정보 처리방침: https://wherego-lake.vercel.app/terms/privacy
- 로그인 연결 해제 콜백: `POST https://jbg.onrender.com/api/wherego/login/unlink`
- 연결 해제 Basic Auth 값은 Render의 `WHEREGO_LOGIN_UNLINK_BASIC_AUTH`와 동일하게 등록

## 상품 등록 값

| 항목 | 입력 값 |
| --- | --- |
| 상품 유형 | 소모품 |
| 상품명 | AI 여행지 추천 10회 이용권 |
| 상품 설명 | 어디고 AI 여행지 추천을 10회 이용할 수 있어요. 이용권 사용 시 결과 전 전면광고 없이 바로 추천받고, 미사용 횟수는 만료 없이 보관돼요. |
| 공급가 | 900원 |
| 예상 판매가 | 990원(VAT 포함, 콘솔 자동 계산값 최종 확인) |
| 상품 이미지 | `assets/iap-product-10-credits.png` (1024 x 1024px PNG) |
| 할인 | 최초 등록 시 사용 안 함 |
| 노출 상태 | 샌드박스 테스트 때 ON, 운영 전환 전 최종 확인 |

판매가를 1,000원으로 직접 입력할 수 없고 공급가는 10원 단위이므로, 1,000원에 가장 가까우면서 자연스러운 금액인 990원을 사용한다.

## 등록 후 필요한 값

상품을 저장한 뒤 발급된 SKU를 Render 환경변수에 등록한다.

```text
WHEREGO_IAP_10_CREDIT_SKU=<콘솔에서 발급된 SKU>
```

앱은 콘솔 상품 목록의 `displayName`, `description`, `displayAmount`, `iconUrl`을 그대로 표시하므로 클라이언트에 가격을 하드코딩하지 않는다.

## 토스 로그인·서버 환경변수

```text
WHEREGO_LOGIN_IDENTITY_SECRET=<32자 이상의 무작위 비밀값>
WHEREGO_LOGIN_SESSION_TTL_HOURS=24
WHEREGO_LOGIN_UNLINK_BASIC_AUTH=<연결 해제 콜백 전용 무작위 비밀값>
APPS_IN_TOSS_MTLS_CERT_PEM=<mTLS 클라이언트 인증서 PEM>
APPS_IN_TOSS_MTLS_KEY_PEM=<mTLS 개인키 PEM>
APPS_IN_TOSS_MTLS_KEY_PASSWORD=<개인키 암호가 있을 때만>
```

비밀값, 인증서, 개인키는 Render 환경변수에만 저장하고 저장소나 문서에 실제 값을 넣지 않는다.

## 필수 샌드박스 테스트

1. 상품 목록에서 노출 ON 상품만 표시되는지 확인
2. 결제 성공 시 정확히 10회가 한 번만 지급되는지 확인
3. 결제 성공 후 서버 지급 실패를 재현하고 앱 재실행 시 미결 주문이 복구되는지 확인
4. 사용자 취소, 네트워크 오류, 내부 오류에서 횟수가 지급되지 않는지 확인
5. 다른 토스 사용자 세션으로 주문 ID를 재사용할 수 없는지 확인
6. 환불 완료 주문의 10회가 회수되는지 확인
7. 앱 재설치 또는 다른 기기에서 토스 로그인 후 미사용 횟수가 복원되는지 확인
