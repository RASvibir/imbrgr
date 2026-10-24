import type { Metadata } from "next";
import { ArCameraClient } from "@/components/tools/ar/ArCameraClient";

export const metadata: Metadata = {
  title: "AR Camera & Face Effects — imbrgr",
  description:
    "Try interactive burger hats, cheese drips, condiment mustaches, and retro face filters with live on-device AR face tracking.",
};

export default function ArCameraPage() {
  return (
    <main className="mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-8">
      <ArCameraClient />
    </main>
  );
}
