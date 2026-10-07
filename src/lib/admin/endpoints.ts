/**
 * Inventory of super-admin API surface — each handler must call `withSuperAdmin`.
 * Used by security tests and PR audit notes.
 */
export const SUPER_ADMIN_API_ROUTES = [
  "GET /api/admin/dashboard",
  "GET /api/admin/settings",
  "PATCH /api/admin/settings",
  "GET /api/admin/audit",
  "GET /api/admin/ai-usage",
  "GET /api/admin/reports",
  "PATCH /api/admin/reports/[reportId]",
  "POST /api/admin/thumbnails/backfill",
  "GET /api/admin/users",
  "GET /api/admin/users/[userId]",
  "PATCH /api/admin/users/[userId]",
  "DELETE /api/admin/users/[userId]",
  "GET /api/admin/content",
  "PATCH /api/admin/content/posts/[shortId]",
  "PATCH /api/admin/content/media/[shortId]",
  "GET /api/admin/archive",
] as const;

export const SUPER_ADMIN_PAGE_ROUTES = ["/admin"] as const;
