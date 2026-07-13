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
- AI direction: Gemini Flash-Lite runs on the Render backend as the final curator. The server builds the search plan from selected-answer metadata first, prepares KTO/DataLab candidates separately, compresses them to a score-qualified set of five through seven, then asks Gemini to choose one place and write persona/result-card copy only after the full-screen ad is shown. Do not put AI API keys in the client.
- Apps in Toss direction: Granite React Native scaffold now exists, based on the local `toss_tomato_public` build structure. The main app is wrapped in TDS and uses TDS `Text`/`Button`; selection and region cards use React Native `Pressable` with stable card sizing. Real-device visual QA is still required before submission.
- Question flow: required 3 questions plus 4 general questions. General questions include `crowd`, one of `mobility`/`accessibility`, one destination-specific question, and one additional non-overlapping tag group.
- Location filtering: use current location when permitted, or a user-selected origin. MVP estimate uses straight-line distance x 1.35, average 45km/h, 15 minutes of drive-time buffer, and 10km of distance buffer.
- Map opening direction: use Naver Map web search links for the MVP, opened through `openURL`. No Naver Maps API key is needed unless embedding maps or calculating route/time data inside the app.
- Daily recommendation policy: 3 base recommendations per KST day. A completed rewarded ad grants +1, up to 10 ad grants per day. A completed contacts share grants +3 once per day. Candidate preparation reserves a credit, success settles it, failures refund it, and abandoned reservations expire after 30 minutes.

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
- full-screen interstitial gate before result using Apps in Toss integrated ads; free public-data candidate preparation starts immediately after the final answer, while Gemini recommendation analysis starts only after `show`/`impression` (with `dismissed` fallback)
- result card with tourism info, Apps in Toss card-save action, Naver Map open button, and home reset
- result screen intentionally hides the top `어디고 / 추천 완료` header so the card is easier to save/share

Full-screen ad:

- production interstitial ad group ID: `ait.v2.live.69c443b05e6a42ea`
- production banner ad group ID: `ait.v2.live.67b07bf813d74267`
- production rewarded ad group ID: `ait.v2.live.7f9040b7cff746c5`
- contacts share-reward module ID: `1e6b212b-9093-4546-9991-99f478262910`
- `pages/index.tsx` preloads the interstitial ad from the intro screen, before question banners mount, and preserves that loaded ad through origin/question transitions. The ad gate retries only when the earlier preload failed or timed out. The checked-in source uses only the live interstitial/banner IDs. A 15-second load timeout, retry state, synchronous error handling, and `[wherego:interstitial-ad]` lifecycle logs with `attempt`/`elapsedMs` prevent an indefinite loading state and expose real SDK latency. The CTA prepares free public-data candidates, `showFullScreenAd` displays the ad, and Gemini starts once on `show`/`impression`, with `dismissed` as a fallback.
- Gemini starts behind the full-screen ad on `show`/`impression`, so KTO candidate completion and AI generation overlap the ad display time. After `dismissed`, `pages/index.tsx` shows a dedicated AI loading panel if the result is still pending. The panel shows `광고 확인 완료`, a spinner, and the steps `관광정보 후보 확인 / 방문자수 신호 비교 / AI 최종 장소 선택`.
- `pages/index.tsx` renders the question-screen banner with `InlineAd`.
- Non-Toss/local unsupported environments fall back to a development preview result path.

Card save:

- `pages/index.tsx` renders a hidden `react-native-svg` result card, captures it with `toDataURL`, and uses Apps in Toss `saveBase64Data` to save a 1080x1350 PNG result-card image.
- Minimum checked app support is Android `5.218.0` and iOS `5.216.0`. Older Toss app versions show a save-not-supported message; the app no longer opens the Apps in Toss `share` fallback from the save button.
- The save output is PNG only. The hidden SVG card uses the system font instead of forcing Arial, and is kept transparently mounted in-bounds to reduce malformed image output risk. The current saved card uses a narrower centered card, a taller real KTO hero photo, a compact centered location row, extra line capacity for recommendation reason/AI selection copy, and no small bottom source note. Before submission, test on real Toss devices because `saveBase64Data` depends on native Toss app support.

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
  - 2026-07-10 KST save check: saved PNG result card now uses the real KTO place image, a taller hero photo area, a compact address-only location row, and cleaned AI factor copy so the card fits inside 1080x1350. Terms-page build, `scripts/probe-question-bank-result.cjs --check`, `yarn typecheck`, `git diff --check`, and `yarn build` passed. Ignored AIT artifact deploymentId is `019f49fb-2216-7512-b555-4808770c2e41`.
  - 2026-07-10 KST save check: question generation moved to the `jbg` backend via `POST /api/wherego/questions`; the app fetches that set after origin selection and falls back to the bundled bank if the server is unavailable. SDK-check UI now shows a question-set loading panel, uses TDS `Button` loading for the origin CTA, and renders option numbers as fixed circular badges with two-line text limits. `jbg` Wherego route unittest passed with 16 tests. `wherego` `yarn typecheck`, `git diff --check`, and `yarn build` passed. Ignored AIT artifact deploymentId is `019f4a16-6e2b-7383-a0b6-6d42ff134754`.
  - 2026-07-10 KST save check: recommendation was split into `POST /api/wherego/candidates` for free KTO/DataLab candidate preparation and `POST /api/wherego/recommend` for Gemini final curation. The app starts candidate preparation when the rewarded-ad CTA is tapped, calls Gemini only after `userEarnedReward`, and shows a dedicated AI loading panel after ad completion. `jbg` Wherego route unittest passed with 18 tests. `wherego` `yarn typecheck`, `git diff --check`, and `yarn build` passed. Ignored AIT artifact deploymentId is `019f4a38-eefa-7f99-a0b0-217c6cb4363b`.
  - 2026-07-10 KST save check: question-screen secondary subcopy was removed so only the origin chip, eyebrow, question title, and selection cards remain. Saved PNG result cards were narrowed and centered inside the 1080x1350 image, recommendation reason/AI selection text capacity was expanded, and the location row label/value were vertically realigned. `wherego` `yarn typecheck`, `git diff --check`, and `yarn build` passed. Ignored AIT artifact deploymentId is `019f4a54-006b-7c33-9188-b575b14278ef`.
  - 2026-07-10 KST save check: option-card captions now render as one-line first-segment labels without middle-dot separators, even when the server returns `A · B` style captions. Saved PNG result cards no longer render the small bottom source/answer-count note. `wherego` `yarn typecheck`, `git diff --check`, and `yarn build` passed. Ignored AIT artifact deploymentId is `019f4a6c-74da-7641-9d84-451de40c32f3`.
  - 2026-07-10 KST save check: general question bank expanded to 14 tag groups / 420 questions with `outdoor_stay` 캠핑/피크닉. User-visible question templates were copy-edited to remove `형님`, colon-style prompts, and internal phrases like `여행지 검색어`/`장소를 특정`. `docs/wherego-copy-review.json` was added as a copy-only review file for another AI. `jbg` Gemini result-card prompt now asks for short card-safe Korean copy and clamps persona/reason/factor lengths. `jbg` Wherego route unittest passed with 20 tests, `wherego` copy scan found 0 risky prompt matches, terms build, `yarn typecheck`, `git diff --check`, and `yarn build` passed. Ignored AIT artifact deploymentId is `019f4a9d-4aa5-7dd9-a5b1-80d223a40738`.
  - 2026-07-11 KST save check: rewarded-ad loading moved from the fifth question to the reward gate so it no longer overlaps question banner loading. The client has a 15-second load timeout, retry state, lifecycle logs, and synchronous load/show error handling. Release source now contains only the live rewarded/banner ad group IDs. Stale `형님` copy was removed from both local recommendation probes. Live Render smoke returned 8 questions, 4 prepared/compressed candidates, `source.curator=gemini`, and a final image URL. Backend unittest 20, terms/question checks, asset dimensions, secret scan, `yarn typecheck`, `git diff --check`, and `yarn build` passed. Ignored AIT artifact deploymentId is `019f5096-2949-7302-a914-4fbf34166f12`. Real rewarded-ad event verification remains pending because no Android device was connected to ADB.
  - 2026-07-12 KST save check: runtime question selection now prevents repeated or semantically overlapping themes across the three source questions and five general questions. `crowd` remains required; `mobility/accessibility`, `activity/healing_energy`, `landscape/photo`, and `weather/season` are mutually exclusive families. Outdoor answers now distinguish tourism/picnic content type 12 from camping/leports content type 28. The 14-group / 420-question bank has zero duplicate prompts, invalid cards, long options, internal-survey phrases, or broken Korean particles. Five thousand generated sets produced zero theme-rule violations. Backend Wherego unittest passed 26 tests, frontend typecheck and `git diff --check` passed, both question-bank copies have matching SHA-256 hashes, and the ignored AIT build passed with deploymentId `019f533f-515b-7d05-be67-80dffafbde29`.
  - 2026-07-12 KST save check: runtime flow now uses 3 source questions plus 4 general questions. `crowd`, one of `mobility/accessibility`, and one destination-specific general question remain guaranteed. Binary question generation excludes semantically equivalent option pairs. Full-screen ad event failures or omissions no longer block the result because an 8-second guard continues recommendation analysis. KTO/DataLab candidates are narrowed to 18 or fewer, then compressed to a score-qualified, intent-diverse set of 5 through 7 for Gemini; only the final selected place receives detail/image lookup. Backend Wherego unittest passed 43 tests, frontend typecheck, terms build, question script syntax checks, asset dimensions, matching question-bank hashes, and `git diff --check` passed. AIT build deploymentId is `019f54d0-abe0-768b-b02c-326006f0b471`. Final upload-only logo candidate is `assets/wherego-logo-600.png` at 600x600; code and Toss icon URL remain unchanged for this candidate.
  - 2026-07-12 KST post-push Render smoke: `https://jbg.onrender.com/api/health` reached backend commit `dca1eae8b8a7cf32700880ea777ec3193838184c`. Three production 7-question probes returned source/general counts `3/4` and candidate reductions `19 -> 7 -> 5`, `97 -> 12 -> 5`, and `144 -> 18 -> 5`. The final Gemini call returned one place, `고양어린이박물관`, with `curator=gemini`, model `gemini-3.1-flash-lite`, and a usable image. A separate `59 -> 12 -> 5` probe showed two surviving search intents; five candidates were correct under the variable policy (two per intent plus one wildcard), not an environment-limit regression.
  - 2026-07-12 KST save check: result-screen and saved-PNG image attribution moved from a dark overlay in the photo's lower-right corner to a small gray caption below the photo. The KTO attribution remains visible without covering the tourism image. Frontend typecheck, `git diff --check`, and AIT build passed; deploymentId is `019f54e1-f528-7530-af86-609f9b571a79`.
  - 2026-07-12 KST save check: the 1080x1350 PNG canvas stays social-ready while the inner card width was reduced from 888px to 810px and centered with 135px side margins. Saved-card attribution no longer depends on unsupported SVG end anchoring, location/factor wrapping was tightened, and factor separators use commas so an orphan middle dot cannot start a new line. Frontend typecheck, `git diff --check`, and AIT build passed; deploymentId is `019f54eb-1e6a-71d9-a47b-c2329d3a06f7`.

## Current Question/API Work

- Runtime question copy and metadata are server-only. The canonical files are `C:\Users\ESOL\Documents\jbg\apps\server\backend\app\resources\wherego\source-question-blueprint.json` and `general-question-bank.json`.
- `data/source-question-blueprint.json` and `data/general-question-bank.json` remain historical review fixtures only; `pages/index.tsx` does not import or fall back to them.
- `docs/wherego-copy-review.json`: copy-only JSON for external AI review. It includes source-question copy, generated general-question copy, option label/caption previews, banned/risky expressions, and result-card Gemini copy rules. It intentionally excludes API keys and local credentials.
- `data/question-bank-normalized.json`: normalized copy of the downloaded Gemini question candidate file.
- `data/question-bank-additions.json`: curated additional question candidates and policy notes.
- `scripts/build-general-question-bank.cjs`: deterministic generator for the general bank.
- `scripts/probe-question-bank-result.cjs`: local Gemini-substitute probe using selected answers, real KTO APIs, min/max distance and time filtering, region-scope search, parking filtering, and DataLab crowd labeling.
- `scripts/probe-wherego-flow.cjs`: earlier direct KTO API flow probe.
- `public/mockups/question-flow/index.html`: clickable question-flow mockup. It uses image-free selection cards, location-origin choice, random 3+4 question generation, banner-ad position, full-screen-ad gate, Naver Map link, and result card with tourism info.
- Latest app UI pass: first screen hides the top nav/header and top logo, keeps the intro copy closer to the vertical center, origin screen hides the header copy, origin CTAs are spaced apart, direct-region text no longer clips, origin selection shows a question-set loading screen, question cards are compact fixed 2-column pastel cards for both 2-choice and 4-choice layouts, option numbers are fixed circular badges, long option text is constrained to two lines, option captions are one-line first-segment labels without middle-dot separators, the question subcopy line is hidden, selected cards show a 1s loading state before advancing, the full-screen-ad gate hides top header/progress, recommendation analysis starts after the ad CTA and actual ad display event, recommendation failure stays on the retry gate instead of opening a demo result, and the final result hides the top header.
- Banner ad behavior: the banner is visible from the question-set loading screen. The loading screen stays visible for at least 2 seconds. `InlineAd` is keyed by `question-set-loading`, `question-${questionIndex}`, `ai-recommendation-loading`, or `result`. It remounts per meaningful screen, not on option press. Analysis/result banners mount only after the full-screen ad fires `dismissed`, so a hidden banner is not loaded behind the interstitial. Interstitial preloading starts on the banner-free intro screen and is not reset when the question flow starts.

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
- The generated question bank is large enough for MVP experiments. The main remaining copy risk is external review feedback from `docs/wherego-copy-review.json`; the known internal prompt-template issues were cleaned up and scanned to 0 matches for the current banned-expression list.
- Apps in Toss UI calls the `jbg` Render-backed question and recommendation APIs. If `POST /api/wherego/questions` fails or returns anything other than a valid 3+4 set, the client stays on the origin screen with a retry message; there is no bundled question fallback. Recommendation failures stay on the reward gate with a retry CTA; demo result data must not surface in the normal result flow.
- KTO `searchKeyword2` can intermittently time out on some nationwide keyword calls; the server now skips single failed search calls, but live monitoring should watch empty-candidate rates.
- Card-save now writes a PNG card file through Apps in Toss `saveBase64Data`, but real-device validation is still needed.
- 2026-07-10 KST follow-up: saved PNG card clipping was caused by the hidden SVG card's lower text/AI box coordinates being too close to the 1080x1350 card bottom. `pages/index.tsx` and the mockup card SVG now reserve more bottom space and specify Korean-capable system fonts. The app no longer calls `share`; if a sheet still appears after `saveBase64Data`, it is the native Toss file-save UI because `saveBase64Data` exposes no no-sheet option in the local framework source.
- `brand.icon` now uses the Toss static logo URL supplied by the user. Still confirm in the Apps in Toss Console/device preview that the same icon appears in the Toss navigation surface before launch submission.
- The UI is now TDS-based, but the final pass still needs a real Toss app device check for typography, hit areas, ad rendering, and permission prompts.
- Recommendation failures no longer open a fallback/demo result. The user remains on the reward gate and can retry the recommendation request.
- Local Android sandbox dev now requires Yarn patches for `@granite-js/mpack`, `metro-react-native-babel-transformer`, and `react-native` because React Native `0.84.0` syntax breaks the older Granite/Metro parser path. Verified on device that `yarn dev` serves `http://127.0.0.1:8081/index.bundle?platform=android&dev=true&minify=false` with HTTP 200, the app opens through `intoss://wherego`, and the first screen -> origin screen -> current-location question flow reaches `출발 기준: 현재 위치(고양시)`.

## Current Server Direction

Wherego now reuses the existing `뭐샀지`/`jbg` Render FastAPI service instead of adding a Vercel API.

- client API base: `https://jbg.onrender.com`
- server repo/path: `C:\Users\ESOL\Documents\jbg\apps\server`
- endpoints: `POST /api/wherego/questions`, `POST /api/wherego/candidates`, `POST /api/wherego/recommend`
- server route file: `apps/server/backend/app/interfaces/http/routes/wherego.py`
- client API wrapper: `src/api/wheregoApi.ts`

`/api/wherego/questions` generates the runtime 7-question set from server-side resources: 3 source-axis questions and 4 general questions, with `crowd` required, one of `mobility`/`accessibility`, and at least one destination-specific general question. The remaining general question comes from a non-overlapping tag group. `/api/wherego/candidates` converts option metadata into three KTO search intents with content/classification filters, evaluates up to 50 rows per intent, removes invalid/expired rows, clusters sub-facilities of the same destination, and keeps up to 6 per intent (18 total). It attaches DataLab regional visitor signals before scoring for low-crowd/hot-place preference, then compresses to five through seven candidates according to score quality and intent diversity and returns `aiUsed=false`. `/api/wherego/recommend` accepts the prepared candidate set and asks Gemini to choose the final single place from those candidates; if no candidate set is supplied, it keeps the older all-in-one fallback path. If recommendation APIs fail, the client stays on the result gate and exposes a retry CTA. If interstitial show events are omitted or fail, an 8-second guard continues AI analysis instead of leaving the app stuck.

Gemini result-card copy is constrained server-side: persona title, persona summary, one-line recommendation, AI reason, and `whyThisPlace` factors must be short natural Korean suitable for the saved 1080x1350 result card. The server also clamps these fields during normalization.

Quota/runtime guardrails:

- `WHEREGO_KTO_SEARCH_MAX_CALLS=4` hard-caps KorService2 search calls per recommendation request. Search runs up to three destination intents concurrently with up to 50 rows each; a fourth fallback call runs only when fewer than five candidates survive. Final common/intro detail calls run only for the selected place.
- `WHEREGO_GEMINI_CANDIDATE_LIMIT=7` caps the candidate list sent to Gemini; the server hard-caps it at seven even if the env is higher.
- `WHEREGO_GEMINI_SCORE_WINDOW=24` excludes candidates whose final server score falls too far behind the strongest candidate while retaining up to seven diverse choices.
- `WHEREGO_KTO_PER_INTENT_CANDIDATES=6` caps the post-search, post-clustering pool per intent while still evaluating all fetched rows before that cap.
- `/api/wherego/candidates` does not call Gemini and does not fetch final detail/intro data.
- `/api/wherego/recommend` reuses a supplied candidate set instead of repeating KTO search.
- Only the final selected place gets KTO detail calls.
- For `nationwide` scope, KorService2 search omits `areaCode` so the limited call budget is spent across keywords instead of being exhausted by area-code loops.
- Single KTO search timeouts/errors are skipped when other calls return candidates; the request only fails if every search call fails or no fallback candidate can be built.
- `WHEREGO_KTO_DETAIL_IMAGE_ENABLED=false` skips the extra `detailImage2` call unless explicitly enabled.
- The server keeps an in-memory KTO response cache: search 24h, detail 7d, DataLab 24h by default.
- `src/api/wheregoApi.ts` times out recommendation requests after 45s. This keeps the wait bounded; timeout errors now lead to reward-gate retry instead of local fallback result display.

Required Render env additions:

- `WHEREGO_PUBLIC_DATA_PORTAL_SERVICE_KEY` or existing `DATA_GO_KR_SERVICE_KEY`
- `KTO_KOR_SERVICE_ENDPOINT=https://apis.data.go.kr/B551011/KorService2`
- `KTO_DATALAB_SERVICE_ENDPOINT=https://apis.data.go.kr/B551011/DataLabService`
- `GEMINI_API_KEY` already used by jbg
- `GEMINI_WHEREGO_MODEL=gemini-3.1-flash-lite`
- `GEMINI_WHEREGO_TIMEOUT_SECONDS=15`
- `GEMINI_WHEREGO_MAX_OUTPUT_TOKENS=640`
- `GEMINI_WHEREGO_HTTP_RETRIES=1`
- `WHEREGO_KTO_SEARCH_MAX_CALLS=4`
- `WHEREGO_KTO_SEARCH_ROWS=50`
- `WHEREGO_KTO_SEARCH_PARALLELISM=3`
- `WHEREGO_KTO_PER_INTENT_CANDIDATES=6`
- `WHEREGO_KTO_SEARCH_TIMEOUT_SECONDS=7`
- `WHEREGO_KTO_DATALAB_TIMEOUT_SECONDS=7`
- `WHEREGO_KTO_DATALAB_WINDOWS=2`
- `WHEREGO_KTO_DATALAB_LAG_DAYS=30`
- `WHEREGO_KTO_DATALAB_LOOKBACK_DAYS=14`
- `WHEREGO_KTO_DATALAB_ROWS=12000`
- `WHEREGO_KTO_DATALAB_FAILURE_CACHE_SECONDS=300`
- `WHEREGO_KTO_DETAIL_TIMEOUT_SECONDS=8`
- `WHEREGO_GEMINI_CANDIDATE_LIMIT=7`
- `WHEREGO_GEMINI_SCORE_WINDOW=24`
- `WHEREGO_KTO_CACHE_ENABLED=true`
- `WHEREGO_KTO_CACHE_MAX_ENTRIES=1024`
- `WHEREGO_KTO_SEARCH_CACHE_SECONDS=86400`
- `WHEREGO_KTO_DETAIL_CACHE_SECONDS=604800`
- `WHEREGO_KTO_DATALAB_CACHE_SECONDS=86400`
- `WHEREGO_KTO_DETAIL_IMAGE_ENABLED=false`
- `WHEREGO_ANALYTICS_ENABLED=true`
- `WHEREGO_ANALYTICS_HMAC_SECRET=<long-random-secret>`

Latest question-source policy (2026-07-13 KST): the JBG server is the only runtime source for question copy, option labels, tags, search hints, and constraints. A 7-question set contains three unique source axes and four unique general themes; mutually exclusive theme families and source/general semantic conflicts cannot appear together. The client no longer stores prior question history or generates local fallback questions.

Latest save verification (2026-07-12 KST): the client now obtains the Apps in Toss anonymous key, keeps a per-question-set session id, and sends both only to the Wherego API. The server rehashes the anonymous key, stores no exact coordinates, and retains answer metadata, candidate counts, the selected destination, Gemini reason, media/map availability, and latency for 90 days in the RLS-enabled `wherego_recommendation_logs` table. Success writes run after the API response; failure writes are captured synchronously so QC failure rates remain accurate. `backend.scripts.wherego_qc_report` checks failure/fallback/media/distance/latency/concentration issues, and Codex automation `qc` runs daily at 09:30 KST with an additional 7-day bias review on Mondays. The frontend bug that accepted remote questions only when there were eight was fixed to accept the current 3+4 question set. Question options now include cave/geology and temple/meditation, plus the source-axis binary `배우고 관람하기 / 신나게 놀기`; KTO intent mappings use `동굴`, `산사`, `테마파크`, and `루지`. Live KTO probes returned 10/20/10/9 first-page results respectively. Backend tests passed 48 cases, the runtime probe returned seven questions, TypeScript passed, and AIT build deploymentId is `019f55cd-b4e1-7a76-bd40-b840763dc74b`.

Production save smoke (2026-07-12 KST): Render served question-bank version `2026-07-12+2026-07-12` with seven questions. A complete questions -> candidates -> recommend request produced `8 -> 7 -> 5` candidates, selected `노을캠핑장(서울)` with `gemini-3.1-flash-lite`, and reported 3201ms server total. The QC row stored answer counts `7 / 3 / 4`, Gemini curator, image present, and map present; the smoke row was deleted after verification. Vercel production deployment `dpl_AZ1p4nVd9TJif3c4BL5ZUxfn3LTW` is READY and aliased to `https://wherego-lake.vercel.app`.

Latest save verification (2026-07-12 KST): the frontend now reads `/api/wherego/usage`, displays remaining AI recommendations on the intro screen, and opens a quota recovery screen when exhausted. Rewarded-ad `userEarnedReward` grants +1 through `/api/wherego/usage/reward`; contacts sharing uses module `1e6b212b-9093-4546-9991-99f478262910` and grants +3 once per day. The backend stores anonymous daily counters, idempotent grant IDs, and recommendation reservation states in RLS-enabled tables. Backend Wherego tests passed 51 cases, TypeScript passed, and the AIT build deploymentId was `019f563a-5b8e-7271-a1f4-120e83da8183`.

Production usage smoke (2026-07-12 KST): Render health reached `jbg` commit `ff65b8a8a503645193bac5007cd1f68a5dc3f7f2`. `POST /api/wherego/usage` returned `limitEnabled=true`, base limit/remaining `3/3`, ad rewards `0`, share reward unused, and KST reset `2026-07-13T00:00:00+09:00`.

Ad policy update verification (2026-07-13 KST): recommendations funded by base, rewarded-ad, or contacts-share credits all use the same result interstitial gate. The rewarded ad only adds recommendation credits. After a reward grant and ad dismissal, the app returns to intro with the updated count. TypeScript and AIT Android/iOS builds passed; deploymentId is `019f5778-7420-7555-ae22-aa499cda7567`.

Reward completion UX (2026-07-13 KST): after the server confirms rewarded-ad +1 or contacts-share +3, the app returns directly to the intro screen and shows the grant message with the updated remaining count. Dismissed ads and failed grants stay on the quota screen.

Back navigation UX (2026-07-13 KST): `useBackEvent` intercepts the Apps in Toss navigation/hardware back action on every app step. It always shows a native `계속하기 / 나가기` confirmation, keeps the current screen on continue, and calls `closeView` only after explicit exit confirmation.

Back navigation build verification (2026-07-13 KST): TypeScript and AIT Android/iOS builds passed with the all-screen `useBackEvent` exit confirmation and explicit `closeView`; deploymentId is `019f577f-5b18-7ccc-90ee-78d318bd58b6`.

Repeat-run failure diagnosis (2026-07-13 KST): the second run created a fresh session correctly, but the selected `고양시 + 10km 안쪽 + 자연/물가 + 주차 가까움` combination produced zero keyword candidates and logged `wherego_no_place_candidates`. The JBG backend now performs one `locationBasedList2` fallback only for zero-result requests with a maximum distance/time constraint, keeps the original distance filter, and caps the fallback radius at 20km. Backend tests passed 52 cases; production verification remains pending until the JBG change is saved/deployed.

Repeat-run production verification (2026-07-13 KST): Render commit `516aa62870df019538c168b8f04304eda6133936` completed the same failed combination with candidate counts `1 -> 1 -> 1`, Gemini `gemini-3.1-flash-lite`, final place `장흥자생수목원`, and 5669ms server total. The chosen fallback candidate had estimated road distance 19.1km and no image, so nearby candidate diversity and fallback-image rate remain monitoring items. Smoke usage/QC rows were removed.

## Operating Rules

- For context efficiency, read `docs/README.md` first, then follow the listed current docs. Do not start from archive-style or generated output scans.
- When the user says "저장", follow `SAVE_PROTOCOL.md`: refresh handoff/runbook state, verify narrowly, commit, and push unless explicitly told not to.
- Keep generated build outputs out of Git.
- Keep `.env`, API keys, `.ait`, `.vercel/`, `node_modules/`, and `dist/` out of Git.
- Before finalizing asset or app UI work, visually inspect generated assets or screens.

## Next Recommended Steps

1. After the Render deployment is healthy, verify the intro starts at three recommendations and a failed recommendation restores the reserved credit.
2. On a Toss app 5.223.0+ device, exhaust base credits and verify rewarded ad +1, contacts share +3 once, and the result interstitial for every recommendation.
3. Reconnect the Android device and verify `[wherego:interstitial-ad] load requested -> loaded -> show/impression -> dismissed` in logcat using the Apps in Toss dev server.
4. Test the complete SDK/device flow: server-generated questions, banner ads, interstitial completion, Gemini loading, result rendering, PNG save without a share sheet, and Naver Map open.
5. Watch Render `/api/wherego/candidates` and `/api/wherego/recommend` latency separately; if final wait is still unstable, tune KTO/Gemini timeouts or add backend prewarming.
6. Run `docs/wherego-copy-review.json` through another AI/copy reviewer and apply only concrete wording improvements that preserve search tags and recommendation intent.
7. Connect GitHub auto-deploy for Vercel project `joyai/wherego`, or continue using CLI manual deploys for terms-only updates.
8. After production recommendations accumulate, review the first daily and Monday QC reports and tune thresholds only after at least 10 successful samples.
