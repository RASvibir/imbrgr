# imbrgr brand guidelines

**Owner:** Irie Pharm (Victor Birkle) · ChloReform Studios  
**Product:** imbrgr — community image and short-video hosting (`imbrgr.website`)  
**Tagline:** *images, served hot* (alternate: *the internet's visual snack*)

imbrgr keeps the warm **ember** palette (charcoal, glowing orange/amber, rose-magenta accents). The name is a playful sound-alike of “image” / “img” culture — a parody-level wink at how the web shares pictures, **not** a visual copy of any other host.

---

## Logo system

### Mark (tech burger)

The icon is a **stylized burger** with a geeky filling:

1. **Buns (amber → ember gradient)** — friendly, snack-sized energy; reads as a bold stacked silhouette at 16px (`icon-favicon.svg`).
2. **Patty** — dark ember “char” layer; the heat under the hood.
3. **Middle stack (the tech twist)** — a **photo frame** band with **pixel tiles**, a tiny **upload arrow**, and **circuit traces** — “images, served hot” as a literal stack you consume and share.

The joke is in the **name pun and attitude** (imbrgr ≈ img-burger), not in copying another product’s mascot or colors.

### Wordmark

Lowercase **imbrgr**:

- **imbr** — ember gradient (orange → amber)
- **gr** — rose → magenta gradient

### Files

| Asset | Path | Use |
|--------|------|-----|
| Icon (detail SVG) | `public/icon.svg` | UI, PWA sources |
| Icon (favicon SVG) | `public/icon-favicon.svg` | 16 / 32 / `.ico` |
| Full horizontal logo | `public/logo.svg` | Marketing |
| Wordmark only | `public/wordmark.svg` | Narrow headers |
| Favicon ICO | `public/favicon.ico` | Browser tab |
| Apple touch | `public/apple-touch-icon.png` | 180×180 |
| PWA | `public/icon-192.png`, `public/icon-512.png` | Manifest |
| Open Graph | `public/og-image.png` | 1200×630 share card |
| React components | `src/components/brand/` | In-app header |

Regenerate raster assets after SVG edits:

```bash
npm run brand:assets
```

---

## Parody intent

- **OK:** Snarky copy, burger metaphor, “img” wordplay, familiar *features* of image hosts (galleries, votes, comments).
- **Not OK:** Copying another product’s logotype, mascot, palette, or implying partnership.

When in doubt, keep the humor in **language**, keep the visuals **ember + burger + pixels**.

---

## Color palette

Designed for **WCAG 2.1 AA** body text on surfaces.

### Core swatches

| Name | Hex | Role |
|------|-----|------|
| Charcoal deep | `#141210` | Dark background base |
| Charcoal | `#1c1816` | Raised surfaces (dark) |
| Warm white | `#f5ebe3` | Primary text (dark mode) |
| Warm paper | `#faf7f4` | Light mode background |
| Ink | `#1c1412` | Primary text (light mode) |
| Muted warm | `#c4b5a8` | Secondary text (dark) |
| Ember deep | `#ea580c` | Gradient stops, patty glow |
| Ember | `#f97316` | Primary accent (dark UI) |
| Amber | `#fbbf24` | Buns, highlights |
| Rose | `#f43f5e` | Secondary accent |
| Magenta | `#db2777` | Wordmark “gr”, upload spark |

**Avoid:** Generic “host site” green (`#1bb76e`) and navy-teal stacks that read as borrowed branding.

### CSS tokens

Semantic tokens in `src/app/globals.css` (`--surface-*`, `--text-*`, `--accent-*`, `--ring`). Themes via `data-theme` and `imbrgr-theme` in `localStorage`.

---

## Usage rules

1. **Clear space:** At least one bun-height around the mark.
2. **Minimum size:** Favicon uses `icon-favicon.svg`; in UI prefer 24px+ for the detailed burger.
3. **Don’t** separate buns from the pixel layer in marketing lockups.
4. **Do** pair the mark with the tagline on hero/OG surfaces when space allows.

---

## Voice (short)

Playful, warm, slightly snarky — “served hot”, “visual snack”, “upload the stack”. Always independent: **ChloReform Studios / Irie Pharm**.
