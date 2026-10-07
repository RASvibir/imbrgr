/**
 * Demote ADMIN / stale SUPERADMIN accounts to USER without deleting data.
 * Dry run by default. Apply: DATABASE_URL=... npx tsx scripts/demote-non-allowlisted-admins.ts --apply
 */
import dotenv from "dotenv";
import { prisma } from "../src/lib/db";
import { superadminUsernameAllowlist } from "../src/lib/admin/policy";
import { shouldDemoteToUser } from "../src/lib/admin/role-policy";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

function assertSuperAdminEnv(): void {
  const raw = process.env.SUPERADMIN_USERNAMES?.trim();
  if (!raw) {
    console.error("SUPERADMIN_USERNAMES must be set (e.g. vibir). Refusing to run.");
    process.exit(1);
  }
  const allow = superadminUsernameAllowlist();
  if (!allow.includes("vibir")) {
    console.error("SUPERADMIN_USERNAMES must include vibir. Refusing to run.");
    process.exit(1);
  }
}

async function main() {
  assertSuperAdminEnv();
  const apply = process.argv.includes("--apply");

  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPERADMIN"] } },
    select: { id: true, username: true, role: true },
  });
  const toDemote = users.filter((u) => shouldDemoteToUser(u));

  if (toDemote.length === 0) {
    console.log("No accounts to demote.");
    return;
  }

  for (const u of toDemote) {
    console.log(`${apply ? "Demote" : "Would demote"} @${u.username} (${u.role}) → USER`);
  }

  if (!apply) {
    console.log("\nDry run only. Pass --apply to write changes.");
    return;
  }

  for (const u of toDemote) {
    await prisma.user.update({ where: { id: u.id }, data: { role: "USER" } });
  }
  console.log(`Demoted ${toDemote.length} account(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
