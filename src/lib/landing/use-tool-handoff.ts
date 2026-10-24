"use client";

import { useEffect, useRef, useState } from "react";
import { takeFile } from "./handoff";

export interface UseToolHandoffOptions {
  onFileLoaded: (file: File) => void | Promise<void>;
  onClear?: () => void;
  enabled?: boolean;
}

export interface UseToolHandoffResult {
  isLoadedFromDrop: boolean;
  fileName: string | null;
  isExpired: boolean;
  clearHandoff: () => void;
  dismissExpired: () => void;
}

/**
 * Detects ?from=landing&handoff=<id> once on mount,
 * retrieves the file from IndexedDB / in-memory store via takeFile(id),
 * and invokes onFileLoaded(file).
 *
 * If missing or expired, sets isExpired to true so the tool can show a note
 * and keep its normal empty state.
 */
export function useToolHandoff({
  onFileLoaded,
  onClear,
  enabled = true,
}: UseToolHandoffOptions): UseToolHandoffResult {
  const [isLoadedFromDrop, setIsLoadedFromDrop] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const hasTakenRef = useRef(false);

  const onFileLoadedRef = useRef(onFileLoaded);
  const onClearRef = useRef(onClear);

  useEffect(() => {
    onFileLoadedRef.current = onFileLoaded;
  }, [onFileLoaded]);

  useEffect(() => {
    onClearRef.current = onClear;
  }, [onClear]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (hasTakenRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");
    const handoffId = params.get("handoff");

    if (from === "landing" && handoffId) {
      hasTakenRef.current = true;
      takeFile(handoffId)
        .then((file) => {
          if (file) {
            setFileName(file.name);
            setIsLoadedFromDrop(true);
            setIsExpired(false);
            void onFileLoadedRef.current(file);
          } else {
            setIsExpired(true);
          }
        })
        .catch(() => {
          setIsExpired(true);
        });
    }
  }, [enabled]);

  const clearHandoff = () => {
    setIsLoadedFromDrop(false);
    setFileName(null);
    onClearRef.current?.();
  };

  const dismissExpired = () => {
    setIsExpired(false);
  };

  return {
    isLoadedFromDrop,
    fileName,
    isExpired,
    clearHandoff,
    dismissExpired,
  };
}
