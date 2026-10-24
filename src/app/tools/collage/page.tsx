import type { Metadata } from "next";
import { CollageBuilder } from "@/components/tools/collage/CollageBuilder";

export const metadata: Metadata = {
  title: "Collage Builder — imbrgr",
  description:
    "Combine multiple photos into beautiful grids, side-by-side comparisons, polaroid stacks, and social story collages.",
};

export default function CollageToolPage() {
  return <CollageBuilder />;
}
