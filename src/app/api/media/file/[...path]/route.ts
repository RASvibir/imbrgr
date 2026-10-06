import { serveMediaFile } from "@/lib/serve-media-file";
import { getActor } from "@/lib/request-identity";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;
  const key = segments.map((s) => decodeURIComponent(s)).join("/");
  const actor = await getActor(req);
  return serveMediaFile(req, key, actor);
}
