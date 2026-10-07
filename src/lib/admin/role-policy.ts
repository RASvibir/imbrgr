import type { User } from "@/generated/prisma/client";
import { isSuperAdminRecord, superadminUsernameAllowlist } from "@/lib/admin/policy";

/** Roles that may never receive admin console access (demote on sync). */
export const NON_SUPER_ADMIN_PRIVILEGED_ROLES = ["ADMIN", "SUPERADMIN"] as const;

/**
 * Whether an admin may change this user's role via the console.
 * Only demotion to USER is allowed; elevation to ADMIN/SUPERADMIN is never permitted.
 */
export function adminMaySetRole(
  target: Pick<User, "username" | "role">,
  nextRole: "USER",
): boolean {
  if (nextRole !== "USER") return false;
  if (target.role === "USER") return false;
  return true;
}

/** Usernames that should retain SUPERADMIN in the database (env allowlist). */
export function superAdminProvisionerUsernames(): string[] {
  return superadminUsernameAllowlist();
}

const HARD_PROTECTED_OWNER_USERNAME = "vibir";

export function shouldDemoteToUser(user: Pick<User, "username" | "role">): boolean {
  if (user.username.toLowerCase() === HARD_PROTECTED_OWNER_USERNAME) return false;
  if (user.role === "USER") return false;
  if (user.role === "ADMIN") return true;
  if (user.role === "SUPERADMIN" && !isSuperAdminRecord({ ...user, banned: false })) return true;
  return false;
}
