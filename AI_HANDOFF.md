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
- Public Data Portal credentials and KTO endpoints are stored locally in `.env.local`; do not commit that file.
- TMAP congestion API is not part of the MVP because of cost.
- AI role: generate/word travel persona and recommendation copy. Do not put AI API keys in the client.
- Apps in Toss direction: Granite/TDS style should be used for the actual app implementation.

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

## Current Blockers And Risks

- Vercel project is not linked yet: `.vercel/project.json` is absent.
- There is no public terms URL until Vercel is connected and deployed.
- Future app implementation still needs Granite project scaffolding or reuse of the `toss_tomato` structure.
- API keys for 한국관광공사 and AI services must stay out of client code and Git. `.env.local` is intentionally ignored.

## Operating Rules

- For context efficiency, read `docs/README.md` first, then follow the listed current docs. Do not start from archive-style or generated output scans.
- When the user says "저장", follow `SAVE_PROTOCOL.md`: refresh handoff/runbook state, verify narrowly, commit, and push unless explicitly told not to.
- Keep generated build outputs out of Git.
- Keep `.env`, API keys, `.ait`, `.vercel/`, `node_modules/`, and `dist/` out of Git.
- Before finalizing asset or app UI work, visually inspect generated assets or screens.

## Next Recommended Steps

1. Link or create a Vercel project for the terms pages.
2. Confirm the deployed `/terms/service` and `/terms/privacy` URLs.
3. Scaffold the actual Apps in Toss/Granite app using the `toss_tomato` structure as the closest local reference.
4. Implement 한국관광공사 API and AI calls server-side, loading `PUBLIC_DATA_PORTAL_SERVICE_KEY` and endpoint URLs from environment variables.
