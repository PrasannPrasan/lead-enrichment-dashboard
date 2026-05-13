import { redirect } from "next/navigation";

import { AdminDashboard } from "@/components/admin-dashboard";
import { getCurrentAdmin } from "@/lib/auth/session";

export default async function AdminPage() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/login?callbackUrl=/admin");
  }

  return <AdminDashboard />;
}
