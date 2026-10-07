"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

export function GuestClaimOnLogin() {
  const { status } = useSession();
  const claimed = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || claimed.current) return;
    claimed.current = true;
    void fetch("/api/auth/claim-guest", { method: "POST" });
  }, [status]);

  return null;
}
