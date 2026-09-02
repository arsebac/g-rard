---
name: deploy
description: Build and deploy g-rard locally on the Pi (no CI, no registry), with a machine-wide lock against concurrent builds
---

# Deploy g-rard (local build)

`g-rard` is built and deployed directly on the Pi — no GitHub Actions, no
`ghcr.io` round trip. This calls Clauditor's shared local-deploy script,
which serializes with any other local build happening on this machine (the
Pi can't run two native compiles at once without risking OOM).

## Execute the deployment

```bash
/home/duck/projets/clauditor/scripts/local-deploy.sh /home/duck/projets/g-rard http://gerard.local/api/health
```

This will:
1. Wait for the machine-wide build lock (shared with every other local-build project)
2. `docker compose build --no-cache` (npm workspaces: server + client + mcp, Prisma generate included)
3. `docker compose up -d --force-recreate`
4. Verify `http://gerard.local/api/health` responds 200

## Usage

Simply type:
```
/deploy
```
