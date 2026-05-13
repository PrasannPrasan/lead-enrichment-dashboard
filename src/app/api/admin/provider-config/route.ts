import { z } from "zod";

import { getCurrentAdmin } from "@/lib/auth/session";
import { jsonError } from "@/lib/api";
import { ensureDefaultProviderConfigs } from "@/lib/cost-engine";
import { prisma } from "@/lib/prisma";
import { serializeProviderConfig } from "@/lib/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const providerConfigSchema = z.object({
  provider: z.string().min(2).toLowerCase(),
  enabled: z.boolean().default(true),
  priority: z.coerce.number().int().min(1),
  costPerRequest: z.coerce.number().min(0),
  costPerSuccessfulContact: z.coerce.number().min(0),
  dailyLimit: z.coerce.number().min(0).nullable().optional(),
  monthlyLimit: z.coerce.number().min(0).nullable().optional(),
});

export async function GET() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  const configs = await ensureDefaultProviderConfigs();

  return Response.json({
    configs: configs.map((config) => serializeProviderConfig(config)),
  });
}

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const body = providerConfigSchema.parse(await request.json());
    const config = await prisma.providerConfig.create({
      data: body,
    });

    return Response.json({
      config: serializeProviderConfig(config),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid provider config", 422, error.flatten());
    }

    return jsonError(error instanceof Error ? error.message : "Unable to create provider config", 500);
  }
}
