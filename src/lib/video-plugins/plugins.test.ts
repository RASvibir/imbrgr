import { describe, expect, it } from "vitest";
import {
  VideoPluginManager,
  ecoRenderPlugin,
  vhsRetroPlugin,
  cyberpunkNeonPlugin,
  filmGrainPlugin,
  glitchPlugin,
  noirPlugin,
  BUILTIN_VIDEO_PLUGINS,
} from "@/lib/video-plugins";

function createMockImageData(width = 10, height = 10, fillR = 100, fillG = 150, fillB = 200): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillR;
    data[i + 1] = fillG;
    data[i + 2] = fillB;
    data[i + 3] = 255;
  }
  return {
    data,
    width,
    height,
    colorSpace: "srgb",
  } as unknown as ImageData;
}

describe("VideoPluginManager & Plugins", () => {
  it("registers builtin plugins successfully", async () => {
    const manager = new VideoPluginManager();
    for (const plugin of BUILTIN_VIDEO_PLUGINS) {
      const ok = await manager.registerPlugin(plugin);
      expect(ok).toBe(true);
    }
    expect(manager.getRegisteredPlugins().length).toBe(BUILTIN_VIDEO_PLUGINS.length);
  });

  it("handles eco performance mode bypass", async () => {
    const manager = new VideoPluginManager({ performanceMode: "eco" });
    await manager.registerPlugin(ecoRenderPlugin);

    const frame = createMockImageData(4, 4, 100, 150, 200);
    const result = await manager.processFrame(frame);

    // In eco mode, ecoRenderPlugin returns unmodified frame
    expect(result.data[0]).toBe(100);
    expect(result.data[1]).toBe(150);
    expect(result.data[2]).toBe(200);

    // In active mode, ecoRender desaturates
    manager.setPerformanceMode("active");
    const activeResult = await manager.processFrame(createMockImageData(4, 4, 100, 150, 200));
    expect(activeResult.data[0]).toBe(Math.floor((100 + 150 + 200) / 3));
  });

  it("applies VHS retro chromatic shift in active mode", async () => {
    const manager = new VideoPluginManager({ performanceMode: "active" });
    await manager.registerPlugin(vhsRetroPlugin);

    const frame = createMockImageData(20, 20, 120, 120, 120);
    const result = await manager.processFrame(frame);
    expect(result.data.length).toBe(20 * 20 * 4);
  });

  it("applies Cyberpunk Neon contrast and hue shift", async () => {
    const manager = new VideoPluginManager({ performanceMode: "active" });
    await manager.registerPlugin(cyberpunkNeonPlugin);

    const frame = createMockImageData(10, 10, 180, 180, 180);
    const result = await manager.processFrame(frame);
    expect(result).toBeDefined();
    expect(result.data[0]).toBeGreaterThanOrEqual(0);
  });

  it("applies 35mm film grain and vignette", async () => {
    const manager = new VideoPluginManager({ performanceMode: "active" });
    await manager.registerPlugin(filmGrainPlugin);

    const frame = createMockImageData(10, 10, 128, 128, 128);
    const result = await manager.processFrame(frame);
    expect(result.data).toBeDefined();
  });

  it("applies Cyber Glitch effect", async () => {
    const manager = new VideoPluginManager({ performanceMode: "active" });
    await manager.registerPlugin(glitchPlugin);

    const frame = createMockImageData(10, 10, 128, 128, 128);
    const result = await manager.processFrame(frame);
    expect(result.data.length).toBe(10 * 10 * 4);
  });

  it("applies Classic Noir monochrome grading", async () => {
    const manager = new VideoPluginManager({ performanceMode: "active" });
    await manager.registerPlugin(noirPlugin);

    const frame = createMockImageData(6, 6, 255, 50, 20);
    const result = await manager.processFrame(frame);
    // Noir results in equal R, G, B
    expect(result.data[0]).toBe(result.data[1]);
    expect(result.data[1]).toBe(result.data[2]);
  });

  it("toggles and unloads plugins cleanly", async () => {
    const manager = new VideoPluginManager();
    await manager.registerPlugin(noirPlugin);
    expect(manager.isPluginEnabled(noirPlugin.metadata.id)).toBe(true);

    manager.setPluginEnabled(noirPlugin.metadata.id, false);
    expect(manager.isPluginEnabled(noirPlugin.metadata.id)).toBe(false);

    const unloaded = await manager.unloadPlugin(noirPlugin.metadata.id);
    expect(unloaded).toBe(true);
    expect(manager.getRegisteredPlugins().length).toBe(0);
  });
});
