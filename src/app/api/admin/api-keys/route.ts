import { z } from "zod";

import { jsonError } from "@/lib/api";
import { getCurrentAdmin } from "@/lib/auth/session";
import { ensureDefaultProviderConfigs } from "@/lib/cost-engine";
import { listEnvIntegrationStatuses, listIntegrationStatuses, saveIntegrationKey } from "@/lib/integrations/credentials";
import type { ManagedIntegrationProvider } from "@/lib/integrations/definitions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const apiKeySchema = z.object({
  provider: z.enum(["apollo", "hunter", "ninjapear", "pdl"]),
  apiKey: z.string().trim().min(1, "API key is required."),
});

export async function GET() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const integrations = await listIntegrationStatuses();

    return Response.json({
      integrations,
      storageAvailable: true,
      warning: null,
    });
  } catch (error) {
    return Response.json({
      integrations: listEnvIntegrationStatuses(),
      storageAvailable: false,
      warning: error instanceof Error ? error.message : "Encrypted API key storage is unavailable.",
    });
  }
}

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const body = apiKeySchema.parse(await request.json());

    await ensureDefaultProviderConfigs();

    const integration = await saveIntegrationKey(body.provider as ManagedIntegrationProvider, body.apiKey);

    return Response.json(
      {
        integration,
        error: integration.status === "invalid" ? integration.lastError : null,
      },
      { status: integration.status === "invalid" ? 422 : 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid API key request", 422, error.flatten());
    }

    return jsonError(error instanceof Error ? error.message : "Unable to save API key", 500);
  }
}
