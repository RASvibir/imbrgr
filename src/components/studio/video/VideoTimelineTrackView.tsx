"use client";

import { useMemo, useRef } from "react";
import { formatTimecode } from "@/lib/video-timeline/timeline-ops";
import type {
  AudioClip,
  TextOverlay,
  TransitionType,
  VisualClip,
} from "@/lib/video-timeline/timeline-types";

type Props = {
  visualClips: VisualClip[];
  audioClips: AudioClip[];
  textOverlays: TextOverlay[];
  currentTimeSec: number;
  totalDurationSec: number;
  selectedClipId: string | null;
  onSelectClip: (id: string | null) => void;
  onSeek: (timeSec: number) => void;
  onSplitClip: (clipId: string, splitTimeSec: number) => void;
  onDeleteClip: (clipId: string) => void;
  onTrimClip: (clipId: string, newStartSec: number, newEndSec: number) => void;
  onUpdateTransition: (clipId: string, transition: TransitionType) => void;
};

const PIXELS_PER_SECOND = 60;

export function VideoTimelineTrackView({
  visualClips,
  audioClips,
  textOverlays,
  currentTimeSec,
  totalDurationSec,
  selectedClipId,
  onSelectClip,
  onSeek,
  onSplitClip,
  onDeleteClip,
  onTrimClip,
  onUpdateTransition,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const duration = Math.max(totalDurationSec, 4);
  const timelineWidth = Math.max(duration * PIXELS_PER_SECOND, 600);

  const selectedClip = visualClips.find((c) => c.id === selectedClipId);

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min(clickX / PIXELS_PER_SECOND, duration));
    onSeek(Number(newTime.toFixed(2)));
  };

  // Generate ruler markers every 1 second
  const rulerTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let t = 0; t <= Math.ceil(duration); t++) {
      ticks.push(t);
    }
    return ticks;
  }, [duration]);

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-sm">
      {/* Timeline Quick Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!selectedClip}
            onClick={() => {
              if (selectedClip) onSplitClip(selectedClip.id, currentTimeSec);
            }}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2.5 py-1 font-medium hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] disabled:opacity-40"
            title="Split selected clip at current playhead"
          >
            ✂ Split at Playhead
          </button>

          <button
            type="button"
            disabled={!selectedClip}
            onClick={() => {
              if (selectedClip) onDeleteClip(selectedClip.id);
            }}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2.5 py-1 text-[var(--danger)] hover:border-[var(--danger)] disabled:opacity-40"
          >
            Delete Clip
          </button>

          {selectedClip ? (
            <div className="flex items-center gap-1.5 border-l border-[var(--border-subtle)] pl-2">
              <span className="text-[11px] text-[var(--text-muted)]">Transition:</span>
              <select
                value={selectedClip.transition ?? "none"}
                onChange={(e) => onUpdateTransition(selectedClip.id, e.target.value as TransitionType)}
                className="rounded border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-0.5 text-[11px]"
              >
                <option value="none">Cut (None)</option>
                <option value="fade">Fade to Black</option>
                <option value="dissolve">Cross Dissolve</option>
                <option value="wipe">Wipe</option>
                <option value="zoom">Zoom</option>
                <option value="glitch">Glitch</option>
              </select>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--text-muted)]">
          <span>Current: <strong className="text-[var(--accent-primary)]">{formatTimecode(currentTimeSec)}</strong></span>
          <span>Total: <strong>{formatTimecode(duration)}</strong></span>
        </div>
      </div>

      {/* Interactive Scrollable Multi-track Timeline */}
      <div className="relative overflow-x-auto p-3">
        <div
          ref={containerRef}
          onClick={handleRulerClick}
          className="relative select-none"
          style={{ width: `${timelineWidth}px`, minHeight: "220px" }}
        >
          {/* Ruler */}
          <div className="relative h-6 border-b border-[var(--border-strong)] bg-[var(--surface-sunken)]">
            {rulerTicks.map((t) => (
              <div
                key={t}
                className="absolute top-0 bottom-0 border-l border-[var(--border-strong)] text-[10px] text-[var(--text-muted)]"
                style={{ left: `${t * PIXELS_PER_SECOND}px` }}
              >
                <span className="pl-1 font-mono">{t}s</span>
              </div>
            ))}
          </div>

          {/* Playhead Vertical Needle */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-30 w-0.5 bg-[var(--accent-primary)]"
            style={{ left: `${currentTimeSec * PIXELS_PER_SECOND}px` }}
          >
            <div className="absolute -top-1 -left-1.5 h-3 w-3.5 rounded-sm bg-[var(--accent-primary)] text-center text-[8px] font-bold text-[var(--on-accent)] shadow">
              ▼
            </div>
          </div>

          {/* TRACK 1: Text Overlays */}
          <div className="mt-2 h-10 rounded border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)]/50 relative">
            <span className="absolute left-2 top-2.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              T · Text
            </span>
            {textOverlays.map((item) => {
              const left = item.startSec * PIXELS_PER_SECOND;
              const width = Math.max((item.endSec - item.startSec) * PIXELS_PER_SECOND, 20);
              return (
                <div
                  key={item.id}
                  className="absolute top-1 bottom-1 overflow-hidden rounded bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)] px-2 py-0.5 text-[11px] text-[var(--accent-primary)] font-medium truncate"
                  style={{ left: `${left}px`, width: `${width}px` }}
                >
                  💬 {item.text}
                </div>
              );
            })}
          </div>

          {/* TRACK 2: Visual Media Track */}
          <div className="mt-2 h-20 rounded border border-[var(--border-subtle)] bg-[var(--surface-sunken)] relative overflow-hidden">
            <span className="absolute left-2 top-2 z-10 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]/70">
              V · Video / Images
            </span>
            {visualClips.map((clip) => {
              const left = clip.startSec * PIXELS_PER_SECOND;
              const width = Math.max((clip.endSec - clip.startSec) * PIXELS_PER_SECOND, 30);
              const isSelected = selectedClipId === clip.id;

              return (
                <div
                  key={clip.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectClip(clip.id);
                  }}
                  className={`group absolute top-1 bottom-1 flex cursor-pointer items-center overflow-hidden rounded-lg border text-xs shadow-sm transition ${
                    isSelected
                      ? "border-[var(--accent-primary)] bg-[var(--surface-raised)] ring-2 ring-[var(--accent-primary)]/40 z-20"
                      : "border-[var(--border-strong)] bg-[var(--surface-base)] hover:border-[var(--accent-primary)] z-10"
                  }`}
                  style={{ left: `${left}px`, width: `${width}px` }}
                >
                  {/* Left Trim Handle */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const startX = e.clientX;
                      const origStart = clip.startSec;
                      const onMove = (moveEvent: MouseEvent) => {
                        const deltaSec = (moveEvent.clientX - startX) / PIXELS_PER_SECOND;
                        const newStart = Math.max(0, Math.min(origStart + deltaSec, clip.endSec - 0.2));
                        onTrimClip(clip.id, Number(newStart.toFixed(2)), clip.endSec);
                      };
                      const onUp = () => {
                        window.removeEventListener("mousemove", onMove);
                        window.removeEventListener("mouseup", onUp);
                      };
                      window.addEventListener("mousemove", onMove);
                      window.addEventListener("mouseup", onUp);
                    }}
                    className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-[var(--border-strong)] opacity-0 hover:bg-[var(--accent-primary)] group-hover:opacity-100 z-30"
                    title="Drag to trim start"
                  />

                  {/* Thumbnail / Kind Icon */}
                  <div className="relative h-full w-14 shrink-0 overflow-hidden bg-black/40">
                    <img src={clip.url} alt={clip.name} className="h-full w-full object-cover" />
                    {clip.motion ? (
                      <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[8px] font-bold text-[var(--accent-primary)]">
                        {clip.motion}
                      </span>
                    ) : null}
                  </div>

                  {/* Title & Duration */}
                  <div className="flex-1 truncate px-2">
                    <p className="truncate font-semibold text-[11px] text-[var(--text-primary)]">
                      {clip.name}
                    </p>
                    <p className="font-mono text-[9px] text-[var(--text-muted)]">
                      {(clip.endSec - clip.startSec).toFixed(1)}s
                      {clip.transition && clip.transition !== "none" ? ` · [${clip.transition}]` : ""}
                    </p>
                  </div>

                  {/* Right Trim Handle */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const startX = e.clientX;
                      const origEnd = clip.endSec;
                      const onMove = (moveEvent: MouseEvent) => {
                        const deltaSec = (moveEvent.clientX - startX) / PIXELS_PER_SECOND;
                        const newEnd = Math.max(clip.startSec + 0.2, origEnd + deltaSec);
                        onTrimClip(clip.id, clip.startSec, Number(newEnd.toFixed(2)));
                      };
                      const onUp = () => {
                        window.removeEventListener("mousemove", onMove);
                        window.removeEventListener("mouseup", onUp);
                      };
                      window.addEventListener("mousemove", onMove);
                      window.addEventListener("mouseup", onUp);
                    }}
                    className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-[var(--border-strong)] opacity-0 hover:bg-[var(--accent-primary)] group-hover:opacity-100 z-30"
                    title="Drag to trim end"
                  />
                </div>
              );
            })}
          </div>

          {/* TRACK 3: Audio Track */}
          <div className="mt-2 h-12 rounded border border-[var(--border-subtle)] bg-[var(--surface-sunken)] relative overflow-hidden">
            <span className="absolute left-2 top-2 z-10 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]/70">
              A · Audio & Music
            </span>
            {audioClips.map((audio) => {
              const left = audio.startSec * PIXELS_PER_SECOND;
              const width = Math.max((audio.endSec - audio.startSec) * PIXELS_PER_SECOND, 30);
              return (
                <div
                  key={audio.id}
                  className="absolute top-1 bottom-1 flex items-center rounded border border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 px-2 text-xs text-[var(--text-primary)]"
                  style={{ left: `${left}px`, width: `${width}px` }}
                >
                  <span className="mr-1.5">🎵</span>
                  <span className="truncate text-[10px] font-medium">{audio.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
