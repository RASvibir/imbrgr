import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { User } from "@/generated/prisma/client";
import { isSuperAdminRecord } from "@/lib/admin/policy";

export { isProtectedSuperAdmin, isSuperAdminRecord, superadminUsernameAllowlist } from "@/lib/admin/policy";

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
