"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";
import { EmberBurgerHero } from "@/components/brand/EmberBurgerHero";
import { createSampleBurgerFile } from "@/lib/landing/sample-image";
import { ResultRail } from "./ResultRail";

export function LandingHero() {
  const [file, setFile] = useState<File | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const processSelectedFile = useCallback((selectedFile: File) => {
    if (!selectedFile.type.startsWith("image/")) {
      setErrorMsg("Please choose an image file (PNG, JPEG, WebP, GIF)");
      return;
    }
    setErrorMsg(null);

    const url = URL.createObjectURL(selectedFile);
    const img = new Image();
    img.onload = () => {
      setFile(selectedFile);
      setImageEl(img);
    };
    img.onerror = () => {
      setErrorMsg("Failed to read image. Please try a different file.");
    };
    img.src = url;
  }, []);

  // Clipboard paste listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const pastedFile = item.getAsFile();
          if (pastedFile) {
            processSelectedFile(pastedFile);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [processSelectedFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const handleUseSample = async () => {
    try {
      setIsLoadingSample(true);
      setErrorMsg(null);
      const sampleFile = await createSampleBurgerFile(640, 640);
      processSelectedFile(sampleFile);
    } catch {
      setErrorMsg("Could not generate sample image. Please try uploading.");
    } finally {
      setIsLoadingSample(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setImageEl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 sm:p-10 lg:p-12"
      aria-label="Make something fun in 10 seconds"
      data-testid="home-hero"
    >
      <div data-testid="landing-hero" className="contents">
      {/* Decorative ember background glow */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-[var(--accent-primary)]/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-[var(--accent-secondary)]/10 blur-3xl" />

      <div className="relative z-10 max-w-3xl">
        {/* Brand chip */}
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-3.5 py-1 text-xs font-semibold text-[var(--accent-primary)]">
          <span>🔥</span>
          <span>Drop it, see it</span>
          <span className="text-[var(--text-muted)]">•</span>
          <span className="text-[var(--text-secondary)]">All on device</span>
        </div>

        {/* Primary Headline */}
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-5xl lg:text-6xl">
          Make something fun{" "}
          <span className="cook-count-flame-text block sm:inline">
            in 10 seconds
          </span>
        </h1>

        <p className="mt-4 text-base text-[var(--text-secondary)] sm:text-lg">
          No confusing menus or empty canvases. Drop an image below to see instant
          memes, looping GIFs, collages, and burger effects cooked right on your
          content.
        </p>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
        data-testid="hero-file-input"
        aria-label="Upload photo"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileInputChange}
        data-testid="hero-camera-input"
        aria-label="Take or choose photo"
      />

      {/* Drop Zone */}
      <div className="relative z-10 mt-8">
        {!file || !imageEl ? (
          <div>
            {/* Desktop / Tablet Large Drop Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={(e) => {
                // If the user clicked outside the buttons, open file selector
                if ((e.target as HTMLElement).closest("button") === null) {
                  fileInputRef.current?.click();
                }
              }}
              className={`group relative hidden sm:flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                isDragging
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 shadow-[var(--shadow-ember)]"
                  : "border-[var(--border-strong)] bg-[var(--surface-sunken)] hover:border-[var(--accent-primary)] hover:bg-[var(--surface-hover)]"
              }`}
              data-testid="hero-dropzone"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-raised)] text-2xl shadow-md transition-transform group-hover:scale-110">
                <EmberBurgerHero compact />
              </div>
              <h3 className="mt-4 text-base font-semibold text-[var(--text-primary)]">
                Drag &amp; drop an image, paste, or click to browse
              </h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Supports PNG, JPG, WebP, GIF • Works 100% locally in your browser
              </p>

              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={btnPrimary}
                  data-testid="hero-browse-button"
                >
                  Choose an image
                </button>
                <span className="text-xs text-[var(--text-muted)]">or</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleUseSample();
                  }}
                  disabled={isLoadingSample}
                  className={btnSecondary}
                  data-testid="hero-sample-button"
                >
                  {isLoadingSample ? "Cooking sample…" : "✨ Use a sample"}
                </button>
              </div>
            </div>

            {/* Mobile Collapsed Action View (Screen < 640px) */}
            <div
              className="flex sm:hidden flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-5"
              data-testid="hero-mobile-upload"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">🍔</span>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Pick a photo to start
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    See 5 instant results on your image
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className={btnPrimary}
                  data-testid="hero-mobile-camera-button"
                >
                  📷 Camera / Photos
                </button>
                <button
                  type="button"
                  onClick={() => void handleUseSample()}
                  disabled={isLoadingSample}
                  className={btnSecondary}
                  data-testid="hero-mobile-sample-button"
                >
                  {isLoadingSample ? "Cooking…" : "✨ Sample"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Active Image State */
          <div className="flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-[var(--border-strong)] bg-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageEl.src}
                  alt="Source photo preview"
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
                  Active Source
                </p>
                <p className="truncate text-sm font-medium text-[var(--text-primary)] max-w-xs">
                  {file.name}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 sm:mt-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={btnSecondary}
              >
                Change photo
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="tap-target inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
                aria-label="Remove photo"
              >
                Remove
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg ? (
          <p
            className="mt-3 text-sm font-medium text-[var(--danger)]"
            role="alert"
          >
            {errorMsg}
          </p>
        ) : null}
      </div>

      {/* Result Rail */}
      {file && imageEl ? (
        <ResultRail file={file} imageEl={imageEl} onClear={handleClear} />
      ) : null}
      </div>
    </section>
  );
}
