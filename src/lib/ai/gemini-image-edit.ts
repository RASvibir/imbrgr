export type GeminiEditParams = {
  imageBuffer: Buffer;
  mimeType: string;
  instruction: string;
};

export type GeminiEditResult = {
  buffer: Buffer;
  mimeType: string;
  model: string;
};

function geminiImageModel(): string {
  return process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.0-flash-preview-image-generation";
}

export async function editImageWithGemini(params: GeminiEditParams): Promise<GeminiEditResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");

  const model = geminiImageModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const b64 = params.imageBuffer.toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: params.mimeType, data: b64 } },
            {
              text: `Edit this image per the user instruction. Return only the edited image.\nInstruction: ${params.instruction}`,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`gemini image edit ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inline_data ?? part.inlineData;
    if (inline?.data) {
      const mime = inline.mime_type ?? inline.mimeType ?? "image/png";
      return {
        buffer: Buffer.from(inline.data, "base64"),
        mimeType: mime,
        model,
      };
    }
  }
  throw new Error("gemini image edit returned no image");
}
