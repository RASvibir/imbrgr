import { describe, expect, it, beforeEach } from "vitest";
import {
  calculateCanvasDimensions,
  createDefaultMemeState,
  createLayerId,
  resetLayerIdCounterForTesting,
  wrapTextLines,
  addLayer,
  updateLayer,
  removeLayer,
  duplicateLayer,
  reorderLayer,
  toggleLockLayer,
  toggleHideLayer,
  estimateExportSize,
  screenToLayerLocal,
  getHandleAtPoint,
  hitTestLayers,
  initHistory,
  recordHistory,
  undoHistory,
  redoHistory,
  renderMemeCanvas,
  type CanvasRenderingContext2DLike,
  type MemeTextLayer,
} from "./meme-render";

describe("meme-render pure logic", () => {
  beforeEach(() => {
    resetLayerIdCounterForTesting(100);
  });

  describe("calculateCanvasDimensions", () => {
    it("handles 1:1 square aspect ratio", () => {
      const dim = calculateCanvasDimensions(1200, 800, "1:1", 800);
      expect(dim).toEqual({ width: 800, height: 800 });
    });

    it("handles 4:5 portrait aspect ratio", () => {
      const dim = calculateCanvasDimensions(800, 800, "4:5", 800);
      expect(dim).toEqual({ width: 640, height: 800 });
    });

    it("handles 16:9 landscape aspect ratio", () => {
      const dim = calculateCanvasDimensions(800, 800, "16:9", 800);
      expect(dim).toEqual({ width: 800, height: 450 });
    });

    it("handles original aspect ratio with wide image", () => {
      const dim = calculateCanvasDimensions(1600, 800, "original", 800);
      expect(dim).toEqual({ width: 800, height: 400 });
    });

    it("handles original aspect ratio with tall image", () => {
      const dim = calculateCanvasDimensions(600, 1200, "original", 800);
      expect(dim).toEqual({ width: 400, height: 800 });
    });

    it("handles zero dimensions safely", () => {
      const dim = calculateCanvasDimensions(0, 0, "original", 800);
      expect(dim).toEqual({ width: 800, height: 800 });
    });
  });

  describe("createDefaultMemeState", () => {
    it("generates top and bottom text layers with classic meme styling", () => {
      const state = createDefaultMemeState();
      expect(state.width).toBe(800);
      expect(state.height).toBe(800);
      expect(state.aspectRatio).toBe("1:1");
      expect(state.layers.length).toBe(2);

      const topText = state.layers.find((l) => l.name === "Top Text") as MemeTextLayer;
      expect(topText).toBeDefined();
      expect(topText.text).toBe("TOP TEXT");
      expect(topText.allCaps).toBe(true);
      expect(topText.fillColor).toBe("#ffffff");
      expect(topText.strokeColor).toBe("#000000");
      expect(topText.strokeWidth).toBeGreaterThan(0);

      const bottomText = state.layers.find((l) => l.name === "Bottom Text") as MemeTextLayer;
      expect(bottomText).toBeDefined();
      expect(bottomText.text).toBe("BOTTOM TEXT");
    });

    it("includes background image layer when imageSrc is supplied", () => {
      const state = createDefaultMemeState({
        imageSrc: "blob:http://localhost/test-image",
        imgWidth: 1000,
        imgHeight: 1000,
      });
      expect(state.layers.length).toBe(3);
      expect(state.layers[0].type).toBe("image");
      expect(state.layers[0].locked).toBe(true);
    });
  });

  describe("wrapTextLines", () => {
    it("breaks words into multiple lines when exceeding max width", () => {
      const measure = (str: string) => str.length * 10;
      const text = "WHEN YOU WRITE A MEME THAT IS WAY TOO LONG TO FIT ON ONE LINE";
      const lines = wrapTextLines(text, 150, measure);
      expect(lines.length).toBeGreaterThan(1);
      for (const line of lines) {
        expect(measure(line)).toBeLessThanOrEqual(160);
      }
    });

    it("preserves explicit line breaks", () => {
      const measure = (str: string) => str.length * 10;
      const text = "FIRST LINE\nSECOND LINE\nTHIRD LINE";
      const lines = wrapTextLines(text, 500, measure);
      expect(lines).toEqual(["FIRST LINE", "SECOND LINE", "THIRD LINE"]);
    });

    it("handles empty string gracefully", () => {
      const measure = (str: string) => str.length * 10;
      expect(wrapTextLines("", 200, measure)).toEqual([""]);
    });
  });

  describe("Layer operations (pure immutable updates)", () => {
    it("adds a new layer and selects it", () => {
      const initial = createDefaultMemeState();
      const newLayer: MemeTextLayer = {
        id: createLayerId("custom"),
        type: "text",
        name: "Custom",
        x: 400,
        y: 400,
        width: 300,
        height: 50,
        rotation: 0,
        scale: 1,
        opacity: 1,
        locked: false,
        visible: true,
        text: "Custom Text",
        fontFamily: "Arial",
        fontSize: 32,
        fillColor: "#ff0000",
        strokeColor: "#000000",
        strokeWidth: 2,
        shadow: false,
        shadowColor: "",
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        align: "center",
        allCaps: false,
        lineHeight: 1.2,
      };

      const updated = addLayer(initial, newLayer);
      expect(updated.layers.length).toBe(initial.layers.length + 1);
      expect(updated.selectedLayerId).toBe(newLayer.id);
    });

    it("updates layer properties immutably", () => {
      const initial = createDefaultMemeState();
      const updated = updateLayer<MemeTextLayer>(initial, "layer-text-top", {
        text: "NEW TITLE",
        fontSize: 60,
      });

      const top = updated.layers.find((l) => l.id === "layer-text-top") as MemeTextLayer;
      expect(top.text).toBe("NEW TITLE");
      expect(top.fontSize).toBe(60);
      // Ensure initial was not mutated
      const oldTop = initial.layers.find((l) => l.id === "layer-text-top") as MemeTextLayer;
      expect(oldTop.text).toBe("TOP TEXT");
    });

    it("removes layer and falls back selection", () => {
      const initial = createDefaultMemeState();
      const updated = removeLayer(initial, "layer-text-top");
      expect(updated.layers.some((l) => l.id === "layer-text-top")).toBe(false);
      expect(updated.selectedLayerId).toBe("layer-text-bottom");
    });

    it("duplicates layer with offset and new ID", () => {
      const initial = createDefaultMemeState();
      const updated = duplicateLayer(initial, "layer-text-top");
      expect(updated.layers.length).toBe(3);
      const copy = updated.layers[1];
      expect(copy.id).toContain("copy");
      expect(copy.x).toBe(initial.layers[0].x + 20);
      expect(updated.selectedLayerId).toBe(copy.id);
    });

    it("reorders layer up, down, top, and bottom", () => {
      const initial = createDefaultMemeState();
      // Initially: [layer-text-top, layer-text-bottom]
      const movedDown = reorderLayer(initial, "layer-text-bottom", "down");
      expect(movedDown.layers[0].id).toBe("layer-text-bottom");
      expect(movedDown.layers[1].id).toBe("layer-text-top");

      const movedTop = reorderLayer(movedDown, "layer-text-bottom", "top");
      expect(movedTop.layers[1].id).toBe("layer-text-bottom");
    });

    it("toggles lock and hide states", () => {
      const initial = createDefaultMemeState();
      const lockedState = toggleLockLayer(initial, "layer-text-top");
      expect(lockedState.layers[0].locked).toBe(true);

      const hiddenState = toggleHideLayer(initial, "layer-text-top");
      expect(hiddenState.layers[0].visible).toBe(false);
    });
  });

  describe("Hit testing and coordinate transformation", () => {
    it("converts screen point to local coordinate system", () => {
      const layer: MemeTextLayer = {
        id: "test",
        type: "text",
        name: "Test",
        x: 400,
        y: 300,
        width: 200,
        height: 100,
        rotation: 0,
        scale: 1,
        opacity: 1,
        locked: false,
        visible: true,
        text: "Hi",
        fontFamily: "Arial",
        fontSize: 20,
        fillColor: "#fff",
        strokeColor: "#000",
        strokeWidth: 1,
        shadow: false,
        shadowColor: "",
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        align: "center",
        allCaps: false,
        lineHeight: 1.2,
      };

      const local = screenToLayerLocal(400, 300, layer);
      expect(local.localX).toBe(0);
      expect(local.localY).toBe(0);

      const handle = getHandleAtPoint(400, 300, layer);
      expect(handle).toBe("body");

      // Check corner handles: top-left is at (400 - 100, 300 - 50) = (300, 250)
      const tlHandle = getHandleAtPoint(300, 250, layer);
      expect(tlHandle).toBe("tl");

      // Check rotation knob (28px above top: y = 300 - 50 - 28 = 222)
      const rotHandle = getHandleAtPoint(400, 222, layer);
      expect(rotHandle).toBe("rot");

      // Outside boundary
      const outside = getHandleAtPoint(100, 100, layer);
      expect(outside).toBeNull();
    });

    it("hitTestLayers returns top-most layer at coordinate", () => {
      const state = createDefaultMemeState();
      // layer-text-top is centered at (400, 80)
      const hit = hitTestLayers(400, 80, state.layers);
      expect(hit).not.toBeNull();
      expect(hit?.layer.id).toBe("layer-text-top");
      expect(hit?.handle).toBe("body");
    });
  });

  describe("estimateExportSize", () => {
    it("produces deterministic realistic size estimates", () => {
      const pngSize = estimateExportSize(800, 800, "png", 90, 1);
      const jpegSize = estimateExportSize(800, 800, "jpeg", 90, 1);
      const webpSize = estimateExportSize(800, 800, "webp", 90, 1);

      expect(pngSize).toBeGreaterThan(100000);
      expect(jpegSize).toBeLessThan(pngSize);
      expect(webpSize).toBeLessThan(jpegSize);

      // Higher scale increases byte size proportionally
      const scale2x = estimateExportSize(800, 800, "png", 90, 2);
      expect(scale2x).toBe(pngSize * 4);
    });
  });

  describe("History Manager (Undo/Redo)", () => {
    it("records changes and enables undo and redo", () => {
      const state1 = createDefaultMemeState();
      let history = initHistory(state1);

      const state2 = updateLayer<MemeTextLayer>(state1, "layer-text-top", { text: "CHANGE 1" });
      history = recordHistory(history, state2);
      expect(history.present.layers[0].name).toBe("Top Text");
      expect((history.present.layers[0] as MemeTextLayer).text).toBe("CHANGE 1");
      expect(history.past.length).toBe(1);

      const state3 = updateLayer<MemeTextLayer>(state2, "layer-text-top", { text: "CHANGE 2" });
      history = recordHistory(history, state3);
      expect(history.past.length).toBe(2);

      // Undo to state 2
      history = undoHistory(history);
      expect((history.present.layers[0] as MemeTextLayer).text).toBe("CHANGE 1");
      expect(history.future.length).toBe(1);

      // Undo to state 1
      history = undoHistory(history);
      expect((history.present.layers[0] as MemeTextLayer).text).toBe("TOP TEXT");
      expect(history.past.length).toBe(0);

      // Redo back to state 2
      history = redoHistory(history);
      expect((history.present.layers[0] as MemeTextLayer).text).toBe("CHANGE 1");
    });
  });

  describe("renderMemeCanvas", () => {
    it("executes draw calls across visible layers on mock context", () => {
      const calls: { name: string; args: unknown[] }[] = [];
      const mockCtx: CanvasRenderingContext2DLike = {
        save: () => calls.push({ name: "save", args: [] }),
        restore: () => calls.push({ name: "restore", args: [] }),
        translate: (x, y) => calls.push({ name: "translate", args: [x, y] }),
        rotate: (r) => calls.push({ name: "rotate", args: [r] }),
        scale: (x, y) => calls.push({ name: "scale", args: [x, y] }),
        clearRect: (x, y, w, h) => calls.push({ name: "clearRect", args: [x, y, w, h] }),
        fillRect: (x, y, w, h) => calls.push({ name: "fillRect", args: [x, y, w, h] }),
        strokeRect: (x, y, w, h) => calls.push({ name: "strokeRect", args: [x, y, w, h] }),
        beginPath: () => calls.push({ name: "beginPath", args: [] }),
        closePath: () => calls.push({ name: "closePath", args: [] }),
        moveTo: (x, y) => calls.push({ name: "moveTo", args: [x, y] }),
        lineTo: (x, y) => calls.push({ name: "lineTo", args: [x, y] }),
        arc: (x, y, r, sa, ea) => calls.push({ name: "arc", args: [x, y, r, sa, ea] }),
        fill: () => calls.push({ name: "fill", args: [] }),
        stroke: () => calls.push({ name: "stroke", args: [] }),
        fillText: (t, x, y) => calls.push({ name: "fillText", args: [t, x, y] }),
        strokeText: (t, x, y) => calls.push({ name: "strokeText", args: [t, x, y] }),
        measureText: (t) => ({ width: t.length * 10 }),
        drawImage: (img, dx, dy, dw, dh) => calls.push({ name: "drawImage", args: [img, dx, dy, dw, dh] }),
        fillStyle: "#000",
        strokeStyle: "#000",
        lineWidth: 1,
        lineJoin: "round",
        lineCap: "round",
        globalAlpha: 1,
        font: "12px sans-serif",
        textAlign: "left",
        textBaseline: "top",
        shadowColor: "",
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
      };

      const state = createDefaultMemeState();
      renderMemeCanvas(mockCtx, state);

      const fillTextCalls = calls.filter((c) => c.name === "fillText");
      const strokeTextCalls = calls.filter((c) => c.name === "strokeText");

      // Should have rendered both Top and Bottom text
      expect(fillTextCalls.length).toBe(2);
      expect(strokeTextCalls.length).toBe(2);
      expect(fillTextCalls[0].args[0]).toBe("TOP TEXT");
      expect(fillTextCalls[1].args[0]).toBe("BOTTOM TEXT");
    });
  });
});
