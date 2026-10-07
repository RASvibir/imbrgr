# imbrgr

imbrgr.website — **images, served hot**. Community image and short-video hosting.

Built by **ChloReform Studios** (Irie Pharm · Victor Birkle). Visual identity: [BRANDING.md](./BRANDING.md).

> **Disclaimer:** imbrgr is not affiliated with, endorsed by, or connected to Imgur. This project does not use Imgur’s name, logos, trademarks, or visual identity.

## How it works

Plain-language mechanics for operators and contributors. End users see friendly labels in the app, not this section.

### Cook count

- **Cook count** on a post is the number of **unique viewers** (`Post.viewCount`), not page reloads.
- Each viewer is keyed by **`voterKey`**: signed-in users use a stable user-based key; guests use the **`imbrgr_vid`** cookie (`a:…` prefix).
- The **post owner** (and anonymous owners via matching `voterKey` on media) **do not** increment cook count when they view their own post.
- First visit from a key creates a `PostView` row and increments cook count; later visits from the same key update `hitCount` but do **not** increment cook count again.
- View recording is **rate-limited** per post and voter (see `recordPostView` in `src/lib/post-views.ts`): excess requests within the window are ignored without error.

### Cheese pull and kitchen heat (spice)

- **`spiceScore`** is kitchen-themed engagement heat on a post (separate from the unique cook counter).
- On each counted view event, spice may increase by **`spiceDeltaForView`**: **+1** for a guest’s first unique cook, **+1** on **repeat** visits from the same key, **+0** on a signed-in user’s **first** unique cook (repeat signed-in visits still add +1).
- The UI maps spice to **cheese pull** / **kitchen heat** labels and meters (`src/lib/cheese-spice.ts`); levels are derived from score bands, not separate counters.
- Spice updates run in the same pipeline as views and refresh **`hotScore`** on the post.

### Hot ranking

- The **`/hot`** feed sorts public, non–admin-hidden posts by **`hotScore`** (desc), then `createdAt`.
- **`hotScore`** is recomputed when views/spice change:

  `engagement = viewCount × 3 + spiceScore × 2 + 1`  
  `ageHours = max(0.25, hours since createdAt)`  
  `hotScore = engagement / (ageHours + 2)^1.35`

  (see `src/lib/hot-score.ts`).

- Gallery **“Most viral”** uses a separate Reddit-style **`hotScore`** on votes (`src/lib/ranking.ts`), not the Hot page formula.

### Visibility

| Level | Meaning | Typical surfacing |
|--------|---------|-------------------|
| **PUBLIC** | Listed for everyone | Home/Hot feeds (if not hidden), search, tags, public profiles |
| **UNLISTED** | Link-only | Direct `/p` / `/i` URLs; not promoted in public feeds/search |
| **PRIVATE** | Owner-only | Hidden from others; file route returns 404 to non-owners |
| **Admin-hidden** (`hiddenByAdmin`) | Moderation hold | Treated like hidden from the public; owners may still see their post depending on route |

Uploads and studio creations default to **public** on the gallery (Home / Hot). Signed-in users can choose **unlisted** or **private** before or after upload; their **default post visibility** in settings applies when they do not pick one (migration `20261007200000_default_post_visibility_public` sets existing `UNLISTED` defaults to **PUBLIC**; users who chose **PRIVATE** are unchanged). **Guests** are always **public** (server-enforced); private and unlisted controls are hidden until they sign in.

### Thumbnails

- WebP **sm/md** thumbs are generated with **sharp** (`src/lib/thumbnails.ts`) and stored via **`putObject`** (local disk or **Vercel Blob** when `STORAGE_DRIVER=blob`).
- Feeds call **`warmFeedThumbnails`** after the response (`after()` from `next/server`) to generate missing thumbs for a capped number of cards—best-effort, deduped per media id.
- **Privacy:** thumbs are served only through **`/api/media/file/*`** with the same access checks as originals; going private or admin-hidden **purges** thumb blobs and clears thumb columns; deletes remove **storageKey** and both thumb keys.
- **Cache:** private/hidden media uses `Cache-Control: private, no-store`; other gated gallery media avoids long `immutable` public cache (see `src/lib/serve-media-file.ts`).

### Studio library, locked original, and folders

- **Click-to-save:** In the studio, click the preview image for **Save**, **Save to folder…**, **Download**, or **Revert to original** (keyboard-friendly menu; Esc closes).
- **Click menu (always):** **Save**, **Save to folder…**, and **Download** work on **any** version (original, edits, generated, uploaded) regardless of the keep-original toggle.
- **Keep original (toggle):** Controls **automatic** copies in the user’s **My images** library cache only (default **on**). **On:** auto-save keeps the **locked first version** plus new edits (`LibrarySave` rows with label `__studio_auto__`). **Off:** auto-save tracks **only the latest** version in that family (no duplicate original in the auto cache). **Manual** saves from the image menu always work for whichever version is on screen. Preference: `User.studioKeepOriginal` or guest `localStorage` (`imbrgr_studio_keep_original`). Sync runs after AI generate, studio import, and versioned edits (`src/lib/library-auto-save.ts`).
- **Locked original (editing):** The first file in each studio chain stays an **immutable** row (`Media.rootMediaId`); manual and AI edits always create **new** versions; **Revert to original** uses the version strip. This is separate from the auto-library toggle above.
- **Versions strip:** Thumbnails for all versions in the family; the original shows a lock badge.
- **Library saves:** `POST /api/library/save` records the **current** media version in `LibrarySave` (signed-in `userId` or guest `voterKey`). Visibility on save respects the studio visibility control (AI gens default public unless the user chose otherwise).
- **Folders:** `LibraryFolder` per owner; create/rename/delete via `/api/library/folders`. Saves can target a folder by id or **new folder name** from the studio menu.
- **My images:** `/library` and the **My images** tab on your own profile list folders and saves (`GET /api/library`). Guest library rows are **claimed** on sign-in with posts/media (`claim-guest.ts`).

### Remix, collections, guests, reports

- **Remix** creates a new post linked to `remixedFromPostId` from a **public** source post; studio can open with `?remixFrom=`.
- **Collections** group posts with their own visibility; collection pages filter member posts by access rules.
- **Guests** upload with `voterKey` and optional **delete tokens**; on sign-in, **`POST /api/auth/claim-guest`** reassigns guest posts/media to the new user when the cookie matches.
- **Reports** (`POST /api/reports`) accept targets POST, MEDIA, COLLECTION, USER with resolved canonical ids; admins triage in the console.

### Account deletion

- **`POST /api/me/delete`** (signed in) accepts `{ deleteAllPosts?: boolean }` and runs `deleteUserAccount` in `src/lib/account-delete.ts`.
- **Default:** **public** posts and their media/files **stay** on the gallery; `Post.userId` and `Media.userId` are cleared so the UI shows **Deleted user**. Guest uploads without an account still show as **anonymous** when media keeps a `voterKey`.
- **Optional:** settings checkbox **“Also remove my posts”** (`deleteAllPosts: true`) removes every post from feeds and post pages (404) while **archiving** snapshots in `ArchivedPost` / `ArchivedMedia` (reason `account_deleted_by_user`, owner email/username, JSON row snapshots, archived blob keys under `archive/` — not served via `/api/media/file/*`).
- **Unlisted/private** posts removed on any account delete use the same **archive** path (not hard-deleted from Postgres or object storage).
- Library folders/saves, collections, favorites, sessions, and profile avatar/banner are removed with the user row (`Post.user` FK is **ON DELETE SET NULL** in Postgres).
- Comments and votes keep live rows with `userId` nulled; comment authors show as Deleted user.
- Deleted usernames return **404** on `/u/<username>`. Super-admins browse archives read-only under `/admin` → **Archive**; ownerless live posts can still be **Remove**d from Content (report flow unchanged).

### AI pipeline (studio)

1. **Prompt enhance** (optional checkbox): cache lookup → **Ollama** → **Groq** → **Gemini** for complex prompts (`src/lib/ai/prompt-enhance.ts`); skipped for very short prompts.
2. **Image generation:** **Pollinations** Flux (`gen.pollinations.ai`); optional **`POLLINATIONS_API_KEY`**; mock path when **`AI_MOCK=true`** (E2E).
3. **Blocked prompts:** `src/lib/prompt-safety.ts` rejects disallowed patterns before generate/edit.
4. **Daily allowance:** per-user count in `AiGenerationUsage` (limit **`AI_DAILY_LIMIT`** or per-user override); guests use **`AiAnonymousUsage`** keyed by IP hash with **`ANON_AI_DAILY_LIMIT`** / admin site setting.
5. **Assist:** natural-language image edits (Gemini image route) and quick chips; preview before keep.
6. Hourly caps also apply via **`UPLOAD_RATE_LIMIT_PER_HOUR`** and **`AI_RATE_LIMIT_PER_HOUR`**.

### Admin console

- Super-admins (`SUPERADMIN` role + **`SUPERADMIN_USERNAMES`**) get **`/admin`**: dashboard stats, user/post/media moderation, reports, site settings (e.g. guest AI limit), thumbnail backfill batches, audit log.

### Environment variables (names only)

See the table below for descriptions. Never commit values. Common names: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`, `STORAGE_DRIVER`, `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_SITE_URL`, `USER_STORAGE_QUOTA_BYTES`, `ANON_STORAGE_QUOTA_BYTES`, `AI_DAILY_LIMIT`, `ANON_AI_DAILY_LIMIT`, `POLLINATIONS_API_KEY`, `OLLAMA_HOST`, `OLLAMA_MODEL`, `OLLAMA_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_IMAGE_MODEL`, `UPLOAD_RATE_LIMIT_PER_HOUR`, `AI_RATE_LIMIT_PER_HOUR`, `SUPERADMIN_USERNAMES`, `AI_MOCK`, `AI_ENHANCE_TIMEOUT_MS`.

## Features

- Multi-file upload (drag-and-drop, file picker, clipboard paste, URL fetch) — JPG, PNG, GIF, WebP, MP4, WebM with size limits
- Posts with title, description, tags; short `/p/{id}` links, direct `/i/{id}` pages, embed HTML
- Gallery feeds: viral (hot score), newest, top — infinite scroll
- Tag index and per-tag feeds
- Post page: votes, favorites, views, threaded comments, share/embed panel
- Accounts (self-serve sign-up), editable **settings** (username, display name, avatar/banner with crop, bio, links, public/private favorites, storage meter, account delete)
- Public profiles (`/u/{username}`): posts, favorites (if public), comments, stats
- **Storage quotas** per user (default 1 GB, `USER_STORAGE_QUOTA_BYTES`) and smaller anonymous cap; server-enforced on every upload
- In-browser **image editor** on upload, studio Refine, settings avatar/banner, and your own images: crop, rotate, looks (filters), **Adjust** sliders (brightness, contrast, saturation, exposure, warmth) with live preview and per-slider reset, **Touch up** (auto-enhance, vignette, sharpen, soft blur, spot fix, smooth brush), **Draw** (ember palette + custom color, brush size, eraser), undo/redo, save as new version or replace
- **Image studio** (`/studio`): import (upload / paste / URL), convert (PNG/JPEG/WebP/AVIF + resize), manual editor, AI Flux generation, Gemini natural-language edits, share/embed links
- Prompt enhance: Ollama Cloud → Groq; Gemini only for complex prompts or fallback; cached repeats in Postgres (`AiPromptCache`)
- Anonymous uploads are **always public** on the gallery; sign in to use unlisted or private. Owners can delete posts and report content
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
| `USER_STORAGE_QUOTA_BYTES` | No | Per-account storage cap (default 1 GiB) |
| `ANON_STORAGE_QUOTA_BYTES` | No | Guest upload cap (default 50 MiB) |
| `AI_DAILY_LIMIT` | No | AI generations per user per UTC day (default 20) |
| `OLLAMA_HOST`, `OLLAMA_MODEL`, `OLLAMA_API_KEY` | No | First tier for prompt enhance |
| `GROQ_API_KEY` | No | Second tier (Llama 3.3) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | No | Gemini for complex prompt enhance + image edits |
| `GEMINI_IMAGE_MODEL` | No | Gemini model for natural-language image edits (studio) |
| `POLLINATIONS_API_KEY` | No | Optional key for `gen.pollinations.ai` Flux renders |
| `ANON_AI_DAILY_LIMIT` | No | Guest AI generations per UTC day (default 5) |
| `UPLOAD_RATE_LIMIT_PER_HOUR` | No | Per-IP/user upload throttle (default 60) |
| `AI_RATE_LIMIT_PER_HOUR` | No | Per-IP/user AI throttle (default 30) |
| `SUPERADMIN_USERNAMES` | No | Comma-separated usernames allowed as super admin (default `vibir`; must also have `SUPERADMIN` role in DB) |

### E2E (Playwright)

Global setup seeds users via `tsx scripts/e2e-seed.ts` (avoids loading the Prisma ESM client from Playwright’s CJS global-setup).

```bash
docker compose up -d   # or local Postgres
npm run db:migrate:deploy
export DATABASE_URL=postgresql://imbrgr:imbrgr@localhost:5432/imbrgr?schema=public
npm run build
STORAGE_DRIVER=local AI_MOCK=true npm run test:e2e
npm run test:e2e:artifacts   # optional screenshots → /opt/cursor/artifacts
```

### Private images & Vercel Blob

On Vercel set **`STORAGE_DRIVER=blob`** and **`BLOB_READ_WRITE_TOKEN`** (required for uploads and for `/api/media/file/*` streaming). Without them, production defaults to local disk and files 404.

Image bytes are served at **`/api/media/file/<storageKey>`** (e.g. `/api/media/file/uuid.jpg?mime=image%2Fjpeg`). JSON metadata stays at **`/api/media/<shortId>`**.

Production uses a **public** Blob store (`imbrgr13-media`). Private files are never listed in feeds/search and the file route returns **404** to non-owners, with `Cache-Control: private, no-store`. Direct Blob CDN URLs are not exposed in the UI; however, anyone who obtained a raw Blob URL could still fetch the object. For stricter isolation, use a private Blob store or proxy-only delivery and rotate storage keys when visibility changes from public to private.

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
| `npm run test` | Vitest (ranking, validation, storage quota, AI usage & prompt failover) |
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
