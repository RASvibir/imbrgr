# Testing and CI notes

Hard-won gotchas for running the checks locally and in CI. Everything here has been hit and verified.

## The checks

CI (`.github/workflows/ci.yml`, required check `verify` on `main`) runs, in order: typecheck, lint, vitest,
`npm run ar:assets`, `next build`, `prisma migrate deploy`, Playwright. Run the same sequence locally before opening a PR.
`ar:assets` mirrors the production `buildCommand` in `vercel.json`, so a broken AR download fails the PR, not the deploy.

## Playwright environment

- **Build before you run.** Playwright's `webServer` runs `npm run start`, which serves the *last* `next build`.
  Stale build means stale behavior.
- **Set `DATABASE_URL`**, e.g. `postgresql://imbrgr:imbrgr@localhost:5432/imbrgr?schema=public`. Without it,
  `e2e/global-setup.ts` skips seeding and the signed-in and admin specs fail.
- **Migrate before the run.** Playwright starts the `webServer` *before* `globalSetup`, and the home page queries the
  database, so on a fresh DB the server returns 500s until the readiness check times out. CI runs
  `npx prisma migrate deploy` as its own step for this reason.
- **Port 3000 must be free.** Playwright reuses whatever is already listening, including a stray `next-server`
  (its process name is not `next start`, so `pkill -f "next start"` misses it). Check
  `lsof -iTCP:3000 -sTCP:LISTEN` is empty before every run; kill by port, not by broad process name.
- **`SiteSetting.anonAiDailyLimit` in the DB overrides `ANON_AI_DAILY_LIMIT`** (`usage.ts`: `settings.anonAiDailyLimit ?? env`).
  `scripts/e2e-seed.ts` sets it to 10000; without that only the first few guest generations per run pass.
- **Strict mode and duplicated test ids.** The home page renders the ember mark twice (desktop dropzone, mobile card;
  one is always hidden). Use `getByTestId("ember-hero-mark").locator("visible=true")`, not a bare locator.
- **Turbopack builds fail if `node_modules` is a symlink** out of the project. For a throwaway baseline copy
  (`git archive <sha> | tar -x -C /tmp/x`), copy `node_modules`, the untracked `src/generated` Prisma client and
  `.env.local` with `cp -Rc`.
- The full suite takes about a minute locally and about three minutes in CI. Start long runs in the background and poll.

## Guest identity cookie (`imbrgr_vid`)

Guests are identified by a random `imbrgr_vid` cookie minted lazily by `getVoterKey()`.

**Read-only GET routes must call `getActor(req, { persist: false })`** (or `getVoterKey({ persist: false })`).
On a first visit the home page fires many concurrent GETs; if each minted its own cookie, the last `Set-Cookie`
won and could orphan whatever the visitor had just created (the studio showed its empty state). Only routes that
write on the visitor's behalf should mint. `e2e/identity-cookies.spec.ts` guards the read-only routes; add any new
read-only API route to its list.

## Mobile and touch

Hover-only affordances are invisible or unreachable on touch. Interactive controls need a 44x44 CSS px hit area
(a transparent button around a smaller visual is fine) and must be visible under `@media (hover: none)`.
`e2e/library-touch-targets.spec.ts` shows the pattern (`hasTouch: true, isMobile: true`).
