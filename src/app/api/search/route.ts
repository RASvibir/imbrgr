import { NextResponse } from "next/server";
import { searchPosts } from "@/lib/posts";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const results = await searchPosts(q);
  return NextResponse.json({ results });
}
