import type { Metadata } from "next";
import { GifMaker } from "@/components/tools/gif/GifMaker";

export const metadata: Metadata = {
  title: "GIF Maker — imbrgr",
  description:
    "Convert video clips, image sequences, or webcam recordings into ultra-crisp, optimized animated GIFs and WebM clips client-side.",
};

export default function GifToolPage() {
  return <GifMaker />;
}
