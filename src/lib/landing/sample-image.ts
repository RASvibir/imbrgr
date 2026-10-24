/**
 * Procedural sample artwork generator for the landing page hero.
 * Deterministic (no Math.random) so tests and screenshots remain identical.
 * Renders an original, cheerful imbrgr burger character on an HTML5 canvas.
 */

export function drawSampleBurger(
  ctx: CanvasRenderingContext2D,
  width = 640,
  height = 640,
): void {
  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // 1. Dark charcoal background with radial ambient ember glow
  const bgGrad = ctx.createRadialGradient(
    width / 2,
    height / 2,
    width * 0.1,
    width / 2,
    height / 2,
    width * 0.65,
  );
  bgGrad.addColorStop(0, "#2c1e19");
  bgGrad.addColorStop(0.6, "#181311");
  bgGrad.addColorStop(1, "#0d0a09");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle warm glow plate beneath burger
  const plateGlow = ctx.createRadialGradient(
    width / 2,
    height * 0.72,
    20,
    width / 2,
    height * 0.72,
    width * 0.45,
  );
  plateGlow.addColorStop(0, "rgba(249, 115, 22, 0.35)");
  plateGlow.addColorStop(0.5, "rgba(251, 191, 36, 0.12)");
  plateGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = plateGlow;
  ctx.beginPath();
  ctx.ellipse(width / 2, height * 0.72, width * 0.42, 45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Floating steam wisps (deterministic curves)
  ctx.save();
  ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  const steamOffsets = [-60, 0, 60];
  for (let i = 0; i < steamOffsets.length; i++) {
    const ox = width / 2 + steamOffsets[i];
    ctx.beginPath();
    ctx.moveTo(ox, height * 0.22);
    ctx.bezierCurveTo(
      ox - 12 + i * 8,
      height * 0.17,
      ox + 16 - i * 6,
      height * 0.13,
      ox - 4,
      height * 0.08,
    );
    ctx.stroke();
  }
  ctx.restore();

  // Helper coordinate anchors
  const cx = width / 2;
  const burgerY = height * 0.46;

  // 2. Bottom Bun
  const bottomBunGrad = ctx.createLinearGradient(0, burgerY + 90, 0, burgerY + 160);
  bottomBunGrad.addColorStop(0, "#e89234");
  bottomBunGrad.addColorStop(1, "#b45309");
  ctx.fillStyle = bottomBunGrad;
  ctx.beginPath();
  ctx.roundRect(cx - 160, burgerY + 95, 320, 60, [10, 10, 36, 36]);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(120, 53, 15, 0.6)";
  ctx.stroke();

  // 3. Flame-Grilled Patty
  const pattyGrad = ctx.createLinearGradient(0, burgerY + 45, 0, burgerY + 95);
  pattyGrad.addColorStop(0, "#451a03");
  pattyGrad.addColorStop(0.5, "#78350f");
  pattyGrad.addColorStop(1, "#361304");
  ctx.fillStyle = pattyGrad;
  ctx.beginPath();
  ctx.roundRect(cx - 175, burgerY + 45, 350, 52, 16);
  ctx.fill();

  // Grill marks on patty (deterministic diagonal lines)
  ctx.save();
  ctx.strokeStyle = "#1e0b04";
  ctx.lineWidth = 5;
  for (let gx = -130; gx <= 130; gx += 45) {
    ctx.beginPath();
    ctx.moveTo(cx + gx - 15, burgerY + 48);
    ctx.lineTo(cx + gx + 15, burgerY + 92);
    ctx.stroke();
  }
  ctx.restore();

  // 4. Melted Gooey Cheddar Cheese
  const cheeseGrad = ctx.createLinearGradient(0, burgerY + 20, 0, burgerY + 65);
  cheeseGrad.addColorStop(0, "#fde047");
  cheeseGrad.addColorStop(1, "#f59e0b");
  ctx.fillStyle = cheeseGrad;
  ctx.beginPath();
  ctx.moveTo(cx - 170, burgerY + 38);
  ctx.lineTo(cx + 170, burgerY + 38);
  // Drip 1 right
  ctx.lineTo(cx + 150, burgerY + 68);
  ctx.lineTo(cx + 125, burgerY + 40);
  // Drip 2 center-right
  ctx.lineTo(cx + 60, burgerY + 75);
  ctx.lineTo(cx + 35, burgerY + 40);
  // Drip 3 center-left
  ctx.lineTo(cx - 20, burgerY + 72);
  ctx.lineTo(cx - 50, burgerY + 40);
  // Drip 4 left
  ctx.lineTo(cx - 130, burgerY + 66);
  ctx.closePath();
  ctx.fill();

  // 5. Tomato Slice
  const tomatoGrad = ctx.createLinearGradient(0, burgerY + 5, 0, burgerY + 35);
  tomatoGrad.addColorStop(0, "#ef4444");
  tomatoGrad.addColorStop(1, "#b91c1c");
  ctx.fillStyle = tomatoGrad;
  ctx.beginPath();
  ctx.roundRect(cx - 165, burgerY + 12, 330, 26, 12);
  ctx.fill();

  // 6. Crisp Wavy Lettuce
  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.moveTo(cx - 180, burgerY + 12);
  // Wavy scallops across
  const scallops = 10;
  const scallopW = 360 / scallops;
  for (let s = 0; s < scallops; s++) {
    const sx = cx - 180 + s * scallopW;
    ctx.quadraticCurveTo(
      sx + scallopW / 2,
      burgerY - 8 + (s % 2 === 0 ? -6 : 6),
      sx + scallopW,
      burgerY + 12,
    );
  }
  ctx.lineTo(cx + 180, burgerY + 24);
  ctx.lineTo(cx - 180, burgerY + 24);
  ctx.closePath();
  ctx.fill();

  // 7. Golden Toasted Brioche Bun Top
  const topBunGrad = ctx.createLinearGradient(0, burgerY - 140, 0, burgerY + 8);
  topBunGrad.addColorStop(0, "#fbbf24");
  topBunGrad.addColorStop(0.3, "#f59e0b");
  topBunGrad.addColorStop(1, "#d97706");
  ctx.fillStyle = topBunGrad;
  ctx.beginPath();
  // Dome cap
  ctx.moveTo(cx - 170, burgerY + 8);
  ctx.bezierCurveTo(
    cx - 180,
    burgerY - 125,
    cx + 180,
    burgerY - 125,
    cx + 170,
    burgerY + 8,
  );
  ctx.closePath();
  ctx.fill();

  // Bun gloss highlight
  ctx.save();
  ctx.strokeStyle = "rgba(254, 243, 199, 0.45)";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx - 20, burgerY - 45, 95, -Math.PI * 0.78, -Math.PI * 0.35);
  ctx.stroke();
  ctx.restore();

  // 8. Sesame Seeds (deterministic coordinates)
  const seeds: [number, number, number][] = [
    [-90, -75, -0.2],
    [-50, -95, 0.1],
    [0, -100, -0.15],
    [55, -92, 0.25],
    [100, -70, 0.4],
    [-70, -50, -0.3],
    [-20, -65, 0.05],
    [30, -60, -0.1],
    [80, -45, 0.3],
    [-115, -35, -0.4],
    [115, -30, 0.35],
    [5, -40, 0.2],
  ];

  ctx.fillStyle = "#fffbeb";
  ctx.strokeStyle = "rgba(180, 83, 9, 0.4)";
  ctx.lineWidth = 1;
  for (const [sx, sy, rot] of seeds) {
    ctx.save();
    ctx.translate(cx + sx, burgerY + sy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 9. Friendly imbrgr Mascot Face (kawaii personality)
  // Left eye
  ctx.fillStyle = "#1c1412";
  ctx.beginPath();
  ctx.ellipse(cx - 45, burgerY - 20, 8, 11, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 45, burgerY - 20, 8, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eye highlights
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx - 48, burgerY - 24, 3.5, 0, Math.PI * 2);
  ctx.arc(cx + 42, burgerY - 24, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Rosy cheeks
  ctx.fillStyle = "rgba(244, 63, 94, 0.45)";
  ctx.beginPath();
  ctx.ellipse(cx - 70, burgerY - 10, 12, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 70, burgerY - 10, 12, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Joyful smile
  ctx.strokeStyle = "#1c1412";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, burgerY - 16, 15, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // 10. imbrgr badge tag in bottom corner
  ctx.save();
  ctx.fillStyle = "rgba(249, 115, 22, 0.9)";
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("🔥 imbrgr sample", width - 24, height - 24);
  ctx.restore();
}

/**
 * Creates an original PNG File representing the sample burger artwork.
 */
export async function createSampleBurgerFile(
  width = 640,
  height = 640,
): Promise<File> {
  if (typeof document === "undefined") {
    // Node / unit testing fallback: minimal valid 1x1 transparent PNG bytes
    const pngBytes = new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0,
      1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68,
      65, 84, 120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 45, 180, 0, 0, 0,
      0, 73, 69, 78, 68, 174, 66, 96, 130,
    ]);
    return new File([pngBytes], "imbrgr-burger-sample.png", {
      type: "image/png",
    });
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to obtain 2D canvas context for sample image");
  }
  drawSampleBurger(ctx, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Canvas toBlob failed for sample image"));
    }, "image/png");
  });

  return new File([blob], "imbrgr-burger-sample.png", { type: "image/png" });
}
