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
| Database | Prisma 7 + **SQLite** file locally (`data/imbrgr.db`) |
| Storage | Local disk (`data/uploads`) or **Vercel Blob** (`STORAGE_DRIVER=blob`) |

### Production (Vercel)

Serverless deployments need a hosted database (SQLite files are not durable on Vercel). Recommended:

1. Create a **Neon** or **Vercel Postgres** database.
2. Change `provider` in `prisma/schema.prisma` to `postgresql` and use `@prisma/adapter-pg` in `src/lib/db.ts` (see [Prisma docs](https://www.prisma.io/docs)).
3. Set `DATABASE_URL` in Vercel env.
4. Set `STORAGE_DRIVER=blob` and `BLOB_READ_WRITE_TOKEN`.

## Environment variables

Copy `.env.example` to `.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | `file:./data/imbrgr.db` for local SQLite |
| `AUTH_SECRET` | Yes | Session signing (`openssl rand -base64 32`) |
| `STORAGE_DRIVER` | No | `local` (default) or `blob` |
| `BLOB_READ_WRITE_TOKEN` | If blob | Vercel Blob token |
| `NEXT_PUBLIC_SITE_URL` | No | Canonical URL for share links |
| `NEXT_PUBLIC_BLOB_BASE_URL` | If blob | Public blob base for media URLs |

Do not commit `.env` or secrets.

## Local setup

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed          # optional demo user + posts
npm run brand:assets     # favicons / OG from SVG
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
| `npm run db:push` | Apply Prisma schema |
| `npm run db:seed` | Seed demo data |
| `npm run brand:assets` | Export PNG/ICO brand assets |

## Deploy to Vercel

1. Import the GitHub repo in Vercel.
2. Set env vars (`AUTH_SECRET`, `DATABASE_URL`, blob storage as above).
3. Build command: `npm run build` (runs `prisma generate` via `postinstall`).
4. Run migrations/`db push` against production DB once.

## License

Proprietary — ChloReform Studios / Irie Pharm unless otherwise noted.
