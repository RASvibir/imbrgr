# MediaPipe AR Asset Deployment Strategy

## Context & Problem Statement

The AR Camera tool (`/tools/ar`) relies on `@mediapipe/tasks-vision` for real-time, client-side face landmark detection and procedurally rendered AR face effects (burgers, condiments, halos, HUD).

To operate, the MediaPipe runtime requires two categories of static binary assets:
1. **WASM Binaries & JS Glue** (`public/mediapipe/wasm/`):
   - `vision_wasm_internal.js` (326 KB)
   - `vision_wasm_internal.wasm` (13 MB)
   - `vision_wasm_module_internal.js` (326 KB)
   - `vision_wasm_module_internal.wasm` (13 MB)
   - `vision_wasm_nosimd_internal.js` (326 KB)
   - `vision_wasm_nosimd_internal.wasm` (12 MB)
   - **Total**: ~39 MB uncompressed. These are packaged locally inside `node_modules/@mediapipe/tasks-vision/wasm/`.
2. **Face Landmarker Model** (`public/mediapipe/models/`):
   - `face_landmarker.task` (~3.6 MB)
   - Downloaded from Google's Cloud Storage bucket:
     `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`

### Why This Is Git-Ignored

Because these binaries total ~43 MB, `public/mediapipe/` is excluded from git tracking in `.gitignore`:
```gitignore
# mediapipe wasm & task models (downloaded via npm run ar:assets)
/public/mediapipe/
```

### The Deployment Challenge

In a fresh checkout, CI pipeline, or production deployment (e.g. Vercel, Docker, or bare metal), `npm install` alone only installs packages into `node_modules`.

If `npm run ar:assets` is not explicitly run prior to `next build`:
1. `/public/mediapipe/` remains empty or absent.
2. Production requests to `/mediapipe/wasm/...` and `/mediapipe/models/face_landmarker.task` return `HTTP 404 Not Found`.
3. The client application (`src/components/tools/ar/ArCameraClient.tsx`) will catch the local 404 and attempt an emergency runtime fallback to third-party public CDNs (`cdn.jsdelivr.net` and `storage.googleapis.com`).
4. If Content Security Policy (CSP) headers, privacy blockers, or air-gapped corporate firewalls are in effect, those fallback requests will be blocked, breaking the AR Camera entirely for users.

---

## Architectural Options & Trade-Offs

We have evaluated three operational architectures to address this:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Option A: Build-Time Local Sync (npm run ar:assets && next build)           │
│   [CI / Vercel Build] ──► Copies wasm from node_modules                      │
│                       ──► Downloads face_landmarker.task from GCS           │
│                       ──► Emits public/mediapipe/ inside Next.js bundle     │
│   Browser: Fetch /mediapipe/... (Same-Origin)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ Option B: Dedicated Static CDN / Object Storage                             │
│   [One-time or Release Deploy] ──► Upload assets to Vercel Blob / S3 / R2   │
│   Browser: Fetch https://assets.imbrgr.com/mediapipe/...                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Option C: Lazy Remote Load from Third-Party CDNs                            │
│   [No build step] ──► public/mediapipe/ omitted                             │
│   Browser: Fetch wasm from jsDelivr & model from storage.googleapis.com     │
│   Requires: Strict CSP exemptions in next.config.ts                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Option A: Build-Time Local Asset Sync (`npm run ar:assets && next build`)

In this approach, the build process explicitly runs `npm run ar:assets` before executing `next build`. This populates `public/mediapipe/` with the WASM files and model prior to Next.js packaging.

#### Mechanics
- CI / Build command is configured as:
  ```bash
  npm run ar:assets && npm run build
  ```
  *(or via an npm `prebuild` hook: `"prebuild": "node scripts/download-ar-assets.mjs"`)*.
- The script copies the 6 WASM files from `node_modules/@mediapipe/tasks-vision/wasm` and downloads `face_landmarker.task` from Google Cloud Storage into `public/mediapipe/models/`.
- Next.js serves all assets as same-origin static files from `/mediapipe/wasm/*` and `/mediapipe/models/*`.

#### Trade-Offs
- **Pros**:
  - **Zero Third-Party Runtime Dependencies**: All bytes are served from the same origin as the application (`/mediapipe/...`). If the app is up, the AR assets are up.
  - **Optimal Security & CSP Simplicity**: No external origins required in `connect-src` or `script-src`. Only standard same-origin and `'wasm-unsafe-eval'` directives are needed.
  - **Zero Code Changes**: Matches existing client implementation in `ArCameraClient.tsx` without needing new environment variables or base path rewrites.
  - **Privacy & Adblock Resilient**: Browser extensions (e.g. uBlock Origin) and privacy DNS resolvers do not block first-party static assets.
- **Cons**:
  - **Requires Build-Time Network**: The build environment (CI / Vercel runner) must have outbound HTTPS access to `storage.googleapis.com` to download the 3.6 MB model.
  - **Offline / Air-Gapped CI Failure**: In environments without internet access during build, `ar:assets` will fail unless the model is pre-cached or vendored into CI cache.
  - **Bundle Size**: Adds ~43 MB of static binaries into the deployment build artifact. While Next.js static files are served via CDN on hosts like Vercel, some serverless bundle size budgets might be affected if static directories are inadvertently bundled into server functions.

---

### Option B: Serve `public/mediapipe` from a CDN or Object Storage

In this approach, the MediaPipe WASM binaries and model files are hosted on an external object store or dedicated static asset CDN (such as Vercel Blob, Cloudflare R2, AWS S3, or a self-hosted CDN).

#### Mechanics
- Upload the 6 WASM files and `face_landmarker.task` to an object storage bucket (e.g., `https://media.imbrgr.com/mediapipe/` or Vercel Blob).
- Configure an environment variable in `.env` / Vercel:
  ```bash
  NEXT_PUBLIC_MEDIAPIPE_ASSET_BASE_URL=https://media.imbrgr.com/mediapipe
  ```
- Update `src/components/tools/ar/ArCameraClient.tsx` to read the base URL:
  ```ts
  const baseUrl = process.env.NEXT_PUBLIC_MEDIAPIPE_ASSET_BASE_URL || "/mediapipe";
  const fileset = await vision.FilesetResolver.forVisionTasks(`${baseUrl}/wasm`);
  // ...
  modelAssetPath: `${baseUrl}/models/face_landmarker.task`
  ```

#### Trade-Offs
- **Pros**:
  - **Zero Build-Time Network Access**: `next build` never needs to download model files or copy binaries during CI.
  - **Lean Application Artifact**: Keeps the Next.js deployment artifact small (no 43 MB overhead).
  - **Aggressive Edge Caching**: Assets can be served with immutable HTTP cache headers (`Cache-Control: public, max-age=31536000, immutable`).
  - **Independent Asset Lifecycle**: Upgrading or swapping the MediaPipe model does not require an application rebuild if URLs are versioned.
- **Cons**:
  - **Infrastructure Overhead**: Requires provisioning, configuring CORS, and maintaining an S3/Blob bucket and CDN domain.
  - **Code Modification**: Requires changing `ArCameraClient.tsx` and adding configuration plumbing.
  - **CSP Adjustment**: Requires adding the CDN origin to `connect-src` and `script-src` in CSP headers.

---

### Option C: Lazy Remote Load from Third-Party CDNs

In this approach, no local files are bundled or hosted. The browser client downloads all MediaPipe assets directly from public third-party CDNs on demand when the user visits `/tools/ar`.

#### Mechanics
- Omit `public/mediapipe/` entirely.
- The client resolves directly from:
  - WASM files: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/`
  - Model file: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`

#### Content Security Policy (CSP) & Header Requirements
If CSP headers are enabled (e.g., in `next.config.ts` or reverse proxy), the browser will block these third-party resources unless explicitly allowed. The following directives would be strictly required:

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net;
  connect-src 'self' https://cdn.jsdelivr.net https://storage.googleapis.com;
  worker-src 'self' blob:;
  child-src 'self' blob:;
```

#### Directive Breakdown:
| Directive | Allowed Hosts / Tokens | Reason |
| :--- | :--- | :--- |
| `script-src` | `'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net` | Needed to load `vision_wasm_internal.js` from jsDelivr and compile WebAssembly modules dynamically. |
| `connect-src` | `'self' https://cdn.jsdelivr.net https://storage.googleapis.com` | Needed to `fetch` the WebAssembly binary (`.wasm`) from jsDelivr and the `face_landmarker.task` model from Google Cloud Storage. |
| `worker-src` / `child-src` | `'self' blob:` | MediaPipe creates web workers via `blob:` URLs for background image processing and thread isolation. |

#### Trade-Offs
- **Pros**:
  - **Zero Setup**: No build steps, no scripts, no storage buckets to configure.
  - **Zero Hosting Bandwidth**: MediaPipe assets are served at Google's and jsDelivr's bandwidth cost.
- **Cons**:
  - **Security Degradation**: Opening `script-src` and `connect-src` to broad third-party CDNs weakens Content Security Policy.
  - **High Latency on First Visit**: Cold-loading ~16 MB over multiple external domains delays camera initialization by several seconds.
  - **Third-Party Availability Risk**: If jsDelivr has downtime or rate-limits traffic, or if Google changes or retires the task model URL, the AR tool breaks with no recourse.
  - **Adblock & Privacy Filter Failures**: Many browser extensions, VPNs, and corporate firewalls block `cdn.jsdelivr.net` or third-party storage buckets.

---

## Comparison Matrix

| Criteria | Option A: Build Step (`ar:assets`) | Option B: Dedicated Storage/CDN | Option C: Lazy Third-Party CDN |
| :--- | :--- | :--- | :--- |
| **Runtime Reliability** | **High (Same-origin)** | **High (Dedicated CDN)** | Low (Depends on jsDelivr/GCS) |
| **CSP Complexity** | Minimal (`'self' 'wasm-unsafe-eval'`) | Moderate (Requires bucket origin) | High (Requires jsDelivr + GCS) |
| **First Load Speed** | Fast (Same edge/origin) | Fast (Global CDN edge) | Slower (Multiple external handshakes) |
| **CI / Build Network Dependency** | **Yes** (Needs GCS access) | **No** | **No** |
| **Deploy Bundle Size Impact** | +43 MB | 0 MB | 0 MB |
| **Code Changes Needed** | None | Low (Asset URL config) | None (Fallback already exists) |
| **Maintenance Burden** | Low | Moderate (Storage admin) | Low (until third-party breaks) |

---

## Recommendation & Decision Status

### Status: **PENDING DECISION** (Awaiting review from Victor)

### Current Recommendation: **Option A (Short-Term) with Evolution to Option B (Long-Term)**

1. **Short-Term (Option A)**:
   - For current production and staging deployments, run `npm run ar:assets && npm run build` (or configure a `prebuild` script).
   - This provides immediate stability, guarantees same-origin delivery, keeps the application secure under strict CSP, and works seamlessly with the current codebase without risky refactoring.
   - **Caveat**: CI and build runners must have internet access to download `face_landmarker.task` from Google Cloud Storage, or the model must be cached between CI runs.

2. **Long-Term (Option B)**:
   - If deployment bundle size limits on serverless platforms become constrained, or if air-gapped CI builds are mandated, transition the assets to imbrgr's existing Vercel Blob storage or an S3/R2 bucket.

---

## Local Development & CI Verification Quick Reference

```bash
# Verify assets without writing (dry run)
node scripts/download-ar-assets.mjs --dry-run

# Show usage and configured asset paths
node scripts/download-ar-assets.mjs --help

# Sync assets (copies wasm and downloads model if missing)
npm run ar:assets

# Force re-download even if already present
node scripts/download-ar-assets.mjs --force
```
