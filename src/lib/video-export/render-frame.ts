import { computeMotionTransform } from "@/lib/video-timeline/timeline-ops";
import type { TextOverlay, VisualClip } from "@/lib/video-timeline/timeline-types";

export type DrawableSource = {
  source: CanvasImageSource;
  width: number;
  height: number;
};

export type ClipSourceProvider = (clip: VisualClip, timelineSec: number) => Promise<DrawableSource | null>;

export type RenderScene = {
  width: number;
  height: number;
  bgColor: string;
  visualClips: VisualClip[];
  textOverlays: TextOverlay[];
};

export type CoverRect = { sx: number; sy: number; sw: number; sh: number };

export function coverRect(sw: number, sh: number, dw: number, dh: number): CoverRect | null {
  if (!(sw > 0) || !(sh > 0) || !(dw > 0) || !(dh > 0)) return null;
  const ratio = Math.max(dw / sw, dh / sh);
  const cw = dw / ratio;
  const ch = dh / ratio;
  return { sx: (sw - cw) / 2, sy: (sh - ch) / 2, sw: cw, sh: ch };
}

export function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): void {
  const r = coverRect(sw, sh, dw, dh);
  if (!r) return;
  ctx.drawImage(source, r.sx, r.sy, r.sw, r.sh, 0, 0, dw, dh);
}

export function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: TextOverlay,
  width: number,
  height: number,
): void {
  ctx.save();
  const x = (overlay.xPercent / 100) * width;
  const y = (overlay.yPercent / 100) * height;
  const fontSize = Math.max(16, Math.floor(overlay.fontSize * (width / 1280)));

  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const metrics = ctx.measureText(overlay.text);
  const padX = fontSize * 0.6;
  const padY = fontSize * 0.4;
  const boxW = metrics.width + padX * 2;
  const boxH = fontSize + padY * 2;

  if (overlay.bgColor && overlay.bgColor !== "transparent") {
    ctx.fillStyle = overlay.bgColor;
    ctx.beginPath();
    ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, 8);
    ctx.fill();
  }

  ctx.fillStyle = overlay.fontColor;
  ctx.fillText(overlay.text, x, y);
  ctx.restore();
}

export async function renderTimelineFrame(
  ctx: CanvasRenderingContext2D,
  scene: RenderScene,
  timeSec: number,
  getSource: ClipSourceProvider,
): Promise<void> {
  const { width, height } = scene;
  ctx.fillStyle = scene.bgColor;
  ctx.fillRect(0, 0, width, height);

  for (const clip of scene.visualClips) {
    if (!(timeSec >= clip.startSec && timeSec < clip.endSec)) continue;
    const src = await getSource(clip, timeSec);
    if (!src) continue;

    const clipDur = Math.max(0.1, clip.endSec - clip.startSec);
    const progress = Math.max(0, Math.min(1, (timeSec - clip.startSec) / clipDur));
    const motion = computeMotionTransform(clip.motion, progress);

    ctx.save();
    ctx.globalAlpha = motion.alpha;
    ctx.translate(width / 2, height / 2);
    ctx.scale(motion.scale, motion.scale);
    if (motion.rotateDeg) ctx.rotate((motion.rotateDeg * Math.PI) / 180);
    ctx.translate(-width / 2, -height / 2);
    drawCover(ctx, src.source, src.width, src.height, width, height);
    ctx.restore();
  }

  for (const t of scene.textOverlays) {
    if (timeSec >= t.startSec && timeSec < t.endSec) drawTextOverlay(ctx, t, width, height);
  }
}

export function seekVideo(video: HTMLVideoElement, timeSec: number, timeoutMs = 750): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - timeSec) < 0.001 && video.readyState >= 2) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener("seeked", finish);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    video.addEventListener("seeked", finish);
    video.currentTime = timeSec;
  });
}
