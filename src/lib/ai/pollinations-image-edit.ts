import { fetchWithTimeout } from "@/lib/fetch-timeout";

export type PollinationsEditParams = {
  imageBuffer: Buffer;
  mimeType: string;
  instruction: string;
};

export type PollinationsEditResult = {
  buffer: Buffer;
  mimeType: string;
  model: string;
};

function editModel(): string {
  return process.env.POLLINATIONS_EDIT_MODEL ?? "kontext";
}

function editTimeoutMs(): number {
  const n = Number.parseInt(process.env.IMAGE_EDIT_FETCH_TIMEOUT_MS ?? "90000", 10);
  return Number.isFinite(n) && n > 5_000 ? n : 90_000;
}

function parseB64Response(data: unknown): Buffer {
  const root = data as {
    data?: { b64_json?: string; url?: string }[];
    b64_json?: string;
  };
  const b64 = root.b64_json ?? root.data?.[0]?.b64_json;
  if (b64) return Buffer.from(b64, "base64");
  const url = root.data?.[0]?.url;
  if (url) throw new Error("pollinations_edit_url_response");
  throw new Error("pollinations_edit_empty");
}

export async function editImageWithPollinations(
  params: PollinationsEditParams,
): Promise<PollinationsEditResult> {
  const key = process.env.POLLINATIONS_API_KEY;
  if (!key) throw new Error("POLLINATIONS_API_KEY is not configured");

  const model = editModel();
  const form = new FormData();
  const bytes = new Uint8Array(params.imageBuffer);
  const file = new File([bytes], "source.png", { type: params.mimeType || "image/png" });
  form.append("image", file);
  form.append("prompt", params.instruction);
  form.append("model", model);
  form.append("response_format", "b64_json");

  const res = await fetchWithTimeout("https://gen.pollinations.ai/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    timeoutMs: editTimeoutMs(),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`pollinations_edit_${res.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`);
  }

  const data = await res.json();
  const buffer = parseB64Response(data);
  if (buffer.length < 256) throw new Error("pollinations_edit_empty");
  return { buffer, mimeType: "image/png", model };
}
