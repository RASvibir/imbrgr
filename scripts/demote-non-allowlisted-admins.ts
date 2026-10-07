/**
 * Demote ADMIN / stale SUPERADMIN accounts to USER without deleting data.
 * Run: DATABASE_URL=... npx tsx scripts/demote-non-allowlisted-admins.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { shouldDemoteToUser } from "../src/lib/admin/role-policy";

async function main() {
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
    await prisma.user.update({ where: { id: u.id }, data: { role: "USER" } });
    console.log(`Demoted @${u.username} (${u.role}) → USER`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
