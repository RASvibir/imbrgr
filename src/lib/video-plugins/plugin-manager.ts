/**
 * Adapted from MIT-licensed RASvibir/pacNcap (OpenCut fork) plugin manager shape.
 * Copyright (c) 2026 OpenCut
 */

import type { PerformanceMode, VideoPlugin, VideoPluginContext } from "@/lib/video-plugins/plugin-types";

export class VideoPluginManager {
  private plugins: Map<string, VideoPlugin> = new Map();
  private context: VideoPluginContext;

  constructor(initialContext?: Partial<VideoPluginContext>) {
    this.context = {
      performanceMode: initialContext?.performanceMode ?? "active",
    };
  }

  public async registerPlugin(plugin: VideoPlugin): Promise<boolean> {
    if (this.plugins.has(plugin.metadata.id)) return false;
    if (plugin.requirements.requiresWebGPU) return false;

    const success = plugin.onRegister ? await plugin.onRegister(this.context) : true;
    if (!success) return false;

    this.plugins.set(plugin.metadata.id, plugin);
    return true;
  }

  public setPerformanceMode(mode: PerformanceMode): void {
    this.context.performanceMode = mode;
  }

  public async processFrame(frameData: ImageData): Promise<ImageData> {
    let out = frameData;
    for (const plugin of this.plugins.values()) {
      if (!plugin.onFrameProcess) continue;
      out = await plugin.onFrameProcess(out, this.context);
    }
    return out;
  }

  public async unloadPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    if (plugin.onUnload) await plugin.onUnload();
    this.plugins.delete(pluginId);
    return true;
  }
}
