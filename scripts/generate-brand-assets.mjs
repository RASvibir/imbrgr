import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const root = path.resolve(import.meta.dirname, "..");
const publicDir = path.join(root, "public");
const artifactsDir = "/opt/cursor/artifacts";

const iconSvg = await fs.readFile(path.join(publicDir, "icon.svg"));
const iconFaviconSvg = await fs.readFile(path.join(publicDir, "icon-favicon.svg"));
const logoSvg = await fs.readFile(path.join(publicDir, "logo.svg"));
const ogSvg = await fs.readFile(path.join(publicDir, "og-image.svg"));

async function pngFromSvg(svg, size, outPath) {
  await sharp(svg).resize(size, size).png().toFile(outPath);
}

await pngFromSvg(iconFaviconSvg, 16, path.join(publicDir, "favicon-16.png"));
await pngFromSvg(iconFaviconSvg, 32, path.join(publicDir, "favicon-32.png"));
await pngFromSvg(iconSvg, 180, path.join(publicDir, "apple-touch-icon.png"));
await pngFromSvg(iconSvg, 192, path.join(publicDir, "icon-192.png"));
await pngFromSvg(iconSvg, 512, path.join(publicDir, "icon-512.png"));

const favicon16 = await fs.readFile(path.join(publicDir, "favicon-16.png"));
const favicon32 = await fs.readFile(path.join(publicDir, "favicon-32.png"));
const ico = await pngToIco([favicon16, favicon32]);
await fs.writeFile(path.join(publicDir, "favicon.ico"), ico);

await sharp(ogSvg).resize(1200, 630).png().toFile(path.join(publicDir, "og-image.png"));

await sharp(logoSvg)
  .resize(800, null)
  .png()
  .toFile(path.join(publicDir, "logo-preview.png"));

await fs.mkdir(artifactsDir, { recursive: true });
const artifactCopies = [
  ["logo-preview.png", "branding-logo-burger-preview.png"],
  ["icon-192.png", "branding-burger-icon-192.png"],
  ["favicon-16.png", "branding-favicon-16.png"],
  ["favicon-32.png", "branding-favicon-32.png"],
  ["og-image.png", "branding-og-image.png"],
];

for (const [src, dest] of artifactCopies) {
  await fs.copyFile(path.join(publicDir, src), path.join(artifactsDir, dest));
}

const paletteSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="320" viewBox="0 0 800 320">
  <rect width="800" height="320" fill="#141210"/>
  <text x="40" y="48" fill="#f5ebe3" font-family="system-ui" font-size="24" font-weight="700">imbrgr ember palette</text>
  ${[
    ["Charcoal deep", "#141210", 40],
    ["Charcoal", "#1c1816", 180],
    ["Warm white", "#f5ebe3", 320],
    ["Ember orange", "#f97316", 460],
    ["Amber", "#fbbf24", 600],
    ["Rose magenta", "#db2777", 40, 160],
    ["Rose", "#f43f5e", 180, 160],
    ["Orange deep", "#ea580c", 320, 160],
  ]
    .map(([name, hex, x, y = 88]) => {
      const yy = y;
      return `<g transform="translate(${x},${yy})">
        <rect width="120" height="120" rx="12" fill="${hex}" stroke="#3d3530" stroke-width="2"/>
        <text y="148" fill="#c4b5a8" font-family="system-ui" font-size="13">${name}</text>
        <text y="168" fill="#9a8b82" font-family="ui-monospace, monospace" font-size="12">${hex}</text>
      </g>`;
    })
    .join("")}
</svg>`;

await sharp(Buffer.from(paletteSvg))
  .png()
  .toFile(path.join(artifactsDir, "branding-palette.png"));

console.log("Brand assets generated in public/ and", artifactsDir);
