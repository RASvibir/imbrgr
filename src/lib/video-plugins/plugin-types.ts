/**
 * Adapted from MIT-licensed RASvibir/pacNcap (OpenCut fork) plugin primitives.
 * Copyright (c) 2026 OpenCut & RASvibir
 */

export type PerformanceMode = "eco" | "active" | "workstation";

export type VideoPluginContext = {
  performanceMode: PerformanceMode;
  timeSec?: number;
  frameIndex?: number;
  gpuDevice?: unknown;
};

export type VideoPluginParamDef = {
  id: string;
  label: string;
  type: "number" | "boolean" | "select";
  default: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
};

export type VideoPlugin = {
  metadata: {
    id: string;
    name: string;
    version: string;
    author: string;
    description: string;
    category?: "filter" | "effect" | "utility" | "render";
  };
  requirements: {
    requiresWebGPU: boolean;
    requiresWebAssembly?: boolean;
    heavyMemoryFootprint?: boolean;
  };
  params?: VideoPluginParamDef[];
  onRegister?: (ctx: VideoPluginContext) => Promise<boolean> | boolean;
  onFrameProcess?: (
    frameData: ImageData,
    ctx: VideoPluginContext,
    params?: Record<string, unknown>,
  ) => Promise<ImageData> | ImageData;
  onUnload?: () => Promise<void> | void;
};
