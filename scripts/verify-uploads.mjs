import sharp from "sharp";

const base = process.env.BASE_URL ?? "http://localhost:3000";

async function uploadFile(name, buffer, mime) {
  const form = new FormData();
  form.set("title", `verify ${name}`);
  form.set("tags", "verify");
  form.set("visibility", "PUBLIC");
  form.append("files", new File([buffer], name, { type: mime }));
  const res = await fetch(`${base}/api/posts`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(`${name}: ${data.error ?? res.status}`);
  return data.shortId;
}

const png = await sharp({
  create: { width: 400, height: 300, channels: 3, background: { r: 249, g: 115, b: 22 } },
})
  .png()
  .toBuffer();

const jpg = await sharp(png).jpeg().toBuffer();
const webp = await sharp(png).webp().toBuffer();
const gif = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

for (const [name, buf, mime] of [
  ["test.png", png, "image/png"],
  ["test.jpg", jpg, "image/jpeg"],
  ["test.webp", webp, "image/webp"],
  ["test.gif", gif, "image/gif"],
]) {
  const id = await uploadFile(name, buf, mime);
  const post = await fetch(`${base}/api/posts/${id}`).then((r) => r.json());
  const key = post.media[0].storageKey;
  const head = await fetch(`${base}/api/media/file/${key}?mime=${encodeURIComponent(mime)}`);
  if (!head.ok) throw new Error(`media fetch failed ${name}`);
  const ct = head.headers.get("content-type");
  console.log(`OK ${name} -> /p/${id} (${ct})`);
}

console.log("All upload format checks passed.");
