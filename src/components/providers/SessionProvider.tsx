"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { GuestClaimOnLogin } from "@/components/auth/GuestClaimOnLogin";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <GuestClaimOnLogin />
      {children}
    </NextAuthSessionProvider>
  );
}
