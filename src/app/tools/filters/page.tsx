import type { Metadata } from "next";
import { FiltersToolClient } from "@/components/tools/filters/FiltersToolClient";

export const metadata: Metadata = {
  title: "Photo & Video Filters — imbrgr",
  description:
    "Transform photos and videos with 26+ aesthetic presets, cinematic teal & orange, 35mm film grain, duotone maps, and multi-filter stacking.",
};

export default function FiltersToolPage() {
  return <FiltersToolClient />;
}
