import { z } from "zod";

import { getCurrentAdmin } from "@/lib/auth/session";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeProviderConfig } from "@/lib/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const providerConfigPatchSchema = z.object({
  enabled: z.boolean().optional(),
  priority: z.coerce.number().int().min(1).optional(),
  costPerRequest: z.coerce.number().min(0).optional(),
  costPerSuccessfulContact: z.coerce.number().min(0).optional(),
  dailyLimit: z.coerce.number().min(0).nullable().optional(),
  monthlyLimit: z.coerce.number().min(0).nullable().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const { id } = await context.params;
    const body = providerConfigPatchSchema.parse(await request.json());
    const config = await prisma.providerConfig.update({
      where: { id },
      data: body,
    });

    return Response.json({
      config: serializeProviderConfig(config),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid provider config update", 422, error.flatten());
    }

    return jsonError(error instanceof Error ? error.message : "Unable to update provider config", 500);
  }
}
