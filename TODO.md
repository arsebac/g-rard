# Post-merge TODO

## Recurring tasks — required steps after merging

### 1. Run the Prisma migration [DONE]

(Already applied to the database during the merge process)

### 2. Rebuild the Docker image

```bash
docker-compose build
docker-compose up -d
```

### 3. Smoke test

- Open a project → **Recurring** tab
- Create a template (EVERY_N_WEEKS, 2 weeks) → check tasks appear in Board/List view with the ↻ icon
- Create a CUSTOM_DATES template → add 3 dates → check 3 tasks created
- Click **Update schedule** (↺) on a CUSTOM_DATES template → supply new dates → check old pending tasks gone, new ones created
- Open a generated task drawer → confirm **Recurring** badge is shown
- Test via MCP: `regenerate_recurring_task` with `customDates: ["2026-09-01", ...]`
