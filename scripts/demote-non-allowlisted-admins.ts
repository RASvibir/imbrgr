/**
 * Demote ADMIN / stale SUPERADMIN accounts to USER without deleting data.
 * Dry run by default. Apply: DATABASE_URL=... npx tsx scripts/demote-non-allowlisted-admins.ts --apply
 */
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local" });

async function main() {
  const { prisma } = await import("../src/lib/db");
  const { superadminUsernameAllowlist } = await import("../src/lib/admin/policy");
  const { shouldDemoteToUser } = await import("../src/lib/admin/role-policy");

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

  const apply = process.argv.includes("--apply");

  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPERADMIN"] } },
    select: { id: true, username: true, role: true },
  });
  const toDemote = users.filter((u) => shouldDemoteToUser(u));

  if (toDemote.length === 0) {
    console.log("No accounts to demote.");
    await prisma.$disconnect();
    return;
  }

  for (const u of toDemote) {
    console.log(`${apply ? "Demote" : "Would demote"} @${u.username} (${u.role}) → USER`);
  }

  if (!apply) {
    console.log("\nDry run only. Pass --apply to write changes.");
    await prisma.$disconnect();
    return;
  }

  for (const u of toDemote) {
    await prisma.user.update({ where: { id: u.id }, data: { role: "USER" } });
  }
  console.log(`Demoted ${toDemote.length} account(s).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
