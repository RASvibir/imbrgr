/**
 * MediaPipe / TFLite WASM writes status lines like
 * `INFO: Created TensorFlow Lite XNNPACK delegate for CPU.` through `put_char`
 * in `vision_wasm_internal.js`. Safari surfaces those on the error channel
 * (red console badge) even though they are harmless runtime INFO.
 *
 * Silence only those known third-party strings while FaceLandmarker boots.
 */

const MEDIAPIPE_NOISE =
  /Created TensorFlow Lite XNNPACK|TensorFlow Lite XNNPACK delegate|vision_wasm_internal|INFO:\s*Created TensorFlow/i;

function isMediapipeNoise(args: unknown[]): boolean {
  try {
    return args.some((arg) => MEDIAPIPE_NOISE.test(String(arg)));
  } catch {
    return false;
  }
}

export async function withSilencedMediapipeConsole<T>(run: () => Promise<T>): Promise<T> {
  if (typeof console === "undefined") return run();

  const original = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    debug: console.debug?.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  const gate =
    (fn: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      if (isMediapipeNoise(args)) return;
      fn(...args);
    };

  console.log = gate(original.log) as typeof console.log;
  console.info = gate(original.info) as typeof console.info;
  console.warn = gate(original.warn) as typeof console.warn;
  console.error = gate(original.error) as typeof console.error;
  if (original.debug) {
    console.debug = gate(original.debug) as typeof console.debug;
  }

  try {
    return await run();
  } finally {
    console.log = original.log;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
    if (original.debug) console.debug = original.debug;
  }
}
