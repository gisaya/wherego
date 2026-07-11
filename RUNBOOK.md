# Wherego Runbook

## Project

Workspace:

```powershell
C:\Users\ESOL\Documents\wherego
```

Remote:

```powershell
https://github.com/gisaya/wherego.git
```

## Documentation

Start with:

```text
docs/README.md
```

Follow the current docs linked there. Keep updates short, and do not store API keys, long logs, or user data in docs.

## Environment

Local API credentials are stored in:

```text
.env.local
```

Committed example:

```text
.env.example
```

Current environment variables:

```text
PUBLIC_DATA_PORTAL_SERVICE_KEY
KTO_KOR_SERVICE_DOC_URL
KTO_KOR_SERVICE_ENDPOINT
KTO_DATALAB_SERVICE_DOC_URL
KTO_DATALAB_SERVICE_ENDPOINT
```

Never commit `.env.local` or paste the raw key into docs.

## Terms Page Build

Vercel is used only for Wherego terms/privacy URLs. Do not use Vercel as the production API server or as the Apps in Toss logo/thumbnail hosting dependency.

Normal `node` may not be on PATH in PowerShell. Use the bundled Codex Node when needed:

```powershell
& 'C:\Users\ESOL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/build-vercel-terms.cjs
```

Expected output:

```text
.vercel/output/static/index.html
.vercel/output/static/terms/service/index.html
.vercel/output/static/terms/privacy/index.html
```

## Apps in Toss Build

The app uses the Granite React Native stack copied from the local `뭐샀지`/`toss_tomato_public` pattern. Yarn 4 is committed under `.yarn/releases`, with Windows compatibility patches under `.yarn/patches`.

Install dependencies:

```powershell
& 'C:\Users\ESOL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .yarn\releases\yarn-4.9.1.cjs install
```

Typecheck:

```powershell
& 'C:\Users\ESOL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .yarn\releases\yarn-4.9.1.cjs typecheck
```

Build the Apps in Toss artifact:

```powershell
& 'C:\Users\ESOL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .yarn\releases\yarn-4.9.1.cjs build
```

Expected local artifact:

```text
wherego.ait
```

`wherego.ait`, `node_modules/`, `.granite/`, `.swc/`, `.codex-shims/`, and `dist/` are local outputs and must not be committed.

Main app files:

```text
granite.config.ts
pages/index.tsx
src/_app.tsx
scripts/ait-build.ps1
```

Submission-sensitive config:

- `granite.config.ts` uses Apps in Toss `geolocation` permission and navigation-bar back/home buttons.
- `brand.icon` uses the Toss static logo URL: `https://static.toss.im/appsintoss/51165/be941510-6da6-4bba-982c-11824ab9a089.png`.
- Before launch submission, confirm in Apps in Toss Console/device preview that the navigation logo and console logo/thumbnail match the intended assets.
- The main UI uses `@toss/tds-react-native` through `TDSProvider`, TDS `Text`, and TDS `Button`. Selection and region cards use React Native `Pressable` with stable card dimensions.
- Location permission is requested only after the user taps the current-location CTA; users can start with region selection without granting location.
- The direct-region button is a custom `Pressable` rather than a TDS button so Korean text does not clip in the Toss surface.
- Question-card selection shows the selected card and a 1s loading state before advancing.
- Public-data candidate preparation starts when the user taps the rewarded-ad CTA. Gemini recommendation analysis starts only after the rewarded ad fires `userEarnedReward`. The final question tap should not call either recommendation endpoint.
- Recommendation errors stay on the reward gate and show `추천 다시 시도`; do not open local demo results after API failure.
- The final result screen hides the top app header. This is intentional so the result card and actions are the focus.
- `카드 저장하기` uses `react-native-svg` `toDataURL` plus Apps in Toss `saveBase64Data` to save a generated PNG result card. The minimum checked support is Android `5.218.0` and iOS `5.216.0`; older app versions show a save-not-supported message.
- The app does not call the Apps in Toss `share` API from the save button. If a system sheet appears while saving, treat it as the native `saveBase64Data` file-save flow; the current framework API has no option to suppress that sheet.
- The saved card format is PNG only. The save button must not open the share sheet. Run real-device save/gallery checks before launch.

Rewarded ad:

```text
production rewarded ad group ID: ait.v2.live.7f9040b7cff746c5
production banner ad group ID: ait.v2.live.67b07bf813d74267
```

`pages/index.tsx` uses the Apps in Toss integrated ad API. `loadFullScreenAd` starts after entering the reward gate, once the question banner has unmounted; `showFullScreenAd` runs on the reward CTA, and `userEarnedReward` plus successful Gemini recommendation completion opens the result screen. The release source uses only the live ad group IDs below.
- The rewarded-ad CTA starts only `POST /api/wherego/candidates`, which uses free KTO/DataLab calls. Gemini is called later through `POST /api/wherego/recommend` only after `userEarnedReward`.
- Reward loading has a 15-second timeout and retry state. Lifecycle logs use the `[wherego:reward-ad]` prefix. If an Android test stalls, inspect these logs for `load requested`, `loaded`, timeout/error, and `show event` in order.
- After reward completion, the app shows a dedicated AI loading panel with spinner and staged text until Gemini returns. It should not look like the user is still waiting on the ad screen.

During questions, `pages/index.tsx` renders Apps in Toss `InlineAd` with the production banner ad group ID.

Ads guideline notes:

- Keep the banner outside the intro screen and inside the question flow.
- Keep the banner wrapper at 100% width and 96px height.
- Do not decorate or alter the ad creative beyond the allowed wrapper layout.
- Before submission, scan the release source and AIT artifact to confirm that only live ad group IDs remain.

## Recommendation API

Wherego uses the existing `뭐샀지` Render FastAPI service:

```text
https://jbg.onrender.com
```

Client files:

```text
src/config.ts
src/api/wheregoApi.ts
pages/index.tsx
```

Server files in `C:\Users\ESOL\Documents\jbg`:

```text
apps/server/backend/app/interfaces/http/routes/wherego.py
apps/server/backend/tests/test_wherego_recommendation.py
apps/server/env/prod.example
apps/server/env/local.example
```

Server endpoint:

```text
POST /api/wherego/questions
POST /api/wherego/candidates
POST /api/wherego/recommend
```

Required Render env:

```text
WHEREGO_PUBLIC_DATA_PORTAL_SERVICE_KEY=<public-data-key>
KTO_KOR_SERVICE_ENDPOINT=https://apis.data.go.kr/B551011/KorService2
KTO_DATALAB_SERVICE_ENDPOINT=https://apis.data.go.kr/B551011/DataLabService
GEMINI_API_KEY=<existing-jbg-gemini-key>
GEMINI_WHEREGO_MODEL=gemini-3.1-flash-lite
WHEREGO_KTO_SEARCH_MAX_CALLS=6
WHEREGO_GEMINI_CANDIDATE_LIMIT=5
WHEREGO_KTO_CACHE_ENABLED=true
WHEREGO_KTO_CACHE_MAX_ENTRIES=512
WHEREGO_KTO_SEARCH_CACHE_SECONDS=21600
WHEREGO_KTO_DETAIL_CACHE_SECONDS=604800
WHEREGO_KTO_DATALAB_CACHE_SECONDS=86400
WHEREGO_KTO_DETAIL_IMAGE_ENABLED=false
```

Quota/runtime behavior:

- Search is capped by `WHEREGO_KTO_SEARCH_MAX_CALLS` per request.
- The server builds the search plan from selected-answer metadata, not from a first Gemini planning call.
- For `nationwide` scope, search calls omit `areaCode` so the call budget is spent across keywords.
- `POST /api/wherego/candidates` searches KTO, compresses candidates to at most five, attaches DataLab crowd signals, and returns `aiUsed=false`.
- `POST /api/wherego/recommend` accepts the prepared candidate set and reuses it so KTO search is not repeated. If no candidate set is supplied, it keeps the older all-in-one fallback path.
- Gemini receives the thin candidate list plus merged tags/search hints/constraints and selects one final place only after reward completion.
- Only the final selected place gets KTO detail calls.
- A single KTO search timeout is skipped if other search calls return candidates.
- `detailImage2` is disabled by default; use search/detail common image fields first.
- KTO search responses are cached in server memory for 6 hours, detail responses for 7 days, and DataLab visitor rows for 24 hours.
- The Apps in Toss client waits up to 45 seconds for the recommendation API. Timeout or API errors keep the user on the reward gate with `추천 다시 시도`; local demo data should not appear as the normal result after failure.

Server route smoke checks:

```powershell
cd C:\Users\ESOL\Documents\jbg
$env:PYTHONPATH='apps/server'
python -m unittest apps.server.backend.tests.test_wherego_recommendation
@'
from backend.app.interfaces.http.app import app
print(sorted(route.path for route in app.routes if 'wherego' in getattr(route, 'path', '')))
'@ | python -
```

Render smoke check after `jbg` deploy:

```powershell
$body = @{
  origin = @{ type='selected_region'; label='서울/수도권'; description='서울·경기·인천'; lat=37.5665; lng=126.978; areaCodes=@('1','31','2') }
  answers = @(
    @{ questionId='move_time_binary_01'; questionType='source'; question='오늘은 가볍게 갈까요, 멀리 제대로 갈까요?'; answer='가볍게 근교로'; caption='왕복 2시간 안쪽' },
    @{ questionId='party_companion_01'; questionType='source'; question='누구랑 가는 여행이에요?'; answer='아이와 가족끼리'; caption='안전한 동선' },
    @{ questionId='intent_landscape_01'; questionType='source'; question='오늘 끌리는 풍경은 어느 쪽이에요?'; answer='숲과 수목원'; caption='그늘과 산책' }
  )
  limit = 3
} | ConvertTo-Json -Depth 8
Invoke-RestMethod -Method Post -Uri 'https://jbg.onrender.com/api/wherego/recommend' -ContentType 'application/json' -Body $body -TimeoutSec 90
```

Expected: HTTP 200, `recommendedPlaces` has exactly one item, `source.planner` is `metadata`, and `source.curator` is `gemini` when the Gemini model env is valid. A recent successful smoke returned `서울어린이대공원` with an image URL. If `source.curator` returns `rules`, check `GEMINI_WHEREGO_MODEL` and the Gemini API key first. For the production app flow, call `/api/wherego/candidates` first and pass the returned `candidateSet` into `/api/wherego/recommend`; the direct `/recommend` smoke remains as a fallback-path check.

## Question Bank And API Probe

Validate script syntax:

```powershell
& 'C:\Users\ESOL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check scripts/probe-question-bank-result.cjs
```

Validate generated question-bank shape:

```powershell
& 'C:\Users\ESOL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' -e "const fs=require('fs'); const bank=JSON.parse(fs.readFileSync('data/general-question-bank.json','utf8')); const counts=bank.tagGroups.map(g=>g.questions.length); const sourceCounts=bank.tagGroups.map(g=>new Set(g.questions.flatMap(q=>q.options.map(o=>o.sourceId))).size); console.log(JSON.stringify({tagGroups:bank.tagGroups.length,total:counts.reduce((a,b)=>a+b,0),min:Math.min(...counts),max:Math.max(...counts),sourceOptionMin:Math.min(...sourceCounts),sourceOptionMax:Math.max(...sourceCounts),requiredTagGroups:bank.runtimeSelection.requiredTagGroups,oneOfTagGroups:bank.runtimeSelection.oneOfTagGroups}));"
```

Run the real KTO API probe with a stable date override:

```powershell
$env:WHEREGO_PROBE_TODAY='2026-07-09'
& 'C:\Users\ESOL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/probe-question-bank-result.cjs
Remove-Item Env:\WHEREGO_PROBE_TODAY
```

Optional origin override for the probe:

```powershell
$env:WHEREGO_CURRENT_LAT='37.5665'
$env:WHEREGO_CURRENT_LNG='126.978'
$env:WHEREGO_CURRENT_LABEL='서울시청 테스트 위치'
$env:WHEREGO_SEARCH_AREA_CODES='1,31,2'
```

Optional required-answer override for the probe:

```powershell
$env:WHEREGO_REQUIRED_MOVE_ID='move_city_01'
$env:WHEREGO_REQUIRED_MOVE_OPTION='D'
$env:WHEREGO_REQUIRED_PARTY_ID='party_companion_binary_01'
$env:WHEREGO_REQUIRED_PARTY_OPTION='B'
$env:WHEREGO_REQUIRED_INTENT_ID='intent_nature_city_binary_01'
$env:WHEREGO_REQUIRED_INTENT_OPTION='A'
```

## Question Flow Mockup

Open the current card-only question-flow mockup:

```text
public/mockups/question-flow/index.html
```

The mockup uses:

- current-location or selected-region origin choice
- custom direct-region button and taller region cards to avoid Korean text clipping
- required 3 source questions plus random 5 general questions
- random general questions always include `crowd` and one of `mobility`/`accessibility`
- two large cards for `select_2`, a 2x2 card grid for `select_4`
- selected cards show a 1s loading state before the next question or reward gate
- fixed bottom banner ad during questions
- rewarded-ad gate before the result card
- recommendation loading appears after the rewarded-ad CTA, while the mock rewarded-ad flow is running
- result card with tourism info, PNG card-download button, Naver Map open button, and home reset. The mock save flow downloads PNG only and does not open share.
- result screen hides the top `어디고 / 추천 완료` header
- live app requests the question set from `POST /api/wherego/questions` after origin selection; bundled question-bank fallback is used if the server is unavailable
- origin selection shows a question-set loading screen before the first question, keeps it for at least 2 seconds, and shows the banner ad during this loading screen
- banner ads remount on `question-set-loading` and each `question-${questionIndex}` screen
- option numbers are fixed circular badges so long Korean labels do not push or clip the number

## Copy Review

Use this JSON when another AI or a copy reviewer needs to inspect card wording without seeing credentials or implementation noise:

```text
docs/wherego-copy-review.json
```

It includes source-question cards, generated general-question cards, option label/caption previews, banned/risky expressions, and result-card Gemini copy constraints. Regenerate it after changing `data/source-question-blueprint.json`, `data/general-question-bank.json`, or result-card copy rules.


## Local Android Dev

`yarn dev` runs on Metro/Granite port `8081`. For wireless Android testing:

```powershell
adb connect <device-ip>:<adb-port>
adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW -d "intoss://wherego"
```

React Native `0.84.0` uses newer Flow/TS-style syntax that Granite `1.0.20`/Metro dev could not parse on Windows. Keep the Yarn patches for `@granite-js/mpack`, `metro-react-native-babel-transformer`, and `react-native`; they are required for local sandbox bundling. The verified local bundle URL is:

```text
http://127.0.0.1:8081/index.bundle?platform=android&dev=true&minify=false
```

Expected check: HTTP 200. If the phone screenshot is black, wake/unlock the device; this is not a bundle failure.

## Deployment

Vercel project link file:

```text
.vercel/project.json
```

Current Vercel project:

```text
joyai/wherego
```

Production alias:

```text
https://wherego-lake.vercel.app
```

Vercel scope:

```text
terms/privacy static pages only
```

Do not rely on Vercel for:

```text
Apps in Toss API server
Apps in Toss brand icon
Apps in Toss thumbnail
```

Submission URLs:

```text
https://wherego-lake.vercel.app/terms/service
https://wherego-lake.vercel.app/terms/privacy
```

Note: the first CLI deploy created the Vercel project and deployed production, but GitHub repository auto-link failed. Connect GitHub auto-deploy from Vercel settings or use manual CLI deploys.

## Save

When the user says "저장", follow `SAVE_PROTOCOL.md`.

Minimum checklist:

```powershell
git status --short
git diff --stat
& 'C:\Users\ESOL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/build-vercel-terms.cjs
& 'C:\Users\ESOL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check scripts/probe-question-bank-result.cjs
& 'C:\Users\ESOL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .yarn\releases\yarn-4.9.1.cjs typecheck
& 'C:\Users\ESOL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .yarn\releases\yarn-4.9.1.cjs build
git branch --show-current
git remote -v
git add AI_HANDOFF.md RUNBOOK.md docs/00_LLM_HANDOFF.md docs/10_선택지_질문풀_검토.md docs/wherego-copy-review.json data/source-question-blueprint.json data/general-question-bank.json data/travel-question-architecture.json scripts/build-general-question-bank.cjs pages/index.tsx src/api/wheregoApi.ts
git commit -m "Save wherego handoff state"
git push origin <branch>
```

Do not commit credentials, local caches, generated bundles, or `.vercel/output`.
