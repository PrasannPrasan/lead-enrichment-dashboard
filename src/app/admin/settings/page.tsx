import { redirect } from "next/navigation";

import { ApiConfiguration } from "@/components/api-configuration";
import { EnrichmentModeSettings } from "@/components/enrichment-mode-settings";
import { getCurrentAdmin } from "@/lib/auth/session";

export default async function AdminSettingsPage() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/login?callbackUrl=/admin/settings");
  }

  return (
    <>
      <div className="container pt-6 md:pt-8">
        <EnrichmentModeSettings />
      </div>
      <ApiConfiguration />
    </>
  );
}
