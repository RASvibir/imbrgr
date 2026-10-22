/**
 * Adapted from MIT-licensed RASvibir/pacNcap (OpenCut fork) plugin primitives.
 * Copyright (c) 2026 OpenCut
 */

export type PerformanceMode = "eco" | "active" | "workstation";

export type VideoPluginContext = {
  performanceMode: PerformanceMode;
};

export type VideoPlugin = {
  metadata: {
    id: string;
    name: string;
    version: string;
    author: string;
    description: string;
  };
  requirements: {
    requiresWebGPU: boolean;
  };
  onRegister?: (ctx: VideoPluginContext) => Promise<boolean> | boolean;
  onFrameProcess?: (frameData: ImageData, ctx: VideoPluginContext) => Promise<ImageData> | ImageData;
  onUnload?: () => Promise<void> | void;
};
