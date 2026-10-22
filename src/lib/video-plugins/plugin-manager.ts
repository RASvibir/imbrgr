/**
 * Adapted from MIT-licensed RASvibir/pacNcap (OpenCut fork) plugin manager shape.
 * Copyright (c) 2026 OpenCut & RASvibir
 */

import type {
  PerformanceMode,
  VideoPlugin,
  VideoPluginContext,
} from "@/lib/video-plugins/plugin-types";

export class VideoPluginManager {
  private plugins: Map<string, VideoPlugin> = new Map();
  private enabledPlugins: Set<string> = new Set();
  private pluginParams: Map<string, Record<string, unknown>> = new Map();
  private context: VideoPluginContext;

  constructor(initialContext?: Partial<VideoPluginContext>) {
    this.context = {
      performanceMode: initialContext?.performanceMode ?? "active",
      timeSec: initialContext?.timeSec ?? 0,
      frameIndex: initialContext?.frameIndex ?? 0,
    };
  }

  public async registerPlugin(plugin: VideoPlugin, enable = true): Promise<boolean> {
    if (this.plugins.has(plugin.metadata.id)) return false;
    if (plugin.requirements.requiresWebGPU && !this.context.gpuDevice) return false;

    const success = plugin.onRegister ? await plugin.onRegister(this.context) : true;
    if (!success) return false;

    this.plugins.set(plugin.metadata.id, plugin);

    // Initialize default params
    if (plugin.params) {
      const defaults: Record<string, unknown> = {};
      for (const p of plugin.params) {
        defaults[p.id] = p.default;
      }
      this.pluginParams.set(plugin.metadata.id, defaults);
    }

    if (enable) {
      this.enabledPlugins.add(plugin.metadata.id);
    }
    return true;
  }

  public setPluginEnabled(pluginId: string, enabled: boolean): void {
    if (enabled) {
      if (this.plugins.has(pluginId)) {
        this.enabledPlugins.add(pluginId);
      }
    } else {
      this.enabledPlugins.delete(pluginId);
    }
  }

  public isPluginEnabled(pluginId: string): boolean {
    return this.enabledPlugins.has(pluginId);
  }

  public setPluginParam(pluginId: string, paramId: string, value: unknown): void {
    const current = this.pluginParams.get(pluginId) ?? {};
    current[paramId] = value;
    this.pluginParams.set(pluginId, current);
  }

  public getPluginParams(pluginId: string): Record<string, unknown> {
    return this.pluginParams.get(pluginId) ?? {};
  }

  public setPerformanceMode(mode: PerformanceMode): void {
    this.context.performanceMode = mode;
  }

  public getPerformanceMode(): PerformanceMode {
    return this.context.performanceMode;
  }

  public setFrameContext(timeSec: number, frameIndex: number): void {
    this.context.timeSec = timeSec;
    this.context.frameIndex = frameIndex;
  }

  public getRegisteredPlugins(): VideoPlugin[] {
    return Array.from(this.plugins.values());
  }

  public async processFrame(frameData: ImageData): Promise<ImageData> {
    let out = frameData;
    for (const plugin of this.plugins.values()) {
      if (!this.enabledPlugins.has(plugin.metadata.id)) continue;
      if (!plugin.onFrameProcess) continue;
      const params = this.pluginParams.get(plugin.metadata.id);
      out = await plugin.onFrameProcess(out, this.context, params);
    }
    return out;
  }

  public async unloadPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    if (plugin.onUnload) await plugin.onUnload();
    this.plugins.delete(pluginId);
    this.enabledPlugins.delete(pluginId);
    this.pluginParams.delete(pluginId);
    return true;
  }

  public clear(): void {
    for (const id of Array.from(this.plugins.keys())) {
      void this.unloadPlugin(id);
    }
  }
}
