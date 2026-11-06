import type { Metadata } from "next";
import { LandingHero } from "@/components/landing/LandingHero";
import { OutcomeTiles } from "@/components/landing/OutcomeTiles";
import { ThreeStepStrip } from "@/components/landing/ThreeStepStrip";
import { GalleryProof } from "@/components/landing/GalleryProof";
import { MobileActionBar } from "@/components/landing/MobileActionBar";
import { StudioHomePrompt } from "@/components/studio/StudioHomePrompt";

export const metadata: Metadata = {
  title: "imbrgr — images, served hot",
  description:
    "Upload, host, and share images with a warm ember glow. Drop a photo for instant local tools, or cook with AI when the kitchen is open.",
};

export default function HomePage() {
  return (
    <div
      className="min-h-screen bg-[var(--surface-base)] text-[var(--text-primary)] transition-colors"
      data-testid="landing-preview-page"
    >
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 pb-28 sm:pb-16 space-y-16 sm:space-y-24">
        {/* 1. Brand + instant local tools */}
        <LandingHero />

        {/* 2. Core hosting path — works when AI is unavailable */}
        <section
          id="host-path"
          className="scroll-mt-24 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 sm:p-10 shadow-sm"
          aria-label="Upload and host"
          data-testid="host-path-section"
        >
          <div className="flex flex-col lg:flex-row items-center lg:items-start justify-between gap-6">
            <div className="max-w-md text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent-primary)]">
                <span>Ship-ready path</span>
              </div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl text-[var(--text-primary)]">
                Upload, host, share
              </h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Drop a photo to host it with a link, refine in studio, or describe an image when AI
                cooking is available. Upload and view always work — generation is optional.
              </p>
            </div>

            <div className="w-full max-w-xl">
              <StudioHomePrompt />
            </div>
          </div>
        </section>

        {/* 3. Three-Step Workflow Strip */}
        <ThreeStepStrip />

        {/* 4. Outcome-driven Tiles */}
        <OutcomeTiles />

        {/* 5. Gallery Proof with Sort Tabs */}
        <GalleryProof />
      </main>

      {/* 6. Mobile Sticky Bottom Action Bar */}
      <MobileActionBar />
    </div>
  );
}
