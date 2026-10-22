"use client";

import type { PerformanceMode, VideoPlugin } from "@/lib/video-plugins/plugin-types";
import { BUILTIN_VIDEO_PLUGINS } from "@/lib/video-plugins";

type Props = {
  performanceMode: PerformanceMode;
  onPerformanceModeChange: (mode: PerformanceMode) => void;
  enabledPluginIds: Set<string>;
  onTogglePlugin: (pluginId: string, enabled: boolean) => void;
  pluginParams: Map<string, Record<string, unknown>>;
  onParamChange: (pluginId: string, paramId: string, value: unknown) => void;
};

export function VideoPluginsPanel({
  performanceMode,
  onPerformanceModeChange,
  enabledPluginIds,
  onTogglePlugin,
  pluginParams,
  onParamChange,
}: Props) {
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

      {/* Plugin Stack List */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Available Visual Effect Plugins ({BUILTIN_VIDEO_PLUGINS.length})
        </h4>
        <div className="mt-2 space-y-2.5">
          {BUILTIN_VIDEO_PLUGINS.map((plugin: VideoPlugin) => {
            const isEnabled = enabledPluginIds.has(plugin.metadata.id);
            const currentParams = pluginParams.get(plugin.metadata.id) ?? {};

            return (
              <div
                key={plugin.metadata.id}
                className={`rounded-xl border p-3 transition ${
                  isEnabled
                    ? "border-[var(--accent-primary)] bg-[var(--surface-raised)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-sunken)] opacity-85"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-[var(--text-primary)]">
                        {plugin.metadata.name}
                      </span>
                      <span className="rounded bg-[var(--border-subtle)] px-1.5 py-0.5 text-[9px] text-[var(--text-muted)]">
                        v{plugin.metadata.version}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                      {plugin.metadata.description}
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => onTogglePlugin(plugin.metadata.id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-[var(--border-strong)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div>
                  </label>
                </div>

                {/* Plugin Parameters */}
                {isEnabled && plugin.params && plugin.params.length > 0 ? (
                  <div className="mt-2.5 space-y-2 border-t border-[var(--border-subtle)] pt-2">
                    {plugin.params.map((param) => {
                      const val = currentParams[param.id] ?? param.default;
                      if (param.type === "number") {
                        return (
                          <div key={param.id} className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-[var(--text-muted)]">{param.label}</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={param.min ?? 0}
                                max={param.max ?? 1}
                                step={param.step ?? 0.1}
                                value={typeof val === "number" ? val : Number(param.default)}
                                onChange={(e) => onParamChange(plugin.metadata.id, param.id, Number(e.target.value))}
                                className="w-24"
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
