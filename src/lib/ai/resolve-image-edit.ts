import { editImageWithGemini } from "@/lib/ai/gemini-image-edit";
import { shouldUseLocalImageEdit } from "@/lib/ai/edit-intent";
import { editImageWithPollinations } from "@/lib/ai/pollinations-image-edit";
import { simpleImageEdit } from "@/lib/simple-image-edit";

export type ImageEditInput = {
  imageBuffer: Buffer;
  mimeType: string;
  instruction: string;
};

export type ImageEditOutput = {
  buffer: Buffer;
  mimeType: string;
  provider: "local" | "pollinations" | "gemini";
  model?: string;
};

export async function resolveImageEdit(input: ImageEditInput): Promise<ImageEditOutput> {
  const instruction = input.instruction.trim();
  if (shouldUseLocalImageEdit(instruction)) {
    const buffer = await simpleImageEdit(input.imageBuffer, instruction);
    return { buffer, mimeType: "image/png", provider: "local" };
  }

  const errors: string[] = [];

  if (process.env.POLLINATIONS_API_KEY) {
    try {
      const r = await editImageWithPollinations({
        imageBuffer: input.imageBuffer,
        mimeType: input.mimeType,
        instruction,
      });
      return { buffer: r.buffer, mimeType: r.mimeType, provider: "pollinations", model: r.model };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "pollinations_failed");
    }
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const r = await editImageWithGemini({
        imageBuffer: input.imageBuffer,
        mimeType: input.mimeType,
        instruction,
      });
      return { buffer: r.buffer, mimeType: r.mimeType, provider: "gemini", model: r.model };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "gemini_failed");
    }
  }

  if (errors.length) {
    throw new Error(errors[0] ?? "image_edit_failed");
  }
  throw new Error("Image editing is not configured on this server.");
}
