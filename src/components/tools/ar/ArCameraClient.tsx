"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { btnPrimary, btnSecondary, btnGhost } from "@/lib/ui/button-classes";
import { useToolHandoff } from "@/lib/landing/use-tool-handoff";
import { LoadedFromDropChip, HandoffExpiredNote } from "@/components/landing/HandoffNotice";
import { ShareLinks } from "@/components/share/ShareLinks";
import type { FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import {
  AR_EFFECTS,
  renderArEffect,
  type ArEffectId,
} from "@/lib/tools/ar-effects";
import { getHeadPose, type HeadPose } from "@/lib/tools/ar-geometry";
import { FUN_FILTERS } from "@/lib/fun-filters";

type CameraState = "idle" | "requesting" | "active" | "denied" | "unsupported" | "error";

type CapturedMedia = {
  kind: "photo" | "video";
  blob: Blob;
  url: string;
  mime: string;
};

export function ArCameraClient() {
  const { data: session } = useSession();

  // Camera & FaceLandmarker references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<number | null>(null);

  // Camera settings & status
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [modelLoading, setModelLoading] = useState<boolean>(false);
  const [detectedFacesCount, setDetectedFacesCount] = useState<number>(0);

  // Universal shell toast
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const showStatusToast = useCallback((msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 3500);
  }, []);

  // AR Effect settings
  const [activeEffect, setActiveEffect] = useState<ArEffectId>("burger-hat");
  const [intensity, setIntensity] = useState<number>(1.0);
  const [activeFunFilter, setActiveFunFilter] = useState<string>("flame-grilled");

  // Capture & Recording settings
  const [countdownMode, setCountdownMode] = useState<0 | 3>(0);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordSec, setRecordSec] = useState<number>(0);
  const [flashActive, setFlashActive] = useState<boolean>(false);

  // Post-capture preview & publishing
  const [capturedMedia, setCapturedMedia] = useState<CapturedMedia | null>(null);
  const [postTitle, setPostTitle] = useState<string>("AR Face Snap 🍔");
  const [postDescription, setPostDescription] = useState<string>("");
  const [postVisibility, setPostVisibility] = useState<"PUBLIC" | "UNLISTED" | "PRIVATE">("PUBLIC");
  const [postMature, setPostMature] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishStatus, setPublishStatus] = useState<string>("");
  const [publishError, setPublishError] = useState<string>("");
  const [publishedShortId, setPublishedShortId] = useState<string | null>(null);
  const [sharePayload, setSharePayload] = useState<{
    pageUrl: string;
    directUrl: string;
    markdown: string;
    html: string;
    bbcode: string;
  } | null>(null);

  const [isSavingLibrary, setIsSavingLibrary] = useState<boolean>(false);
  const [librarySaved, setLibrarySaved] = useState<boolean>(false);
  const [libraryError, setLibraryError] = useState<string>("");

  // Photo fallback state
  const [fallbackImage, setFallbackImage] = useState<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Keep state refs for animation loop
  const effectStateRef = useRef({
    activeEffect,
    intensity,
    activeFunFilter,
    facingMode,
  });
  useEffect(() => {
    effectStateRef.current = {
      activeEffect,
      intensity,
      activeFunFilter,
      facingMode,
    };
  }, [activeEffect, intensity, activeFunFilter, facingMode]);

  // Load MediaPipe FaceLandmarker
  const ensureFaceLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;

    setModelLoading(true);
    try {
      const vision = await import("@mediapipe/tasks-vision");

      let fileset;
      try {
        fileset = await vision.FilesetResolver.forVisionTasks("/mediapipe/wasm");
      } catch (e) {
        console.warn("Local wasm failed, falling back to CDN", e);
        fileset = await vision.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );
      }

      let landmarker;
      try {
        // Try GPU delegate with local model
        landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: "/mediapipe/models/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 2,
        });
      } catch (gpuErr) {
        console.warn("GPU delegate failed, trying CPU fallback", gpuErr);
        try {
          landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: "/mediapipe/models/face_landmarker.task",
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numFaces: 2,
          });
        } catch (modelErr) {
          console.warn("Local model failed, trying remote CDN model", modelErr);
          landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numFaces: 2,
          });
        }
      }

      landmarkerRef.current = landmarker;
      return landmarker;
    } catch (err) {
      console.error("FaceLandmarker init failed:", err);
      throw err;
    } finally {
      setModelLoading(false);
    }
  }, []);

  // Stop camera tracks and render loop
  const stopCamera = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (recordIntervalRef.current) {
      window.clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    setDetectedFacesCount(0);
  }, []);

  // Main render loop
  const startRenderLoop = useCallback(() => {
    let lastDetectTime = 0;
    let latestResults: FaceLandmarkerResult | null = null;

    const render = (timeMs: number) => {
      const timeSec = timeMs / 1000;
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { activeEffect, intensity, activeFunFilter, facingMode } = effectStateRef.current;
      const mirror = facingMode === "user";

      // If we are playing from live video
      if (video && video.readyState >= 2 && !video.paused) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw camera video feed (mirrored for selfie front camera)
        ctx.save();
        if (mirror) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Run face detection (throttled to ~30fps)
        if (landmarker && timeMs - lastDetectTime >= 32) {
          lastDetectTime = timeMs;
          try {
            latestResults = landmarker.detectForVideo(video, timeMs);
            if (latestResults?.faceLandmarks) {
              setDetectedFacesCount(latestResults.faceLandmarks.length);
            }
          } catch {
            // Drop frame if busy
          }
        }

        // Render AR effect on detected faces (up to 2)
        if (latestResults?.faceLandmarks && latestResults.faceLandmarks.length > 0) {
          const faces = latestResults.faceLandmarks.slice(0, 2);
          for (let f = 0; f < faces.length; f++) {
            const landmarks = faces[f];
            const pose: HeadPose = getHeadPose(landmarks, canvas.width, canvas.height, mirror);
            renderArEffect(activeEffect, {
              ctx,
              pose,
              landmarks,
              canvasWidth: canvas.width,
              canvasHeight: canvas.height,
              mirror,
              intensity,
              timeSec,
              funFilterId: activeFunFilter,
            });
          }
        } else if (activeEffect === "fun-filter") {
          // If fun filter is active, apply across frame even without face
          const dummyPose = getHeadPose([], canvas.width, canvas.height, mirror);
          renderArEffect("fun-filter", {
            ctx,
            pose: dummyPose,
            landmarks: [],
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            mirror,
            intensity,
            timeSec,
            funFilterId: activeFunFilter,
          });
        }
      } else if (fallbackImage && fallbackImage.complete) {
        // Fallback photo mode
        if (canvas.width !== fallbackImage.naturalWidth || canvas.height !== fallbackImage.naturalHeight) {
          canvas.width = fallbackImage.naturalWidth;
          canvas.height = fallbackImage.naturalHeight;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(fallbackImage, 0, 0, canvas.width, canvas.height);

        // Detect landmarks on static image if needed
        if (landmarker && !latestResults) {
          try {
            latestResults = landmarker.detect(canvas);
            if (latestResults?.faceLandmarks) {
              setDetectedFacesCount(latestResults.faceLandmarks.length);
            }
          } catch {
            // detection fallback
          }
        }

        if (latestResults?.faceLandmarks && latestResults.faceLandmarks.length > 0) {
          const faces = latestResults.faceLandmarks.slice(0, 2);
          for (let f = 0; f < faces.length; f++) {
            const landmarks = faces[f];
            const pose: HeadPose = getHeadPose(landmarks, canvas.width, canvas.height, false);
            renderArEffect(activeEffect, {
              ctx,
              pose,
              landmarks,
              canvasWidth: canvas.width,
              canvasHeight: canvas.height,
              mirror: false,
              intensity,
              timeSec,
              funFilterId: activeFunFilter,
            });
          }
        } else if (activeEffect === "fun-filter") {
          const dummyPose = getHeadPose([], canvas.width, canvas.height, false);
          renderArEffect("fun-filter", {
            ctx,
            pose: dummyPose,
            landmarks: [],
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            mirror: false,
            intensity,
            timeSec,
            funFilterId: activeFunFilter,
          });
        }
      }

      rafIdRef.current = requestAnimationFrame(render);
    };

    rafIdRef.current = requestAnimationFrame(render);
  }, [fallbackImage]);

  // Start camera with specified facing mode
  const startCamera = useCallback(
    async (mode: "user" | "environment" = facingMode) => {
      stopCamera();
      setCameraState("requesting");
      setErrorMessage("");

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setCameraState("unsupported");
        setErrorMessage("Camera access is not supported by your browser or environment.");
        return;
      }

      try {
        await ensureFaceLandmarker();

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280, max: 1280 },
            height: { ideal: 720, max: 720 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) throw new Error("Video element missing");

        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.muted = true;

        await video.play();

        setFacingMode(mode);
        setCameraState("active");
        setFallbackImage(null);

        startRenderLoop();
      } catch (err: unknown) {
        console.error("Camera startup failed:", err);
        const errorObj = err as { name?: string; message?: string };
        if (errorObj?.name === "NotAllowedError" || errorObj?.name === "PermissionDeniedError") {
          setCameraState("denied");
          setErrorMessage("Camera permission was denied. Please allow camera access in your browser settings or upload a photo below.");
        } else {
          setCameraState("error");
          setErrorMessage(errorObj?.message || "Failed to initialize camera. You can still upload a photo to apply effects.");
        }
      }
    },
    [facingMode, ensureFaceLandmarker, stopCamera, startRenderLoop],
  );

  // Switch between front & back camera
  const toggleCameraFacing = useCallback(() => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    void startCamera(nextMode);
  }, [facingMode, startCamera]);

  // Fallback photo upload handler
  const handlePhotoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      stopCamera();
      setCameraState("active");
      setErrorMessage("");

      try {
        await ensureFaceLandmarker();

        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
          setFallbackImage(img);
          startRenderLoop();
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setErrorMessage("Failed to process photo: " + message);
      }
    },
    [ensureFaceLandmarker, stopCamera, startRenderLoop],
  );

  // Handoff integration from landing (photo upload fallback mode)
  const loadPhotoFile = useCallback(
    async (file: File) => {
      stopCamera();
      setCameraState("active");
      setErrorMessage("");

      try {
        await ensureFaceLandmarker();

        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
          setFallbackImage(img);
          startRenderLoop();
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setErrorMessage("Failed to process photo: " + message);
      }
    },
    [ensureFaceLandmarker, stopCamera, startRenderLoop],
  );

  const clearPhotoFallback = useCallback(() => {
    setFallbackImage(null);
    stopCamera();
    setCameraState("idle");
  }, [stopCamera]);

  const { isLoadedFromDrop, fileName, isExpired, clearHandoff, dismissExpired } = useToolHandoff({
    onFileLoaded: loadPhotoFile,
    onClear: clearPhotoFallback,
  });

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close?.();
        } catch {
          // ignore close error
        }
        landmarkerRef.current = null;
      }
    };
  }, [stopCamera]);

  // Execute Photo Snap
  const executeSnap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Flash animation
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 200);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setCapturedMedia({
          kind: "photo",
          blob,
          url,
          mime: "image/png",
        });
        setPostTitle(`AR Face Snap (${AR_EFFECTS.find((e) => e.id === activeEffect)?.label || "imbrgr"})`);
      },
      "image/png",
    );
  }, [activeEffect]);

  // Trigger Snap with Countdown
  const triggerSnap = useCallback(() => {
    if (countdownMode === 0) {
      executeSnap();
      return;
    }

    let count = countdownMode;
    setCountdownValue(count);
    const interval = window.setInterval(() => {
      count -= 1;
      if (count <= 0) {
        window.clearInterval(interval);
        setCountdownValue(null);
        executeSnap();
      } else {
        setCountdownValue(count);
      }
    }, 1000);
  }, [countdownMode, executeSnap]);

  // Start Video Recording (MediaRecorder from Canvas stream)
  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stream = canvas.captureStream(30);
    const candidates = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4",
    ];
    const mimeType = candidates.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) || "video/webm";

    recordedChunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setCapturedMedia({
        kind: "video",
        blob,
        url,
        mime: mimeType,
      });
      setPostTitle(`AR Burger Clip (${AR_EFFECTS.find((e) => e.id === activeEffect)?.label || "imbrgr"})`);
      setIsRecording(false);
      setRecordSec(0);
      if (recordIntervalRef.current) {
        window.clearInterval(recordIntervalRef.current);
        recordIntervalRef.current = null;
      }
    };

    recorder.start(200); // 200ms slice
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setRecordSec(0);

    const startTime = Date.now();
    recordIntervalRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setRecordSec(elapsed);
      if (elapsed >= 30) {
        recorder.stop();
      }
    }, 100);
  }, [activeEffect]);

  // Stop Video Recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Retake / Discard capture
  const handleRetake = useCallback(() => {
    if (capturedMedia) {
      URL.revokeObjectURL(capturedMedia.url);
    }
    setCapturedMedia(null);
    setPublishedShortId(null);
    setSharePayload(null);
    setLibrarySaved(false);
    setPublishStatus("");
    setPublishError("");
  }, [capturedMedia]);

  // Download capture to local device
  const handleDownload = useCallback(() => {
    if (!capturedMedia) {
      // Trigger sample SVG download for instant shell test / feedback
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
        <rect width="600" height="400" fill="#14161f"/>
        <text x="300" y="180" font-family="sans-serif" font-size="28" fill="#ff5a2c" font-weight="bold" text-anchor="middle">AR Camera</text>
        <text x="300" y="220" font-family="sans-serif" font-size="16" fill="#9ba1b0" text-anchor="middle">Made with imbrgr AR Camera</text>
      </svg>`;
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ar-camera-sample.svg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showStatusToast("Downloaded AR Camera sample!");
      return;
    }

    const isPhoto = capturedMedia.kind === "photo";
    const ext = isPhoto ? "png" : "webm";
    const filename = `imbrgr-ar-${Date.now()}.${ext}`;

    const link = document.createElement("a");
    link.href = capturedMedia.url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showStatusToast("Downloaded AR Camera capture!");
  }, [capturedMedia, showStatusToast]);

  // Save creation to User Library
  const handleSaveToLibrary = useCallback(async () => {
    if (!session?.user) {
      showStatusToast("Sign in to save directly to your library.");
      return;
    }

    if (!capturedMedia) {
      showStatusToast("Take a photo or record a video first to save to your library.");
      return;
    }

    setIsSavingLibrary(true);
    setLibraryError("");

    try {
      const ext = capturedMedia.kind === "photo" ? "png" : "webm";
      const file = new File([capturedMedia.blob], `imbrgr-ar-${Date.now()}.${ext}`, {
        type: capturedMedia.mime,
      });

      const formData = new FormData();
      formData.set("file", file);
      formData.set("visibility", "PRIVATE");
      formData.set("keepOriginal", "true");
      formData.set("mature", String(postMature));

      const res = await fetch("/api/studio/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save to library.");
      }

      setLibrarySaved(true);
      showStatusToast("Saved to your personal library!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Library save failed.";
      setLibraryError(message);
    } finally {
      setIsSavingLibrary(false);
    }
  }, [capturedMedia, session, postMature, showStatusToast]);

  // Post creation to imbrgr Public/Unlisted Gallery
  const handlePublishToGallery = useCallback(async () => {
    if (!session?.user && !capturedMedia) {
      showStatusToast("Sign in or capture media to share to the public gallery.");
      return;
    }

    if (!capturedMedia) {
      showStatusToast("Capture a photo or video first to post to gallery.");
      return;
    }

    setIsPublishing(true);
    setPublishError("");
    setPublishStatus("Publishing to imbrgr gallery…");

    try {
      const ext = capturedMedia.kind === "photo" ? "png" : "webm";
      const file = new File([capturedMedia.blob], `imbrgr-ar-${Date.now()}.${ext}`, {
        type: capturedMedia.mime,
      });

      const effectiveVisibility =
        postMature && postVisibility === "PUBLIC" ? "UNLISTED" : postVisibility;

      const formData = new FormData();
      formData.append("files", file);
      formData.append("title", postTitle.trim() || "AR Camera Creation");
      if (postDescription.trim()) {
        formData.append("description", postDescription.trim());
      }
      formData.append("tags", "ar, camera, imbrgr");
      formData.append("visibility", effectiveVisibility);
      formData.append("mature", String(postMature));

      const res = await fetch("/api/posts", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.shortId) {
        throw new Error(data.error || "Failed to publish post.");
      }

      const shortId = data.shortId;
      setPublishedShortId(shortId);

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const page = `${origin}/p/${shortId}`;

      setSharePayload({
        pageUrl: page,
        directUrl: page,
        markdown: `![${postTitle}](${page})`,
        html: `<a href="${page}"><img src="${page}" alt="${postTitle}" /></a>`,
        bbcode: `[url=${page}][img]${page}[/img][/url]`,
      });

      setPublishStatus("🎉 Published to gallery!");
      showStatusToast("Published to imbrgr gallery!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gallery post failed.";
      setPublishError(message);
    } finally {
      setIsPublishing(false);
    }
  }, [capturedMedia, session, postTitle, postDescription, postVisibility, postMature, showStatusToast]);

  return (
    <div className="space-y-6" data-testid="tool-shell">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Tool Breadcrumbs" className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <Link
            href="/tools"
            className={`${btnGhost} h-9 min-h-0 px-2.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]`}
          >
            ← Back to Tools
          </Link>
          <span className="text-[var(--text-muted)]">/</span>
          <span className="font-semibold text-[var(--text-primary)]">AR Camera</span>
        </div>

        {(isLoadedFromDrop || isExpired) && (
          <div className="flex flex-wrap items-center gap-2">
            {isLoadedFromDrop && (
              <LoadedFromDropChip fileName={fileName} onClear={clearHandoff} />
            )}
            {isExpired && (
              <HandoffExpiredNote onDismiss={dismissExpired} />
            )}
          </div>
        )}
      </nav>

      {/* Hidden processing video */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="hidden"
        aria-hidden="true"
      />

      {/* Header Banner */}
      <header
        className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 sm:p-8"
        data-testid="tool-header"
      >
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--accent-primary)]/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-3xl" aria-hidden="true">
              🍔
            </span>
            <span className="rounded-full border border-[var(--border-strong)] bg-[var(--surface-base)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-primary)]">
              AI Vision
            </span>
            <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              live
            </span>
          </div>

          <h1
            className="mt-3 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-3xl lg:text-4xl"
            data-testid="tool-title"
          >
            AR Camera
          </h1>
          <p className="mt-1 text-sm font-semibold text-[var(--accent-primary)] sm:text-base">
            Live face tracking & burger AR effects
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
            Interactive client-side burger hats, cheese drips, condiment staches, flame halo, and retro HUD face filters powered by MediaPipe.
          </p>

          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Key features">
            {["MediaPipe Vision", "Live Face Tracking", "Procedural AR Effects", "Snap & Video Record"].map((chip) => (
              <li
                key={chip}
                className="rounded-md bg-[var(--surface-sunken)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)]"
              >
                ✓ {chip}
              </li>
            ))}
          </ul>
        </div>
      </header>

      {/* Main Workspace */}
      <main
        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4 sm:p-6 shadow-sm space-y-6"
        data-testid="tool-workspace"
      >
        {/* On-device Privacy Note */}
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)]/60 px-3.5 py-2.5 text-xs text-[var(--text-secondary)]">
          <span className="text-base" aria-hidden="true">🔒</span>
          <p>
            <strong className="text-[var(--text-primary)]">100% On-Device Privacy:</strong> Video frames and face tracking run locally in your browser. Nothing leaves your device unless you choose to save or post.
          </p>
        </div>

        {/* Main View Area: Camera or Captured Preview */}
        {!capturedMedia ? (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Viewport Canvas (8 cols on lg) */}
            <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] min-h-[380px] sm:min-h-[460px] lg:col-span-8">
              {/* Live AR Canvas */}
              <canvas
                ref={canvasRef}
                className={`w-full h-full object-contain max-h-[65vh] ${
                  cameraState === "active" ? "block" : "hidden"
                }`}
              />

              {/* Shutter Flash Animation */}
              {flashActive ? (
                <div
                  className="absolute inset-0 bg-white pointer-events-none animate-fade-out"
                  aria-hidden="true"
                />
              ) : null}

              {/* Countdown Overlay */}
              {countdownValue !== null ? (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs text-7xl font-black text-white pointer-events-none"
                  aria-live="polite"
                >
                  {countdownValue}
                </div>
              ) : null}

              {/* Face Tracking HUD Status Tag */}
              {cameraState === "active" ? (
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="rounded-full bg-black/60 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-white border border-white/10 shadow-xs">
                    {detectedFacesCount > 0
                      ? `👤 ${detectedFacesCount} Face${detectedFacesCount > 1 ? "s" : ""} Tracked`
                      : "🔍 Looking for faces…"}
                  </span>
                  {isRecording ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-xs animate-pulse">
                      <span className="h-2 w-2 rounded-full bg-white" />
                      REC {recordSec.toFixed(1)}s / 30s
                    </span>
                  ) : null}
                </div>
              ) : null}

              {/* Idle / Permission Request Screen */}
              {cameraState === "idle" ? (
                <div className="p-8 text-center max-w-md space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-primary)]/10 text-3xl">
                    📸
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">
                      Ready to cook up some AR magic?
                    </h3>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      Click Start Camera to enable live face tracking. Everything runs locally on your device.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-center">
                    <button
                      type="button"
                      onClick={() => void startCamera("user")}
                      className={`${btnPrimary} min-h-11`}
                      data-testid="start-camera-button"
                    >
                      🚀 Start Camera
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`${btnSecondary} min-h-11`}
                    >
                      📁 Upload a Photo Instead
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </div>
                </div>
              ) : null}

              {/* Loading Model Screen */}
              {cameraState === "requesting" || modelLoading ? (
                <div className="p-8 text-center space-y-3">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--accent-primary)] border-r-transparent" />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Loading Face Landmarker model…
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Optimized WebAssembly & GPU delegate initializing.
                  </p>
                </div>
              ) : null}

              {/* Camera Denied / Error Fallback Screen */}
              {(cameraState === "denied" || cameraState === "unsupported" || cameraState === "error") && (
                <div className="p-8 text-center max-w-md space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--danger)]/10 text-2xl text-[var(--danger)]">
                    ⚠️
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[var(--text-primary)]">
                      {cameraState === "denied"
                        ? "Camera Permission Denied"
                        : "Camera Not Available"}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {errorMessage || "You can still try all effects by uploading a photo."}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <button
                      type="button"
                      onClick={() => void startCamera("user")}
                      className={`${btnSecondary} min-h-11`}
                    >
                      Try Again
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`${btnPrimary} min-h-11`}
                    >
                      📁 Upload Photo to Apply AR
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Right Rail: Effects Picker & Intensity Controls (4 cols on lg) */}
            <div className="space-y-5 lg:col-span-4">
              {/* Effect Selector */}
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Burger AR Effects
                  </h2>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {AR_EFFECTS.length} styles
                  </span>
                </div>

                {/* Grid Picker Rail */}
                <div
                  role="radiogroup"
                  aria-label="AR Effect Selection"
                  className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1"
                >
                  {AR_EFFECTS.map((eff) => {
                    const isSelected = activeEffect === eff.id;
                    return (
                      <button
                        key={eff.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => {
                          setActiveEffect(eff.id);
                          setIntensity(eff.defaultIntensity);
                        }}
                        className={`tap-target flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                          isSelected
                            ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)] shadow-[var(--shadow-ember)]"
                            : "border-[var(--border-subtle)] bg-[var(--surface-base)] hover:border-[var(--border-strong)] text-[var(--text-secondary)]"
                        }`}
                        data-testid={`effect-btn-${eff.id}`}
                      >
                        <span className="text-2xl" aria-hidden="true">
                          {eff.emoji}
                        </span>
                        <span className="mt-1 text-xs font-semibold leading-tight">
                          {eff.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Intensity Slider */}
                <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="intensity-range" className="font-medium text-[var(--text-secondary)]">
                      Effect Intensity
                    </label>
                    <span className="font-mono text-[var(--text-primary)]">
                      {Math.round(intensity * 100)}%
                    </span>
                  </div>
                  <input
                    id="intensity-range"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={intensity}
                    onChange={(e) => setIntensity(parseFloat(e.target.value))}
                    aria-label="Adjust effect intensity"
                    className="w-full accent-[var(--accent-primary)] cursor-pointer"
                  />
                </div>

                {/* Fun Filter Options if selected */}
                {activeEffect === "fun-filter" ? (
                  <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">
                      Choose Fun Filter Flavor:
                    </label>
                    <select
                      value={activeFunFilter}
                      onChange={(e) => setActiveFunFilter(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-xs text-[var(--text-primary)]"
                    >
                      {FUN_FILTERS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.emoji} {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>

              {/* Shutter / Capture Control Box */}
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Capture & Record
                </h2>

                {/* Countdown Mode Toggle */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">Timer Countdown:</span>
                  <div className="flex rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-0.5">
                    <button
                      type="button"
                      onClick={() => setCountdownMode(0)}
                      className={`px-2.5 py-1 text-xs rounded-md ${
                        countdownMode === 0
                          ? "bg-[var(--accent-primary)] text-white font-semibold"
                          : "text-[var(--text-muted)]"
                      }`}
                    >
                      Off
                    </button>
                    <button
                      type="button"
                      onClick={() => setCountdownMode(3)}
                      className={`px-2.5 py-1 text-xs rounded-md ${
                        countdownMode === 3
                          ? "bg-[var(--accent-primary)] text-white font-semibold"
                          : "text-[var(--text-muted)]"
                      }`}
                    >
                      3s
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={cameraState !== "active" || isRecording}
                    onClick={triggerSnap}
                    className={`${btnPrimary} w-full text-xs py-3 flex-col gap-1`}
                    data-testid="snap-photo-button"
                  >
                    <span className="text-lg">📸</span>
                    <span>Snap Photo</span>
                  </button>

                  {!isRecording ? (
                    <button
                      type="button"
                      disabled={cameraState !== "active"}
                      onClick={startRecording}
                      className={`${btnSecondary} w-full text-xs py-3 flex-col gap-1 hover:border-red-500`}
                      data-testid="record-video-button"
                    >
                      <span className="text-lg">🎥</span>
                      <span>Record (30s)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="tap-target inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-3 py-3 text-xs font-bold text-white shadow-md hover:bg-red-700 flex-col gap-1"
                    >
                      <span className="h-3 w-3 rounded-sm bg-white" />
                      <span>Stop ({recordSec.toFixed(0)}s)</span>
                    </button>
                  )}
                </div>

                {/* Flip camera control */}
                {cameraState === "active" ? (
                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    className={`${btnGhost} w-full text-xs py-2 text-[var(--text-secondary)]`}
                  >
                    🔄 Switch Camera ({facingMode === "user" ? "Front" : "Back"})
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          /* Captured Media Preview & Export Panel */
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                  Capture Complete
                </span>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  {capturedMedia.kind === "photo" ? "Photo Preview" : "Video Recording Preview"}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRetake}
                  className={`${btnSecondary} text-xs py-2`}
                  data-testid="retake-button"
                >
                  🔄 Retake
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className={`${btnPrimary} text-xs py-2`}
                  data-testid="download-button"
                >
                  💾 Download
                </button>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-12 items-start">
              {/* Captured Media Preview (7 cols) */}
              <div className="flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-black/80 p-2 md:col-span-7">
                {capturedMedia.kind === "photo" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={capturedMedia.url}
                    alt="Captured AR snap"
                    className="max-h-[60vh] rounded-lg object-contain"
                  />
                ) : (
                  <video
                    src={capturedMedia.url}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="max-h-[60vh] rounded-lg object-contain"
                  />
                )}
              </div>

              {/* Publishing & Sharing Options (5 cols) */}
              <div className="space-y-4 md:col-span-5">
                {/* Save to Library Option */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Save to My Library
                    </h3>
                    {session?.user ? (
                      <span className="text-[11px] text-[var(--text-muted)]">Signed in</span>
                    ) : null}
                  </div>

                  {librarySaved ? (
                    <p className="text-xs font-semibold text-[var(--accent-primary)]">
                      ✓ Saved directly to your personal imbrgr library!
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Store privately in your account library without posting to the public gallery.
                      </p>
                      <button
                        type="button"
                        disabled={isSavingLibrary}
                        onClick={() => void handleSaveToLibrary()}
                        className={`${btnSecondary} w-full text-xs py-2 font-medium`}
                        data-testid="save-library-button"
                      >
                        {isSavingLibrary
                          ? "Saving to Library…"
                          : session?.user
                          ? "📁 Save to Personal Library"
                          : "📁 Sign in to Save to Library"}
                      </button>
                    </>
                  )}
                  {libraryError ? (
                    <p className="text-xs text-[var(--danger)]">{libraryError}</p>
                  ) : null}
                </div>

                {/* Post to Gallery Form */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Post to Gallery
                  </h3>

                  <div className="space-y-1.5">
                    <label htmlFor="post-title" className="text-xs font-medium text-[var(--text-secondary)]">
                      Title
                    </label>
                    <input
                      id="post-title"
                      type="text"
                      value={postTitle}
                      onChange={(e) => setPostTitle(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 text-xs text-[var(--text-primary)]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="post-desc" className="text-xs font-medium text-[var(--text-secondary)]">
                      Description (optional)
                    </label>
                    <textarea
                      id="post-desc"
                      rows={2}
                      value={postDescription}
                      onChange={(e) => setPostDescription(e.target.value)}
                      placeholder="Made with imbrgr AR Camera..."
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 text-xs text-[var(--text-primary)]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] text-[var(--text-muted)]">Visibility</label>
                      <select
                        value={postVisibility}
                        onChange={(e) =>
                          setPostVisibility(e.target.value as "PUBLIC" | "UNLISTED" | "PRIVATE")
                        }
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
                      >
                        <option value="PUBLIC">Public</option>
                        <option value="UNLISTED">Unlisted</option>
                        <option value="PRIVATE">Private</option>
                      </select>
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--text-secondary)]">
                        <input
                          type="checkbox"
                          checked={postMature}
                          onChange={(e) => setPostMature(e.target.checked)}
                          className="rounded border-[var(--border-subtle)]"
                        />
                        <span>🔞 18+ Mature</span>
                      </label>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isPublishing}
                    onClick={() => void handlePublishToGallery()}
                    className={`${btnPrimary} w-full py-2.5 text-xs font-semibold`}
                    data-testid="post-gallery-button"
                  >
                    {isPublishing ? "Publishing…" : "🔥 Post to imbrgr Gallery"}
                  </button>

                  {publishStatus ? (
                    <p className="text-xs font-semibold text-[var(--accent-primary)]">{publishStatus}</p>
                  ) : null}
                  {publishError ? (
                    <p className="text-xs text-[var(--danger)]">{publishError}</p>
                  ) : null}
                </div>

                {/* Published Share Links */}
                {publishedShortId && sharePayload ? (
                  <div className="space-y-3">
                    <ShareLinks
                      share={sharePayload}
                      title="Share AR Creation"
                      visibility={postVisibility}
                      successHref={`/p/${publishedShortId}`}
                    />
                    <div className="text-center">
                      <Link
                        href={`/p/${publishedShortId}`}
                        className={`${btnPrimary} w-full text-xs py-2`}
                      >
                        👁️ View Post on imbrgr →
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Universal Actions Toolbar */}
        <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className={`${btnSecondary} text-xs font-semibold`}
              data-testid="tool-download-btn"
              aria-label="Download AR Camera output"
            >
              <span>📥 Download</span>
            </button>
            <button
              type="button"
              onClick={() => void handleSaveToLibrary()}
              className={`${btnSecondary} text-xs font-semibold`}
              data-testid="tool-save-btn"
              aria-label="Save AR Camera output to library"
            >
              <span>💾 Save to Library</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handlePublishToGallery()}
              className={`${btnPrimary} w-full sm:w-auto text-xs font-semibold`}
              data-testid="tool-post-btn"
              aria-label="Post AR Camera creation to gallery"
            >
              <span>🔥 Post to Gallery</span>
            </button>
          </div>
        </div>

        {/* User Status / Toast Feedback */}
        {statusToast ? (
          <div
            className="rounded-xl border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-4 py-3 text-center text-xs font-semibold text-[var(--accent-primary)]"
            role="status"
            aria-live="polite"
            data-testid="tool-status-toast"
          >
            {statusToast}
          </div>
        ) : null}
      </main>
    </div>
  );
}
