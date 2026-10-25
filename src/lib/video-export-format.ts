/**
 * MediaRecorder only offers what the browser supports: WebM on Chromium/Firefox,
 * MP4 on Safari. File names and labels must follow the blob that was recorded.
 */
export type VideoExportFormat = { mime: "video/webm" | "video/mp4"; ext: "webm" | "mp4"; label: "WebM" | "MP4" };

export function videoExportFormat(blobType: string | null | undefined): VideoExportFormat {
  const base = (blobType ?? "").split(";")[0].trim().toLowerCase();
  if (base === "video/mp4") return { mime: "video/mp4", ext: "mp4", label: "MP4" };
  return { mime: "video/webm", ext: "webm", label: "WebM" };
}
