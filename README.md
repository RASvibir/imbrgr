# imbrgr

imbrgr.website — **images, served hot**. Community image and short-video hosting.

Built by **ChloReform Studios** (Irie Pharm · Victor Birkle). Visual identity: [BRANDING.md](./BRANDING.md).

> **Disclaimer:** imbrgr is not affiliated with, endorsed by, or connected to Imgur. This project does not use Imgur’s name, logos, trademarks, or visual identity.

## Features

- Multi-file upload (drag-and-drop, file picker, clipboard paste, URL fetch) — JPG, PNG, GIF, WebP, MP4, WebM with size limits
- Posts with title, description, tags; short `/p/{id}` links, direct `/i/{id}` pages, embed HTML
- Gallery feeds: viral (hot score), newest, top — infinite scroll
- Tag index and per-tag feeds
- Post page: votes, favorites, views, threaded comments, share/embed panel
- Accounts (email/username + password), profiles (`/u/{username}`) with posts, favorites, comments
- Anonymous uploads default to **unlisted**; owners can set public / unlisted / hidden, delete posts, report content
- Search across titles and tags
- Ember burger brand system, light/dark themes, responsive layout

## Stack

| Layer | Technology |
|--------|------------|
| App | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 |
| Auth | Auth.js (next-auth) credentials + JWT sessions |
| Database | **Prisma 7** + **PostgreSQL** ([Neon](https://neon.tech) in production) |
| Neon config | `@neon/config` + root [`neon.ts`](./neon.ts) (owner runs `neon link` / `neon deploy` on their machine) |
| Storage | Local disk (`data/uploads`) or **Vercel Blob** (`STORAGE_DRIVER=blob`) |

## Environment variables

Copy `.env.example` to `.env`, or after linking Neon run `neon env pull` (never commit `.env`).

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | **Pooled** Postgres URL — app runtime (`@prisma/adapter-pg`) |
| `DATABASE_URL_UNPOOLED` | Yes for migrations | **Direct** URL — Prisma `migrate` / `db execute` |
| `NEON_BRANCH` | No | Branch name from Neon CLI (informational) |
| `AUTH_SECRET` | Yes | Session signing (`openssl rand -base64 32`) |
| `STORAGE_DRIVER` | No | `local` (default) or `blob` |
| `BLOB_READ_WRITE_TOKEN` | If blob | Vercel Blob token |
| `NEXT_PUBLIC_SITE_URL` | No | Canonical URL for share links |

Do not commit `.env`, `.neon`, or connection strings.

## Local database (Docker)

```bash
docker compose up -d
cp .env.example .env
# DATABASE_URL and DATABASE_URL_UNPOOLED can be the same local URL
npm run db:migrate:deploy
npm run db:seed
```

## Neon (production)

On a machine with the Neon CLI linked to project `purple-sea-37945850` (branch `production`):

```bash
neon env pull   # writes DATABASE_URL + DATABASE_URL_UNPOOLED (+ NEON_BRANCH) to .env
```

Apply migrations against the **unpooled** URL (Prisma config reads `DATABASE_URL_UNPOOLED` automatically):

```bash
export $(grep -v '^#' .env | xargs)   # or use dotenv
npm run db:migrate:deploy
```

For a new migration during development:

```bash
npm run db:migrate
```

Deploy app env to Vercel with at least `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (for build-time migrate if you run it in CI).

## Local setup

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:migrate:deploy
npm run db:seed
npm run brand:assets
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Demo login:** `demo@imbrgr.website` / `password123` (after seed).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (ranking, validation) |
| `npm run db:migrate` | Create/apply migrations in dev (`migrate dev`) |
| `npm run db:migrate:deploy` | Apply migrations (`migrate deploy`) — use on Neon/production |
| `npm run db:seed` | Seed demo data |
| `npm run brand:assets` | Export PNG/ICO brand assets |

## Deploy to Vercel

1. Import the GitHub repo.
2. Set `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`, and blob vars as needed.
3. Run `npm run db:migrate:deploy` against production (CI step or once manually).
4. `npm run build` (runs `prisma generate` via `postinstall`).

## License

Proprietary — ChloReform Studios / Irie Pharm unless otherwise noted.
