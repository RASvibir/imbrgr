import { AdminConsole } from "@/components/admin/AdminConsole";
import { assertSuperAdminPage } from "@/lib/admin/auth";
import { getAdminDashboardData } from "@/lib/admin/dashboard-data";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  await assertSuperAdminPage();
  const initialDashboard = await getAdminDashboardData();
  return <AdminConsole initialDashboard={initialDashboard} />;
}
