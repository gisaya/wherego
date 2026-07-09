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
- Apps in Toss direction: Granite React Native scaffold now exists, based on the local `toss_tomato_public` build structure. TDS package is installed; current UI is custom React Native and should be reviewed against TDS before submission freeze.
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

- intro screen with `어디고` logo
- origin choice: current location via `useGeolocation` or selected region fallback
- question flow: 3 required source questions plus 5 random general questions
- Apps in Toss inline banner ad during questions
- rewarded ad gate before result using Apps in Toss integrated ads
- result card with tourism info, card-save placeholder, Naver Map open button, and home reset

Rewarded ad:

- production rewarded ad group ID: `ait.v2.live.7f9040b7cff746c5`
- production banner ad group ID: `ait.v2.live.67b07bf813d74267`
- `pages/index.tsx` loads the ad with `loadFullScreenAd`, shows it with `showFullScreenAd`, and opens the result only after `userEarnedReward`.
- `pages/index.tsx` renders the question-screen banner with `InlineAd`.
- Non-Toss/local unsupported environments fall back to a development preview result path.

`granite.config.ts` uses:

- `appName: wherego`
- display name `어디고`
- icon URL `https://wherego-lake.vercel.app/assets/logo.png`
- `geolocation` permission
- Apps in Toss navigation bar with back/home buttons

## Current Assets

- `assets/logo.png`: 600x600 app logo.
- `assets/thumbnail.png`: 1932x828 Apps in Toss-style thumbnail.
- `public/assets/logo.png`: public copy used by `granite.config.ts` icon URL after Vercel deployment.
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
  - 2026-07-09 KST: Apps in Toss dependencies installed with committed Yarn 4 release/patches. `yarn typecheck` passed. `yarn build` produced local ignored artifact `wherego.ait` with deploymentId `019f4475-b925-7a22-bca3-fed52822aee1`. Terms-page build also passed.
  - 2026-07-09 KST save check: server-backed recommendation client, Apps in Toss rewarded ad integration, 15s recommendation fallback timeout, and first-screen copy update verified with `yarn typecheck`; `yarn build` produced ignored `wherego.ait` deploymentId `019f456c-799d-7d93-94d3-fd6ba89e22e5`.
  - 2026-07-09 KST post-push Render smoke: `https://jbg.onrender.com/api/health` reached `jbg` commit `3b7a8b6844e9e32ea47db6da9d04ab23387850b8`; `POST /api/wherego/recommend` returned HTTP 200 with `source.planner=gemini`, 3 places, first place `국립중앙박물관 전통염료식물원`.
  - 2026-07-09 KST save check: Wherego frontend typecheck and `yarn build` passed; ignored AIT artifact deploymentId `019f45b7-4889-72c6-ac16-3d27c8c1336b`. Backend Wherego route tests passed with FastAPI stub; backend `py_compile` passed. Real KTO random-flow probes confirmed source 3 + general 5 answers can collect candidates and compress them to five or fewer. Nationwide search now uses keyword-only KTO calls, keeps long-distance options possible, and skips single KTO timeouts when other calls succeed.

## Current Question/API Work

- `data/source-question-blueprint.json`: required source axes for movement scope, party constraints, and destination intent.
- `data/general-question-bank.json`: generated general question bank, 13 tag groups x 30 questions = 390 questions. Each group now has 12 source options that are recombined into 30 questions.
- `data/question-bank-normalized.json`: normalized copy of the downloaded Gemini question candidate file.
- `data/question-bank-additions.json`: curated additional question candidates and policy notes.
- `scripts/build-general-question-bank.cjs`: deterministic generator for the general bank.
- `scripts/probe-question-bank-result.cjs`: local Gemini-substitute probe using selected answers, real KTO APIs, min/max distance and time filtering, region-scope search, parking filtering, and DataLab crowd labeling.
- `scripts/probe-wherego-flow.cjs`: earlier direct KTO API flow probe.
- `public/mockups/question-flow/index.html`: clickable question-flow mockup. It uses image-free selection cards, location-origin choice, random 3+5 question generation, banner-ad position, rewarded-ad gate, Naver Map link, and result card with tourism info.

Latest known probe result with the default Seoul City Hall test origin:

- Persona: 아이와 함께하는 근교 숲 힐링 드라이버.
- Recommended places: 일월수목원, 일영허브랜드(숲길정원), 무릉도원수목원.
- Crowd data latest base date observed: `20260609`.

## Current Blockers And Risks

- MVP recommendation structure is complete enough for launch-candidate testing, but not yet fully launch-cleared.
- Vercel project exists and terms URLs are live, but GitHub auto-deploy is not connected yet.
- API keys for 한국관광공사 and AI services must stay out of client code and Git. `.env.local` is intentionally ignored.
- The current drive-time filter is an estimate, not real routing. A map/routing API is needed for production-grade travel time.
- DataLab visitor counts are regional, not place-level. Treat crowd labels as a weak supporting signal.
- The generated question bank is large enough for MVP experiments. The remaining copy risk is mostly repeated prompt templates, not missing tags or missing search hints.
- Apps in Toss UI now calls the `jbg` Render-backed recommendation API and falls back to demo recommendation data when the server is unavailable or slow.
- KTO `searchKeyword2` can intermittently time out on some nationwide keyword calls; the server now skips single failed search calls, but live monitoring should watch empty-candidate rates.
- Card-save button is still a placeholder in the first buildable app.

## Current Server Direction

Wherego now reuses the existing `뭐샀지`/`jbg` Render FastAPI service instead of adding a Vercel API.

- client API base: `https://jbg.onrender.com`
- server repo/path: `C:\Users\ESOL\Documents\jbg\apps\server`
- new endpoint: `POST /api/wherego/recommend`
- server route file: `apps/server/backend/app/interfaces/http/routes/wherego.py`
- client API wrapper: `src/api/wheregoApi.ts`

The endpoint accepts origin plus selected answers, builds a metadata-based search plan from option tags/search hints/constraints, calls KTO KorService2 for tourist places, compresses candidates to at most five, and asks Gemini to choose the final single place from those candidates. DataLab regional visitor counts are included as a crowd signal before the Gemini final selection. If the server call fails in the client, `pages/index.tsx` falls back to the local demo result.

Quota/runtime guardrails:

- `WHEREGO_KTO_SEARCH_MAX_CALLS=6` caps KorService2 search calls per recommendation request.
- `WHEREGO_GEMINI_CANDIDATE_LIMIT=5` caps the candidate list sent to Gemini; the server hard-caps it at five even if the env is higher.
- Only the final selected place gets KTO detail calls.
- For `nationwide` scope, KorService2 search omits `areaCode` so the limited call budget is spent across keywords instead of being exhausted by area-code loops.
- Single KTO search timeouts/errors are skipped when other calls return candidates; the request only fails if every search call fails or no fallback candidate can be built.
- `WHEREGO_KTO_DETAIL_IMAGE_ENABLED=false` skips the extra `detailImage2` call unless explicitly enabled.
- The server keeps an in-memory KTO response cache: search 6h, detail 7d, DataLab 24h by default.
- `src/api/wheregoApi.ts` times out recommendation requests after 15s so the app can fall back quickly.

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

1. After the `jbg` push deploys on Render, smoke-test `/api/wherego/recommend` and confirm `source.planner=metadata`, `source.curator=gemini`, and exactly one recommended place.
2. Test the live Apps in Toss app flow on device: location permission, region fallback, banner ad, rewarded ad, result rendering, and Naver Map open.
3. Decide whether card-save placeholder is acceptable for first submission; otherwise wire result-card capture/save before submission.
4. Review the React Native UI against TDS requirements and replace custom primitives where needed.
5. Connect GitHub auto-deploy for Vercel project `joyai/wherego`, or continue using CLI manual deploys.
