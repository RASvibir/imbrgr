/**
 * Rough MP4/WebM duration from buffer (moov/mvhd or webm duration element).
 * Returns seconds or null if unknown.
 */
export function probeVideoDurationSec(buffer: Buffer, mime: string): number | null {
  if (mime === "video/webm") {
    const text = buffer.subarray(0, Math.min(buffer.length, 512_000)).toString("binary");
    const match = text.match(/Duration\s*:\s*([0-9.]+)/);
    if (match) return Number.parseFloat(match[1]);
    return null;
  }
  if (mime !== "video/mp4") return null;
  const idx = buffer.indexOf("mvhd");
  if (idx < 0 || idx + 24 > buffer.length) return null;
  const version = buffer[idx + 4];
  try {
    if (version === 0) {
      const timescale = buffer.readUInt32BE(idx + 16);
      const duration = buffer.readUInt32BE(idx + 20);
      if (timescale > 0) return duration / timescale;
    } else if (version === 1 && idx + 32 <= buffer.length) {
      const timescale = buffer.readUInt32BE(idx + 24);
      const duration = Number(buffer.readBigUInt64BE(idx + 28));
      if (timescale > 0) return duration / timescale;
    }
  } catch {
    return null;
  }
  return null;
}
