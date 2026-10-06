import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { User } from "@/generated/prisma/client";

export function superadminUsernameAllowlist(): string[] {
  const raw = process.env.SUPERADMIN_USERNAMES ?? "vibir";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminRecord(user: Pick<User, "username" | "role" | "banned">): boolean {
  if (user.banned || user.role !== "SUPERADMIN") return false;
  const allow = superadminUsernameAllowlist();
  if (allow.length === 0) return true;
  return allow.includes(user.username.toLowerCase());
}

export function isProtectedSuperAdmin(user: Pick<User, "username" | "role">): boolean {
  return user.role === "SUPERADMIN" && superadminUsernameAllowlist().includes(user.username.toLowerCase());
}

/** Re-fetch role from DB on every admin request (never trust JWT alone). */
export async function getSuperAdminUser(): Promise<User | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !isSuperAdminRecord(user)) return null;
  return user;
}

export async function assertSuperAdminApi(): Promise<User> {
  const user = await getSuperAdminUser();
  if (!user) {
    throw new AdminNotFoundError();
  }
  return user;
}

export class AdminNotFoundError extends Error {
  constructor() {
    super("Not found");
    this.name = "AdminNotFoundError";
  }
}

export async function assertSuperAdminPage(): Promise<User> {
  const user = await getSuperAdminUser();
  if (!user) notFound();
  return user;
}

export async function isSuperAdminViewer(): Promise<boolean> {
  return Boolean(await getSuperAdminUser());
}
