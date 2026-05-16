import { z } from "zod";

import { jsonError } from "@/lib/api";
import { getCurrentAdmin } from "@/lib/auth/session";
import { ensureDefaultProviderConfigs } from "@/lib/cost-engine";
import { removeIntegrationKey } from "@/lib/integrations/credentials";
import type { ManagedIntegrationProvider } from "@/lib/integrations/definitions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const providerSchema = z.enum(["apollo", "hunter", "ninjapear", "pdl"]);

export async function DELETE(_request: Request, context: { params: Promise<{ provider: string }> }) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const { provider } = await context.params;
    const parsedProvider = providerSchema.parse(provider);

    await ensureDefaultProviderConfigs();

    const integration = await removeIntegrationKey(parsedProvider as ManagedIntegrationProvider);

    return Response.json({
      integration,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid provider", 422, error.flatten());
    }

    return jsonError(error instanceof Error ? error.message : "Unable to remove API key", 500);
  }
}
