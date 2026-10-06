# imbrgr

**images, served hot** — community image and short-video hosting for [imbrgr.website](https://imbrgr.website).

Built by **ChloReform Studios** (Irie Pharm · Victor Birkle). Brand system and ember palette are documented in [BRANDING.md](./BRANDING.md).

> **Disclaimer:** imbrgr is not affiliated with, endorsed by, or connected to Imgur. This project does not use Imgur’s name, logos, trademarks, or visual identity.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- Postgres (production) · local-friendly storage patterns (in progress)
- Deploy target: [Vercel](https://vercel.com)

## Getting started

```bash
npm install
npm run brand:assets   # regenerate favicons / OG image from SVG sources
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
| `npm run brand:assets` | Export PNG/ICO brand assets from `public/*.svg` |

## Environment

Copy `.env.example` when present and set variables for database, auth, and blob storage. Do not commit secrets.

## License

Proprietary — ChloReform Studios / Irie Pharm unless otherwise noted.
