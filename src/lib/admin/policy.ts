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
