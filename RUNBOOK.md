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

## Deployment

Vercel is not linked yet if this file does not exist:

```text
.vercel/project.json
```

After Vercel is linked and deployed, the submission URLs should be:

```text
https://<vercel-domain>/terms/service
https://<vercel-domain>/terms/privacy
```

## Save

When the user says "저장", follow `SAVE_PROTOCOL.md`.

Minimum checklist:

```powershell
git status --short
git diff --stat
& 'C:\Users\ESOL\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/build-vercel-terms.cjs
git branch --show-current
git remote -v
git add .
git commit -m "Save wherego handoff state"
git push origin <branch>
```

Do not commit credentials, local caches, generated bundles, or `.vercel/output`.
