# Wherego AI Handoff

## Project Goal

`어디고` is an Apps in Toss mini app concept for quick domestic travel destination recommendations.

Core flow:
- User enters the mini app.
- User answers lightweight travel preference questions.
- The app defines a travel persona from answers.
- The app recommends one to three domestic destinations.
- The result card links out to a map app.

## Current Product Decisions

- App name: `어디고`
- Git remote: `https://github.com/gisaya/wherego.git`
- Initial recommendation data source direction: 한국관광공사 국문 관광정보 서비스_GW API.
- Regional crowd signal direction: 한국관광공사 빅데이터 지역별 방문자수_GW API.
- Public Data Portal credentials and KTO endpoints are stored locally in `.env.local`; do not commit that file.
- TMAP congestion API is not part of the MVP because of cost.
- AI direction: Gemini Flash-Lite with function calling for search planning, persona copy, and result-card copy. Do not put AI API keys in the client.
- Apps in Toss direction: Granite/TDS style should be used for the actual app implementation.
- Question flow: required 3 questions plus random 5 questions. Random questions should be selected from different tag groups.
- Location filtering: use current location when permitted, or a user-selected origin. MVP estimate uses straight-line distance x 1.35, average 45km/h, and 15 minutes of buffer for drive-time constraints.

## Current Assets

- `assets/logo.png`: 600x600 app logo.
- `assets/thumbnail.png`: 1932x828 Apps in Toss-style thumbnail.
- Visual direction follows the existing `toss_tomato` asset pattern:
  - pale lavender-blue background
  - polished 3D object
  - large Korean title on the left for thumbnail
  - right-side travel object composition
- Thumbnail copy: `취향대로, 오늘 갈 곳을 찾아봐요.`

## Current Terms Pages

Static Vercel-style terms pages were added:

- `public/index.html`
- `public/terms/service/index.html`
- `public/terms/privacy/index.html`
- `public/terms/styles.css`
- `scripts/build-vercel-terms.cjs`
- `vercel.json`

Routes after deployment:

- `/terms/service`
- `/terms/privacy`

Current Vercel deployment:

- Production alias: `https://wherego-lake.vercel.app`
- Service terms: `https://wherego-lake.vercel.app/terms/service`
- Privacy policy: `https://wherego-lake.vercel.app/terms/privacy`
- Vercel project: `joyai/wherego`
- GitHub repository auto-link failed during CLI deploy, so current deployment is CLI-created/manual. GitHub auto deploy still needs to be connected from Vercel settings or retried later.

The content is adapted from the existing `뭐샀지` terms-page structure, with Wherego-specific wording for:

- travel preference analysis
- domestic destination recommendations
- 한국관광공사 관광정보 API
- AI-generated recommendation text

Contact/privacy owner currently matches the `뭐샀지` documents:

- 문의 이메일: `minah0413@naver.com`
- 개인정보 보호책임자: `권민아`

## Current Verification

- `node` is not on the normal PowerShell PATH.
- The bundled Codex Node executable works:
  - `C:\Users\ESOL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`
- Verified command:
  - `& 'C:\Users\ESOL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/build-vercel-terms.cjs`
- Result:
  - `.vercel/output/static/index.html`
  - `.vercel/output/static/terms/service/index.html`
  - `.vercel/output/static/terms/privacy/index.html`
- Latest save verification:
  - 2026-07-08 21:57 KST: terms-page build returned `Built static terms pages for Vercel.`
  - 2026-07-08 22:05 KST: `.env.local` confirmed ignored, committed files checked for raw 64-char key patterns, and terms-page build returned `Built static terms pages for Vercel.`
  - 2026-07-08 22:16 KST: production Vercel deployment succeeded and `/`, `/terms/service`, `/terms/privacy` all returned HTTP 200.
  - 2026-07-09 KST: `scripts/probe-question-bank-result.cjs` successfully exercised KTO KorService2, KTO DataLab locgo visitor rows, estimated drive-time filtering, parking-known filtering, and crowd labels.
  - 2026-07-09 KST save check: terms-page build succeeded, `scripts/probe-question-bank-result.cjs` syntax check passed, generated question bank shape confirmed as 13 groups / 390 questions / 30 per group, and no 64-char hex secret pattern was found in commit candidates.

## Current Question/API Work

- `data/source-question-blueprint.json`: required source axes for movement scope, party constraints, and destination intent.
- `data/general-question-bank.json`: generated general question bank, 13 tag groups x 30 questions = 390 questions.
- `data/question-bank-normalized.json`: normalized copy of the downloaded Gemini question candidate file.
- `data/question-bank-additions.json`: curated additional question candidates and policy notes.
- `scripts/build-general-question-bank.cjs`: deterministic generator for the general bank.
- `scripts/probe-question-bank-result.cjs`: local Gemini-substitute probe using selected answers, real KTO APIs, distance filtering, parking filtering, and DataLab crowd labeling.
- `scripts/probe-wherego-flow.cjs`: earlier direct KTO API flow probe.

Latest known probe result with the default Seoul City Hall test origin:

- Persona: 아이와 함께하는 근교 숲 힐링 드라이버.
- Recommended places: 일월수목원, 일영허브랜드(숲길정원), 무릉도원수목원.
- Crowd data latest base date observed: `20260609`.

## Current Blockers And Risks

- Vercel project exists and terms URLs are live, but GitHub auto-deploy is not connected yet.
- Future app implementation still needs Granite project scaffolding or reuse of the `toss_tomato` structure.
- API keys for 한국관광공사 and AI services must stay out of client code and Git. `.env.local` is intentionally ignored.
- The current drive-time filter is an estimate, not real routing. A map/routing API is needed for production-grade travel time.
- DataLab visitor counts are regional, not place-level. Treat crowd labels as a weak supporting signal.
- The generated question bank is large enough for MVP experiments, but should still be edited for repeated wording before final UI copy freeze.

## Operating Rules

- For context efficiency, read `docs/README.md` first, then follow the listed current docs. Do not start from archive-style or generated output scans.
- When the user says "저장", follow `SAVE_PROTOCOL.md`: refresh handoff/runbook state, verify narrowly, commit, and push unless explicitly told not to.
- Keep generated build outputs out of Git.
- Keep `.env`, API keys, `.ait`, `.vercel/`, `node_modules/`, and `dist/` out of Git.
- Before finalizing asset or app UI work, visually inspect generated assets or screens.

## Next Recommended Steps

1. Connect GitHub auto-deploy for Vercel project `joyai/wherego`, or continue using CLI manual deploys.
2. Scaffold the actual Apps in Toss/Granite app using the `toss_tomato` structure as the closest local reference.
3. Implement server routes for Gemini function calling, KTO KorService2 search/detail/image calls, and DataLab crowd signals.
4. Convert the result-card probe output into the first Apps in Toss UI flow with a rewarded-ad gate before the result card.
5. Review the question bank for repeated wording and user-facing tone before freezing the MVP copy.
