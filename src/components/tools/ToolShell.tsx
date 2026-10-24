"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { btnSecondary } from "@/lib/ui/button-classes";

interface ToolShellProps {
  title: string;
  badge?: string;
  description?: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  sidebar: React.ReactNode;
  mobileToolbar?: React.ReactNode;
  mobileDrawerContent?: React.ReactNode;
  mobileDrawerTitle?: string;
  isMobileDrawerOpen?: boolean;
  onCloseMobileDrawer?: () => void;
}

export function ToolShell({
  title,
  badge = "Tool",
  description,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  headerActions,
  children,
  sidebar,
  mobileToolbar,
  mobileDrawerContent,
  mobileDrawerTitle = "Tool Options",
  isMobileDrawerOpen = false,
  onCloseMobileDrawer,
}: ToolShellProps) {
  // Global keyboard shortcuts for undo / redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (canUndo) onUndo();
      } else if (
        (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z") ||
        (cmdOrCtrl && e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        if (canRedo) onRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo, onUndo, onRedo]);

  return (
    <div
      className="flex min-h-[calc(100dvh-4rem)] flex-col bg-[var(--surface-base)] text-[var(--text-primary)]"
      data-testid="tool-shell"
    >
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]/95 px-4 py-2.5 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/tools"
            className="tap-target inline-flex items-center rounded-lg px-2 text-sm text-[var(--text-muted)] transition hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            aria-label="Back to Tools"
          >
            ← <span className="ml-1 hidden sm:inline">Back to Tools</span>
          </Link>
          <div className="h-4 w-px bg-[var(--border-subtle)]" />
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold sm:text-lg" data-testid="tool-title">{title}</h1>
            <span className="rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--accent-primary)]">
              {badge}
            </span>
          </div>
        </div>

        {/* Undo / Redo & Zoom Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Undo Button */}
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className={`${btnSecondary} tap-target !min-h-9 !px-2.5 text-xs`}
            title="Undo (Ctrl+Z / ⌘Z)"
            aria-label="Undo"
          >
            <span className="text-sm">↩</span>
            <span className="ml-1 hidden md:inline">Undo</span>
          </button>

          {/* Redo Button */}
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className={`${btnSecondary} tap-target !min-h-9 !px-2.5 text-xs`}
            title="Redo (Ctrl+Y / ⌘⇧Z)"
            aria-label="Redo"
          >
            <span className="text-sm">↪</span>
            <span className="ml-1 hidden md:inline">Redo</span>
          </button>

          <div className="hidden h-4 w-px bg-[var(--border-subtle)] sm:block" />

          {/* Zoom controls */}
          <div className="hidden items-center rounded-xl border border-[var(--border-strong)] bg-[var(--surface-raised)] p-0.5 sm:flex">
            <button
              type="button"
              onClick={onZoomOut}
              className="tap-target inline-flex !min-h-8 !min-w-8 items-center justify-center rounded-lg text-xs font-bold hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-label="Zoom out"
              title="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              onClick={onResetZoom}
              className="tap-target inline-flex !min-h-8 px-2 items-center justify-center text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              title="Reset Zoom / Fit"
              aria-label="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={onZoomIn}
              className="tap-target inline-flex !min-h-8 !min-w-8 items-center justify-center rounded-lg text-xs font-bold hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-label="Zoom in"
              title="Zoom in"
            >
              +
            </button>
          </div>

          {/* Action buttons (e.g. Export / Post) */}
          {headerActions}
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="relative flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Canvas Display Stage (Left / Main) */}
        <main
          className="relative flex flex-1 items-center justify-center overflow-auto p-4 sm:p-6 lg:p-8"
          data-testid="tool-workspace"
        >
          {children}
        </main>

        {/* Desktop Sidebar Controls (Right) */}
        <aside
          className="hidden w-96 shrink-0 flex-col overflow-y-auto border-l border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 lg:flex"
          data-testid="tool-desktop-sidebar"
        >
          {description ? (
            <p className="mb-4 text-xs text-[var(--text-secondary)]">{description}</p>
          ) : null}
          {sidebar}
        </aside>
      </div>

      {/* Mobile Sticky Thumb-Toolbar (at bottom of screen for touch devices) */}
      <div className="sticky bottom-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1.5 lg:hidden">
        {mobileToolbar}
      </div>

      {/* Mobile Bottom-Sheet Drawer */}
      {isMobileDrawerOpen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={mobileDrawerTitle}
          onClick={onCloseMobileDrawer}
        >
          <div
            className="flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-10 rounded-full bg-[var(--border-strong)]" />
                <h2 className="text-sm font-semibold">{mobileDrawerTitle}</h2>
              </div>
              <button
                type="button"
                onClick={onCloseMobileDrawer}
                className="tap-target inline-flex items-center justify-center rounded-lg px-2 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>

            {/* Drawer Content */}
            <div className="overflow-y-auto p-4">{mobileDrawerContent}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
