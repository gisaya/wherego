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

## Question Bank And API Probe

Validate script syntax:

```powershell
& 'C:\Users\ESOL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check scripts/probe-question-bank-result.cjs
```

Validate generated question-bank shape:

```powershell
& 'C:\Users\ESOL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' -e "const fs=require('fs'); const bank=JSON.parse(fs.readFileSync('data/general-question-bank.json','utf8')); const counts=bank.tagGroups.map(g=>g.questions.length); console.log(JSON.stringify({tagGroups:bank.tagGroups.length,total:counts.reduce((a,b)=>a+b,0),min:Math.min(...counts),max:Math.max(...counts)}));"
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
git branch --show-current
git remote -v
git add .
git commit -m "Save wherego handoff state"
git push origin <branch>
```

Do not commit credentials, local caches, generated bundles, or `.vercel/output`.
