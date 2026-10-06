import "dotenv/config";
import { defineConfig } from "prisma/config";

/** Prisma CLI (migrate, etc.) uses the direct / unpooled connection. */
const migrationUrl =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL ??
  "postgresql://imbrgr:imbrgr@localhost:5432/imbrgr?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl,
  },
});
