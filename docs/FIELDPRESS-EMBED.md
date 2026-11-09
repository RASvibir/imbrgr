# FieldPress embed & Share with FieldPress

## FieldPress → imbrgr

```
https://imbrgr.website/studio?tab=generate&embed=1&from=fieldpress&draft=<id>&prompt=<text>
```

- `embed=1` — hide site header/footer/mobile nav; CSP `frame-ancestors` allows FieldPress origins.
- `from=fieldpress` + `draft` — session return context for **Share with FieldPress**.
- Without `embed`, same params open full studio (FieldPress **Full studio** link).

## imbrgr → FieldPress

1. **Navigation** (top-level): `https://fieldpress.studio/?compose=1&image=<https-direct-file>&draft=<id>&title=…`
2. **postMessage** (iframe): `{ type: "imbrgr:compose-image", imageUrl, draftId, title }` to `https://fieldpress.studio` origin.

UI label: **Share with FieldPress** (`UseInFieldPressDraftLink` / invite).

Image URLs must be HTTPS direct file URLs (`/api/media/file/...`), not metadata JSON routes.
