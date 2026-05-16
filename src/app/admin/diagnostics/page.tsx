import { redirect } from "next/navigation";

import { ProviderDiagnostics } from "@/components/provider-diagnostics";
import { getCurrentAdmin } from "@/lib/auth/session";

export default async function ProviderDiagnosticsPage() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/login?callbackUrl=/admin/diagnostics");
  }

  return <ProviderDiagnostics />;
}
