"use client";

import { useEffect, useMemo, useState } from "react";
import type { PerformanceMode, VideoPlugin } from "@/lib/video-plugins/plugin-types";
import { BUILTIN_VIDEO_PLUGINS } from "@/lib/video-plugins";
import { applyAnyFilter } from "@/lib/filter-registry";

type Props = {
  performanceMode: PerformanceMode;
  onPerformanceModeChange: (mode: PerformanceMode) => void;
  enabledPluginIds: Set<string>;
  onTogglePlugin: (pluginId: string, enabled: boolean) => void;
  pluginParams: Map<string, Record<string, unknown>>;
  onParamChange: (pluginId: string, paramId: string, value: unknown) => void;
  sampleFrameSrc?: string;
};

type PluginCategory = "all" | "photo" | "core" | "fun";

export function VideoPluginsPanel({
  performanceMode,
  onPerformanceModeChange,
  enabledPluginIds,
  onTogglePlugin,
  pluginParams,
  onParamChange,
  sampleFrameSrc,
}: Props) {
  const [category, setCategory] = useState<PluginCategory>("all");
  const [search, setSearch] = useState("");
  const [compareSplit, setCompareSplit] = useState(100);
  const [compareBypass, setCompareBypass] = useState(false);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  // Generate mini live thumbnails for presets using an offscreen canvas
  useEffect(() => {
    let cancelled = false;
    const generateThumbnails = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 44;
        canvas.height = 44;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Create a warm gradient base image if no sample provided
        const grad = ctx.createLinearGradient(0, 0, 44, 44);
        grad.addColorStop(0, "#f97316");
        grad.addColorStop(0.5, "#db2777");
        grad.addColorStop(1, "#3b82f6");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 44, 44);

        // Add a subtle center shape to show contrast
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(22, 22, 10, 0, Math.PI * 2);
        ctx.fill();

        const baseData = ctx.getImageData(0, 0, 44, 44);
        const thumbs: Record<string, string> = {};

        for (const plugin of BUILTIN_VIDEO_PLUGINS) {
          if (cancelled) return;
          const imgCopy = new ImageData(new Uint8ClampedArray(baseData.data), 44, 44);

          // Extract filter key
          const id = plugin.metadata.id;
          let filterKey = "";
          if (id.startsWith("imbrgr_photo_")) {
            filterKey = id.replace("imbrgr_photo_", "");
          } else if (id.startsWith("imbrgr_fun_")) {
            filterKey = id.replace("imbrgr_fun_", "");
          } else if (id === "noir") {
            filterKey = "noir";
          }

          if (filterKey) {
            applyAnyFilter(imgCopy, filterKey, { intensity: 1 });
          } else if (plugin.onFrameProcess) {
            void plugin.onFrameProcess(imgCopy, { performanceMode: "active", timeSec: 0 });
          }

          ctx.putImageData(imgCopy, 0, 0);
          thumbs[id] = canvas.toDataURL("image/jpeg", 0.6);
        }

        if (!cancelled) setThumbnails(thumbs);
      } catch {
        /* fallback to emojis */
      }
    };

    generateThumbnails();
    return () => {
      cancelled = true;
    };
  }, [sampleFrameSrc]);

  // Filter plugins based on active category & search
  const filteredPlugins = useMemo(() => {
    return BUILTIN_VIDEO_PLUGINS.filter((p) => {
      const id = p.metadata.id;
      const isPhoto = id.startsWith("imbrgr_photo_");
      const isFun = id.startsWith("imbrgr_fun_");
      const isCore = !isPhoto && !isFun;

      if (category === "photo" && !isPhoto) return false;
      if (category === "fun" && !isFun) return false;
      if (category === "core" && !isCore) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.metadata.name.toLowerCase().includes(q) ||
          p.metadata.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [category, search]);

  return (
    <div className="space-y-4">
      {/* pacNcap Performance Mode Selector */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
              ⚡ pacNcap Engine Mode
            </h4>
            <p className="text-[11px] text-[var(--text-muted)]">
              Hardware-adaptive frame processing pipeline
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-1">
            {(["eco", "active", "workstation"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onPerformanceModeChange(mode)}
                className={`rounded px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition ${
                  performanceMode === mode
                    ? "bg-[var(--accent-primary)] text-[var(--on-accent)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 text-[11px] text-[var(--text-muted)]">
          {performanceMode === "eco" && (
            <span>🍃 <strong>Eco Mode:</strong> Bypasses heavy pixel filters during rapid scrubbing to keep preview 60fps on low-spec hardware.</span>
          )}
          {performanceMode === "active" && (
            <span>🚀 <strong>Active Mode:</strong> Real-time software & canvas filter passes for full fidelity playback.</span>
          )}
          {performanceMode === "workstation" && (
            <span>🔥 <strong>Workstation Mode:</strong> Maximum sub-pixel quality & multi-pass effects.</span>
          )}
        </div>
      </div>

      {/* Before / After Comparison Controls */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3" data-testid="video-plugins-comparison-bar">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-1 items-center gap-2 min-w-[200px]">
            <span className="font-semibold text-[var(--text-primary)]">Before / After Slider:</span>
            <input
              type="range"
              data-testid="video-plugins-compare-slider"
              min={0}
              max={100}
              value={compareBypass ? 0 : compareSplit}
              onChange={(e) => {
                setCompareBypass(false);
                setCompareSplit(Number(e.target.value));
              }}
              className="flex-1"
              aria-label="Video filter before and after split slider"
            />
            <span className="w-8 text-right font-mono text-[10px] text-[var(--text-muted)]">
              {compareBypass ? "0%" : `${compareSplit}%`}
            </span>
          </div>
          <button
            type="button"
            className={`tap-target rounded border border-[var(--border-subtle)] px-2.5 py-1 text-xs transition ${
              compareBypass
                ? "bg-[var(--accent-primary)] text-[var(--on-accent)] font-semibold"
                : "bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
            onClick={() => setCompareBypass(!compareBypass)}
          >
            {compareBypass ? "Bypassing All FX" : "Bypass FX"}
          </button>
        </div>
      </div>

      {/* Preset Category Bar & Search */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {(
              [
                { id: "all", label: "All FX" },
                { id: "photo", label: "Photo Looks" },
                { id: "fun", label: "Burger Lab" },
                { id: "core", label: "Core Shaders" },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  category === cat.id
                    ? "bg-[var(--accent-primary)] text-[var(--on-accent)] font-semibold"
                    : "border border-[var(--border-subtle)] bg-[var(--surface-sunken)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search filters…"
            className="w-32 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] sm:w-40"
          />
        </div>
      </div>

      {/* Plugin Stack List */}
      <div>
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Plugins & Presets ({filteredPlugins.length})
          </h4>
          <span className="text-[11px] text-[var(--accent-primary)] font-medium">
            {enabledPluginIds.size} active
          </span>
        </div>

        <div className="mt-2.5 space-y-2.5">
          {filteredPlugins.map((plugin: VideoPlugin) => {
            const isEnabled = enabledPluginIds.has(plugin.metadata.id) && !compareBypass;
            const currentParams = pluginParams.get(plugin.metadata.id) ?? {};
            const thumbUrl = thumbnails[plugin.metadata.id];

            return (
              <div
                key={plugin.metadata.id}
                className={`rounded-xl border p-3 transition ${
                  isEnabled
                    ? "border-[var(--accent-primary)] bg-[var(--surface-raised)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-sunken)] opacity-85 hover:opacity-100"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Live Thumbnail / Icon */}
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-black/40">
                      {thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-base">
                          ✨
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-semibold text-xs text-[var(--text-primary)]">
                          {plugin.metadata.name}
                        </span>
                        <span className="rounded bg-[var(--border-subtle)] px-1.5 py-0.5 text-[9px] text-[var(--text-muted)]">
                          v{plugin.metadata.version}
                        </span>
                      </div>
                      <p className="line-clamp-1 mt-0.5 text-[11px] text-[var(--text-secondary)]">
                        {plugin.metadata.description}
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex cursor-pointer items-center shrink-0">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => onTogglePlugin(plugin.metadata.id, e.target.checked)}
                      className="sr-only peer"
                      aria-label={`Toggle ${plugin.metadata.name}`}
                    />
                    <div className="w-8 h-4 bg-[var(--border-strong)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div>
                  </label>
                </div>

                {/* Plugin Parameters & Intensity Slider */}
                {isEnabled && plugin.params && plugin.params.length > 0 ? (
                  <div className="mt-2.5 space-y-2 border-t border-[var(--border-subtle)] pt-2">
                    {plugin.params.map((param) => {
                      const val = currentParams[param.id] ?? param.default;
                      if (param.type === "number") {
                        return (
                          <div key={param.id} className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-[var(--text-muted)] font-medium">{param.label}</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={param.min ?? 0}
                                max={param.max ?? 1}
                                step={param.step ?? 0.05}
                                value={typeof val === "number" ? val : Number(param.default)}
                                onChange={(e) =>
                                  onParamChange(plugin.metadata.id, param.id, Number(e.target.value))
                                }
                                className="w-28"
                                aria-label={`${plugin.metadata.name} ${param.label}`}
                              />
                              <span className="w-8 text-right font-mono text-[10px] text-[var(--text-muted)]">
                                {typeof val === "number" ? val.toFixed(2) : String(val ?? "")}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      if (param.type === "boolean") {
                        return (
                          <label key={param.id} className="flex items-center justify-between text-xs cursor-pointer">
                            <span className="text-[var(--text-muted)]">{param.label}</span>
                            <input
                              type="checkbox"
                              checked={Boolean(val)}
                              onChange={(e) => onParamChange(plugin.metadata.id, param.id, e.target.checked)}
                              className="rounded border-[var(--border-strong)]"
                            />
                          </label>
                        );
                      }
                      return null;
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
