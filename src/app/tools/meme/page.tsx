import type { Metadata } from "next";
import { MemeMaker } from "@/components/tools/meme/MemeMaker";

export const metadata: Metadata = {
  title: "Meme Maker — imbrgr",
  description:
    "Create classic and modern memes with customizable text, stickers, shapes, original templates, and one-click gallery posting.",
};

export default function MemeToolPage() {
  return <MemeMaker />;
}
