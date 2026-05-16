import { redirect } from "next/navigation";

import { ApiConfiguration } from "@/components/api-configuration";
import { getCurrentAdmin } from "@/lib/auth/session";

export default async function AdminSettingsPage() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/login?callbackUrl=/admin/settings");
  }

  return <ApiConfiguration />;
}
