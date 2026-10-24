import type { Metadata } from "next";
import { ToolsDirectory } from "./ToolsDirectory";

export const metadata: Metadata = {
  title: "Tools & Creative Lab — imbrgr",
  description:
    "Explore the full imbrgr creative suite: Meme Maker, GIF Maker, Collage Builder, Photo Filters, AR Camera, and AI Studios.",
};

export default function ToolsIndexPage() {
  return <ToolsDirectory />;
}
