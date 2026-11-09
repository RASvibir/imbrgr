"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { isStudioEmbedParam } from "@/lib/studio-embed";

const ATTR = "data-imbrgr-embed";

/** Marks <html> when FieldPress embeds studio so root chrome can hide via CSS. */
export function StudioEmbedMode() {
  const params = useSearchParams();
  const embed = isStudioEmbedParam(params.get("embed"));

  useEffect(() => {
    const root = document.documentElement;
    if (embed) root.setAttribute(ATTR, "1");
    else root.removeAttribute(ATTR);
    return () => root.removeAttribute(ATTR);
  }, [embed]);

  return null;
}
