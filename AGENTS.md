# rpanel

A central panel where Users and their Agents track parallel Projects and answer Decisions. See `GLOSSARY.md` for the domain language, `docs/adr/` for decisions, and `docs/specs/` for specs. Work is tracked in GitHub Issues (specs #1 to #5, tickets #6 and up).

All dependencies and services must be free and open source. The panel must never store or receive an Agent's LLM credentials.

## Layout

- `apps/api`: the HTTP API (TypeScript, Hono, built-in `node:sqlite`).
- `apps/web`: the browser app (TypeScript, Vite, React).
- `packages/shared`: types shared between apps. Build it before the apps use it.
- `deploy/nginx`: the nginx image and config. nginx is the only public service; it serves the built web app and proxies `/api/` to the API.
- `compose.yaml`: the whole stack. The API listens on the Docker network only.
- `tests/stack`: tests that treat the running stack as an outside client.
- `tests/e2e`: Playwright browser tests.
- `scripts`: helper scripts, such as the fresh-stack browser test runner.

## Commands

- Install: `npm install`, then once `npx playwright install --with-deps chromium` for browser tests
- Start the whole stack: `docker compose up -d --build --wait` (serves on port 80, or `RPANEL_PORT`)
- Stop it: `docker compose down` (data lives in the `rpanel-data` volume)
- Do not leave the stack running on a public address before HTTPS exists: the first visitor to a fresh panel creates the Admin account.
- Typecheck everything: `npm run typecheck`
- API tests (throwaway database, no stack needed): `npm test`
- Stack tests (need the stack running): `npm run test:stack`
- Browser tests: `npm run test:e2e`. It starts its own fresh, throwaway stack (empty database, port 8081) and removes it afterwards, so no stack needs to be running.
- Point the stack tests at another address with `RPANEL_URL`.

## How to work

Build test-first at the agreed seams: the HTTP API, plus Playwright flows for what a User does in the browser. Write a failing test, make it pass, repeat. Assert only observable behavior.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
