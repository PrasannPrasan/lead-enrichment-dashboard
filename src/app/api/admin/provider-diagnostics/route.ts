import { Prisma } from "@prisma/client";
import { z } from "zod";

import { jsonError } from "@/lib/api";
import { getCurrentAdmin } from "@/lib/auth/session";
import { ensureDefaultProviderConfigs } from "@/lib/cost-engine";
import { prisma } from "@/lib/prisma";
import { lookupHunter } from "@/lib/providers/hunter";
import { lookupNinjaPear } from "@/lib/providers/ninjapear";
import { serializeProviderLog } from "@/lib/serializers";
import type { LeadEnrichment, ProviderConfigInput, ProviderLookupResult, ProviderName } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const diagnosticSchema = z
  .object({
    providers: z.array(z.enum(["hunter", "ninjapear"])).min(1).default(["hunter", "ninjapear"]),
    linkedinUrl: z.string().url().optional(),
    fullName: z.string().trim().min(1).optional(),
    company: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
  })
  .refine((value) => value.email || value.fullName || value.company || value.title, {
    message: "Provide at least one diagnostic input: email, fullName, company, or title.",
  });

const DIAGNOSTIC_ADAPTERS = {
  hunter: lookupHunter,
  ninjapear: lookupNinjaPear,
} satisfies Record<"hunter" | "ninjapear", (context: Parameters<typeof lookupHunter>[0]) => Promise<ProviderLookupResult>>;

async function logDiagnosticResult(result: ProviderLookupResult) {
  const log = await prisma.providerLog.create({
    data: {
      leadId: null,
      provider: result.provider,
      endpoint: result.endpoint,
      success: result.success,
      requestSummary: {
        ...result.requestSummary,
        diagnostic: true,
      } as Prisma.InputJsonValue,
      responseSummary: result.responseSummary as Prisma.InputJsonValue,
      fieldsReturned: result.fieldsReturned as Prisma.InputJsonValue,
      cost: result.cost,
      error: result.error,
    },
  });

  return serializeProviderLog(log);
}

function getConfig(provider: ProviderName, configs: ProviderConfigInput[]) {
  return (
    configs.find((config) => config.provider === provider) ?? {
      provider,
      enabled: true,
      priority: 99,
      costPerRequest: 0,
      costPerSuccessfulContact: 0,
      dailyLimit: null,
      monthlyLimit: null,
    }
  );
}

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const body = diagnosticSchema.parse(await request.json());
    const configs = await ensureDefaultProviderConfigs();
    const current: LeadEnrichment = {
      fullName: body.fullName,
      currentCompany: body.company,
      currentDesignation: body.title,
      emails: body.email ? [body.email] : [],
    };

    const results = [];

    for (const provider of body.providers) {
      const adapter = DIAGNOSTIC_ADAPTERS[provider];
      const result = await adapter({
        linkedinUrl: body.linkedinUrl ?? "https://www.linkedin.com/in/diagnostic-sample",
        leadId: "diagnostic",
        current,
        config: getConfig(provider, configs),
      });
      const log = await logDiagnosticResult(result);

      results.push({
        result,
        log,
      });
    }

    return Response.json({
      input: {
        providers: body.providers,
        hasEmail: Boolean(body.email),
        hasFullName: Boolean(body.fullName),
        hasCompany: Boolean(body.company),
        hasTitle: Boolean(body.title),
      },
      results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid diagnostic request", 422, error.flatten());
    }

    return jsonError(error instanceof Error ? error.message : "Provider diagnostic failed", 500);
  }
}
