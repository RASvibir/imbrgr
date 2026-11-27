import { handleVideoEnhancePost } from "@/lib/ai/video-enhance";

export const maxDuration = 30;

export async function POST(req: Request) {
  return handleVideoEnhancePost(req);
}
