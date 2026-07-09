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
- AI direction: Gemini Flash-Lite runs on the Render backend as the final curator. The server builds the search plan from selected-answer metadata first, compresses KTO candidates to five or fewer, then asks Gemini to choose one place and write persona/result-card copy. Do not put AI API keys in the client.
- Apps in Toss direction: Granite React Native scaffold now exists, based on the local `toss_tomato_public` build structure. The main app is wrapped in TDS and uses TDS `Text`/`Button`; selection and region cards use React Native `Pressable` with stable card sizing. Real-device visual QA is still required before submission.
- Question flow: required 3 questions plus random 5 questions. Random questions must include `crowd` and one of `mobility`/`accessibility`, then fill the remaining three from different tag groups.
- Location filtering: use current location when permitted, or a user-selected origin. MVP estimate uses straight-line distance x 1.35, average 45km/h, 15 minutes of drive-time buffer, and 10km of distance buffer.
- Map opening direction: use Naver Map web search links for the MVP, opened through `openURL`. No Naver Maps API key is needed unless embedding maps or calculating route/time data inside the app.

## Current Apps in Toss App

Granite/Apps in Toss build scaffold was added from the `뭐샀지` (`toss_tomato_public`) pattern:

- `package.json`, `yarn.lock`, `.yarnrc.yml`, `.yarn/releases/`, `.yarn/patches/`
- `granite.config.ts`
- `index.ts`
- `require.context.ts`
- `src/_app.tsx`
- `src/router.gen.ts`
- `src/types/assets.d.ts`
- `pages/index.tsx`
- `pages/_404.tsx`
- `scripts/ait-build.ps1`
- `babel.config.js`, `tsconfig.json`, `react-native.config.js`

Current app flow in `pages/index.tsx`:

- intro screen with 한국관광공사 관광정보 기반 copy and a start CTA; the top app logo is intentionally omitted from the first viewport, and the text block is lowered toward the vertical center instead of hugging the top
- origin choice: current location via `useGeolocation` only after the user taps the current-location CTA, or direct region selection fallback. The direct region button is a custom `Pressable` to avoid clipped Korean text in Toss.
- question flow: 3 required source questions plus 5 random general questions
- question-card taps now show the selected card and a short 1s loading state before advancing
- Apps in Toss inline banner ad during questions
- rewarded ad gate before result using Apps in Toss integrated ads; recommendation analysis starts only after the user taps the rewarded-ad CTA, not on the final question tap
- result card with tourism info, Apps in Toss card-save action, Naver Map open button, and home reset
- result screen intentionally hides the top `어디고 / 추천 완료` header so the card is easier to save/share

Rewarded ad:

- production rewarded ad group ID: `ait.v2.live.7f9040b7cff746c5`
- production banner ad group ID: `ait.v2.live.67b07bf813d74267`
- `pages/index.tsx` loads the ad with `loadFullScreenAd`, starts recommendation analysis when the rewarded-ad CTA is tapped, shows the ad with `showFullScreenAd`, and opens the result only after both reward access and successful recommendation completion. Recommendation errors stay on the reward gate with a retry CTA instead of showing local demo data.
- `pages/index.tsx` renders the question-screen banner with `InlineAd`.
- Non-Toss/local unsupported environments fall back to a development preview result path.

Card save:

- `pages/index.tsx` renders a hidden `react-native-svg` result card, captures it with `toDataURL`, and uses Apps in Toss `saveBase64Data` to save a 1080x1350 PNG result-card image.
- Minimum checked app support is Android `5.218.0` and iOS `5.216.0`. Older Toss app versions show a save-not-supported message; the app no longer opens the Apps in Toss `share` fallback from the save button.
- The save output is PNG only. The hidden SVG card uses the system font instead of forcing Arial, and is kept transparently mounted in-bounds to reduce malformed image output risk. Before submission, test on real Toss devices because `saveBase64Data` depends on native Toss app support.

`granite.config.ts` uses:

- `appName: wherego`
- display name `어디고`
- `brand.icon` uses the Toss-hosted logo URL supplied during UI review: `https://static.toss.im/appsintoss/51165/be941510-6da6-4bba-982c-11824ab9a089.png`.
- `geolocation` permission
- Apps in Toss navigation bar with back/home buttons

## Current Assets

- `assets/logo.png`: 600x600 app logo.
- `assets/thumbnail.png`: 1932x828 Apps in Toss-style thumbnail.
- `public/assets/logo.png`: static copy used only by local/mockup pages, not by the production Apps in Toss brand config.
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

Vercel is used only for terms/privacy URLs. It is not the app server and should not be treated as production logo or thumbnail hosting.

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
  - 2026-07-09 KST: Apps in Toss dependencies installed with committed Yarn 4 release/patches. `yarn typecheck` passed. `yarn build` produced local ignored artifact `wherego.ait` with deploymentId `019f4475-b925-7a22-bca3-fed52822aee1`. Terms-page build also passed.
  - 2026-07-09 KST save check: server-backed recommendation client, Apps in Toss rewarded ad integration, 15s recommendation fallback timeout, and first-screen copy update verified with `yarn typecheck`; `yarn build` produced ignored `wherego.ait` deploymentId `019f456c-799d-7d93-94d3-fd6ba89e22e5`.
  - 2026-07-09 KST post-push Render smoke: `https://jbg.onrender.com/api/health` reached `jbg` commit `3b7a8b6844e9e32ea47db6da9d04ab23387850b8`; `POST /api/wherego/recommend` returned HTTP 200 with `source.planner=gemini`, 3 places, first place `국립중앙박물관 전통염료식물원`.
  - 2026-07-09 KST save check: Wherego frontend typecheck and `yarn build` passed; ignored AIT artifact deploymentId `019f45b7-4889-72c6-ac16-3d27c8c1336b`. Backend Wherego route tests passed with FastAPI stub; backend `py_compile` passed. Real KTO random-flow probes confirmed source 3 + general 5 answers can collect candidates and compress them to five or fewer. Nationwide search now uses keyword-only KTO calls, keeps long-distance options possible, and skips single KTO timeouts when other calls succeed.
  - 2026-07-09 KST post-push Render smoke: `https://jbg.onrender.com/api/health` reached `jbg` commit `47013953a6b4ceaac5fa0927ba08941a0d376b11`; `POST /api/wherego/recommend` returned HTTP 200 with `source.planner=metadata`, `source.curator=gemini`, 1 place, first place `서울어린이대공원`, and Naver map link present.
  - 2026-07-09 KST Apps in Toss guideline recheck: MCP transport closed, so official developer docs were checked directly. Non-game/TDS, location permission timing, banner/reward ad placement, build/deploy, and brand icon requirements were reviewed. Code uses TDS primitives where practical, requests location only after CTA tap, keeps the banner at 100% x 96, and keeps Vercel terms-only.
  - 2026-07-09 KST save check: terms-page build, `yarn typecheck`, and `yarn build` passed. Ignored AIT artifact deploymentId is `019f45e3-a0de-7e80-a3f8-464868942345`.
  - 2026-07-09 KST live recommendation check: Render `POST /api/wherego/recommend` returned HTTP 200 in 2.57s with `source.planner=metadata`, `source.curator=gemini`, `source.kto=KorService2`, `source.crowd=DataLabService locgoRegnVisitrDDList`, selected `우면산자연생태공원`, and an image URL present.
  - 2026-07-09 KST KTO image check for a legacy local fallback place: `searchKeyword2` returned `firstimage`, while `detailCommon2` and `detailImage2` returned no image. Keep using search-result image fallback when detail images are unavailable.
  - 2026-07-09 KST save check: `yarn typecheck` passed and `yarn build` passed with ignored AIT artifact deploymentId `019f460a-8635-7ca9-897a-8df0d676cf9d`.
  - 2026-07-09 KST save check: result screen header removal, question-card two-column layout, reward-gate loading indicator, and initial SVG card-save flow were implemented. Terms-page build, `scripts/probe-question-bank-result.cjs --check`, `yarn typecheck`, `git diff --check`, and `yarn build` passed. Ignored AIT artifact deploymentId is `019f4666-aafa-7a02-b955-c802dffc027d`. Browser mockup confirmed the result header is hidden and a legacy SVG card file could be created.
  - 2026-07-09 KST fix check: card save was changed from SVG file output to PNG output using `react-native-svg` `toDataURL` plus Apps in Toss `saveBase64Data(image/png)`. `yarn typecheck`, `git diff --check`, and `yarn build` passed. Ignored AIT artifact deploymentId is `019f4675-4c16-7bf2-b6a2-caef2741f1f7`.
  - 2026-07-10 KST save check: first-screen intro copy was lowered toward the vertical center in both the app and mockup. Terms-page build, `scripts/probe-question-bank-result.cjs --check`, `yarn typecheck`, `git diff --check`, and `yarn build` passed. Ignored AIT artifact deploymentId is `019f4916-8162-7022-8180-1e354788acc6`.
  - 2026-07-10 KST save check: question-card tap delay was reduced to 1s, reward-gate top header/progress stays hidden, and recommendation analysis now starts from the rewarded-ad CTA while the ad flow is running. Terms-page build, `scripts/probe-question-bank-result.cjs --check`, `yarn typecheck`, `git diff --check`, and `yarn build` passed. Ignored AIT artifact deploymentId is `019f492e-81c6-7044-986f-2f3028a34528`.
  - 2026-07-10 KST save check: direct-region text clipping was fixed with a custom Pressable button and taller region cards; recommendation errors now stay on the reward gate with `추천 다시 시도`; local demo/fallback results no longer open after server failure; card save no longer opens share fallback and uses system-font PNG rendering. Render smoke returned HTTP 200 with `source.curator=gemini`, selected `서울어린이대공원`, and an image URL. Terms-page build, `scripts/probe-question-bank-result.cjs --check`, `yarn typecheck`, `git diff --check`, and `yarn build` passed. Ignored AIT artifact deploymentId is `019f494b-cb34-72b1-a1f3-1ee8f64da56c`.

## Current Question/API Work

- `data/source-question-blueprint.json`: required source axes for movement scope, party constraints, and destination intent.
- `data/general-question-bank.json`: generated general question bank, 13 tag groups x 30 questions = 390 questions. Each group now has 12 source options that are recombined into 30 questions.
- `data/question-bank-normalized.json`: normalized copy of the downloaded Gemini question candidate file.
- `data/question-bank-additions.json`: curated additional question candidates and policy notes.
- `scripts/build-general-question-bank.cjs`: deterministic generator for the general bank.
- `scripts/probe-question-bank-result.cjs`: local Gemini-substitute probe using selected answers, real KTO APIs, min/max distance and time filtering, region-scope search, parking filtering, and DataLab crowd labeling.
- `scripts/probe-wherego-flow.cjs`: earlier direct KTO API flow probe.
- `public/mockups/question-flow/index.html`: clickable question-flow mockup. It uses image-free selection cards, location-origin choice, random 3+5 question generation, banner-ad position, rewarded-ad gate, Naver Map link, and result card with tourism info.
- Latest app UI pass: first screen hides the top nav/header and top logo, keeps the intro copy closer to the vertical center, origin screen hides the header copy, origin CTAs are spaced apart, direct-region text no longer clips, question cards are compact fixed 2-column pastel cards for both 2-choice and 4-choice layouts, selected cards show a 1s loading state before advancing, the reward gate hides top header/progress, recommendation analysis starts only after the rewarded-ad CTA, recommendation failure stays on the retry gate instead of opening a demo result, and the final result hides the top header.

Latest known Render smoke result with the Seoul City Hall test origin:

- Persona: 아이와 함께하는 도심 속 힐링 큐레이터.
- Recommended place: 서울어린이대공원.
- Source: `planner=metadata`, `curator=gemini`, `kto=KorService2`, `crowd=DataLabService locgoRegnVisitrDDList`.
- Crowd data latest base date observed: `20260609`.

## Current Blockers And Risks

- MVP recommendation structure is complete enough for launch-candidate testing, but not yet fully launch-cleared.
- Vercel project exists and terms URLs are live, but GitHub auto-deploy is not connected yet.
- API keys for 한국관광공사 and AI services must stay out of client code and Git. `.env.local` is intentionally ignored.
- The current drive-time filter is an estimate, not real routing. A map/routing API is needed for production-grade travel time.
- DataLab visitor counts are regional, not place-level. Treat crowd labels as a weak supporting signal.
- The generated question bank is large enough for MVP experiments. The remaining copy risk is mostly repeated prompt templates, not missing tags or missing search hints.
- Apps in Toss UI now calls the `jbg` Render-backed recommendation API. Server/API/Gemini failures stay on the reward gate with a retry CTA; demo data is retained only as a defensive local fallback and should not surface in the normal result flow.
- KTO `searchKeyword2` can intermittently time out on some nationwide keyword calls; the server now skips single failed search calls, but live monitoring should watch empty-candidate rates.
- Card-save now writes a PNG card file through Apps in Toss `saveBase64Data`, but real-device validation is still needed.
- `brand.icon` now uses the Toss static logo URL supplied by the user. Still confirm in the Apps in Toss Console/device preview that the same icon appears in the Toss navigation surface before launch submission.
- The UI is now TDS-based, but the final pass still needs a real Toss app device check for typography, hit areas, ad rendering, and permission prompts.
- Recommendation failures no longer open a fallback/demo result. The user remains on the reward gate and can retry the recommendation request.

## Current Server Direction

Wherego now reuses the existing `뭐샀지`/`jbg` Render FastAPI service instead of adding a Vercel API.

- client API base: `https://jbg.onrender.com`
- server repo/path: `C:\Users\ESOL\Documents\jbg\apps\server`
- new endpoint: `POST /api/wherego/recommend`
- server route file: `apps/server/backend/app/interfaces/http/routes/wherego.py`
- client API wrapper: `src/api/wheregoApi.ts`

The endpoint accepts origin plus selected answers, builds a metadata-based search plan from option tags/search hints/constraints, calls KTO KorService2 for tourist places, compresses candidates to at most five, and asks Gemini to choose the final single place from those candidates. DataLab regional visitor counts are included as a crowd signal before the Gemini final selection. If the server call fails in the client, `pages/index.tsx` keeps the user on the reward gate and shows `추천 다시 시도`.

Quota/runtime guardrails:

- `WHEREGO_KTO_SEARCH_MAX_CALLS=6` caps KorService2 search calls per recommendation request.
- `WHEREGO_GEMINI_CANDIDATE_LIMIT=5` caps the candidate list sent to Gemini; the server hard-caps it at five even if the env is higher.
- Only the final selected place gets KTO detail calls.
- For `nationwide` scope, KorService2 search omits `areaCode` so the limited call budget is spent across keywords instead of being exhausted by area-code loops.
- Single KTO search timeouts/errors are skipped when other calls return candidates; the request only fails if every search call fails or no fallback candidate can be built.
- `WHEREGO_KTO_DETAIL_IMAGE_ENABLED=false` skips the extra `detailImage2` call unless explicitly enabled.
- The server keeps an in-memory KTO response cache: search 6h, detail 7d, DataLab 24h by default.
- `src/api/wheregoApi.ts` times out recommendation requests after 45s. This keeps the wait bounded; timeout errors now lead to reward-gate retry instead of local fallback result display.

Required Render env additions:

- `WHEREGO_PUBLIC_DATA_PORTAL_SERVICE_KEY` or existing `DATA_GO_KR_SERVICE_KEY`
- `KTO_KOR_SERVICE_ENDPOINT=https://apis.data.go.kr/B551011/KorService2`
- `KTO_DATALAB_SERVICE_ENDPOINT=https://apis.data.go.kr/B551011/DataLabService`
- `GEMINI_API_KEY` already used by jbg
- `GEMINI_WHEREGO_MODEL=gemini-3.1-flash-lite`
- `WHEREGO_KTO_SEARCH_MAX_CALLS=6`
- `WHEREGO_GEMINI_CANDIDATE_LIMIT=5`
- `WHEREGO_KTO_CACHE_ENABLED=true`
- `WHEREGO_KTO_CACHE_MAX_ENTRIES=512`
- `WHEREGO_KTO_SEARCH_CACHE_SECONDS=21600`
- `WHEREGO_KTO_DETAIL_CACHE_SECONDS=604800`
- `WHEREGO_KTO_DATALAB_CACHE_SECONDS=86400`
- `WHEREGO_KTO_DETAIL_IMAGE_ENABLED=false`

## Operating Rules

- For context efficiency, read `docs/README.md` first, then follow the listed current docs. Do not start from archive-style or generated output scans.
- When the user says "저장", follow `SAVE_PROTOCOL.md`: refresh handoff/runbook state, verify narrowly, commit, and push unless explicitly told not to.
- Keep generated build outputs out of Git.
- Keep `.env`, API keys, `.ait`, `.vercel/`, `node_modules/`, and `dist/` out of Git.
- Before finalizing asset or app UI work, visually inspect generated assets or screens.

## Next Recommended Steps

1. Test the live Apps in Toss app flow on device: logo in navigation, location permission, region fallback, banner ad, rewarded ad, retry-on-failure behavior, result rendering, and Naver Map open.
2. For policy-sensitive ad testing, switch to Apps in Toss test ad IDs before review-device testing, then restore production IDs only when appropriate.
3. Test the PNG card-save flow on real Toss devices and confirm it saves without opening the share sheet.
4. Watch Render recommendation latency and retry rate after the 45s timeout change; if response time is still unstable, add server-side prewarming or tighter KTO/Gemini timeout tuning.
5. Connect GitHub auto-deploy for Vercel project `joyai/wherego`, or continue using CLI manual deploys for terms-only updates.
