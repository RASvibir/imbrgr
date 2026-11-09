import { NextResponse, type NextRequest } from "next/server";
import { isStudioEmbedParam, studioEmbedCspFrameAncestors } from "@/lib/studio-embed";

/**
 * Allow FieldPress to iframe /studio when `embed=1`.
 * Clears legacy DENY framing so the Visual tray embed works.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const path = req.nextUrl.pathname;
  if (!path.startsWith("/studio")) return res;

  if (isStudioEmbedParam(req.nextUrl.searchParams.get("embed"))) {
    res.headers.set("Content-Security-Policy", studioEmbedCspFrameAncestors());
    res.headers.delete("X-Frame-Options");
  }
  return res;
}

export const config = {
  matcher: ["/studio", "/studio/:path*"],
};
