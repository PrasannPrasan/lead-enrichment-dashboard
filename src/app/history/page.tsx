import { redirect } from "next/navigation";

import { HistoryDashboard } from "@/components/history-dashboard";
import { getCurrentAdmin } from "@/lib/auth/session";

export default async function HistoryPage() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/login?callbackUrl=/history");
  }

  return <HistoryDashboard />;
}
