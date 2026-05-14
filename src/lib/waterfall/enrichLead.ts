import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { ensureDefaultProviderConfigs, isWithinBudget } from "@/lib/cost-engine";
import { hasGoodEnoughLead, legalContactReturned, mergeProviderResult } from "@/lib/confidence-engine";
import { prisma } from "@/lib/prisma";
import { PROVIDER_ADAPTERS } from "@/lib/providers";
import { serializeLead, serializeProviderLog } from "@/lib/serializers";
import type { ConfidenceMap, LeadEnrichment, ProviderConfigInput, ProviderName, SourceMap } from "@/lib/types";

const linkedinUrlSchema = z
  .string()
  .trim()
  .url("Enter a valid LinkedIn profile URL")
  .refine((value) => /linkedin\.com\/in\/[^/?#]+/i.test(value), "Enter a LinkedIn profile URL");

function normalizeLinkedInUrl(input: string) {
  const parsed = new URL(linkedinUrlSchema.parse(input));
  parsed.hash = "";
  parsed.search = "";
  parsed.protocol = "https:";
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "www.");
  return parsed.toString().replace(/\/$/, "");
}

function leadToEnrichment(lead: Awaited<ReturnType<typeof prisma.lead.create>>): LeadEnrichment {
  return {
    fullName: lead.fullName,
    currentCompany: lead.currentCompany,
    currentDesignation: lead.currentDesignation,
    totalYearsExperience: lead.totalYearsExperience,
    emails: Array.isArray(lead.emails) ? (lead.emails as string[]) : [],
    phones: Array.isArray(lead.phones) ? (lead.phones as string[]) : [],
    workHistory: Array.isArray(lead.workHistory) ? (lead.workHistory as LeadEnrichment["workHistory"]) : [],
  };
}

async function logProviderResult(leadId: string, result: Awaited<ReturnType<NonNullable<(typeof PROVIDER_ADAPTERS)[ProviderName]>>>) {
  return prisma.providerLog.create({
    data: {
      leadId,
      provider: result.provider,
      endpoint: result.endpoint,
      success: result.success,
      requestSummary: result.requestSummary as Prisma.InputJsonValue,
      responseSummary: result.responseSummary as Prisma.InputJsonValue,
      fieldsReturned: result.fieldsReturned as Prisma.InputJsonValue,
      cost: result.cost,
      error: result.error,
    },
  });
}

async function logSkippedProvider(leadId: string, config: ProviderConfigInput, error: string) {
  return prisma.providerLog.create({
    data: {
      leadId,
      provider: config.provider,
      endpoint: "skipped",
      success: false,
      requestSummary: { provider: config.provider },
      responseSummary: { skipped: true },
      fieldsReturned: [] as Prisma.InputJsonValue,
      cost: 0,
      error,
    },
  });
}

export async function enrichLead(input: string, options: { forceRefresh?: boolean } = {}) {
  const linkedinUrl = normalizeLinkedInUrl(input);

  const cached = await prisma.lead.findUnique({
    where: { linkedinUrl },
  });

  if (cached && !options.forceRefresh && (cached.fullName || (Array.isArray(cached.emails) && cached.emails.length > 0))) {
    return {
      lead: serializeLead(cached, true),
      logs: [],
      cached: true,
      skippedDueToBudget: [],
    };
  }

  const providerConfigs = await ensureDefaultProviderConfigs();
  const lead =
    cached ??
    (await prisma.lead.create({
      data: {
        linkedinUrl,
        isCached: false,
      },
    }));

  let current: LeadEnrichment = cached && !options.forceRefresh ? leadToEnrichment(cached) : {};
  let confidence: ConfidenceMap =
    cached && !options.forceRefresh && cached.confidence && typeof cached.confidence === "object"
      ? (cached.confidence as ConfidenceMap)
      : {};
  let sources: SourceMap =
    cached && !options.forceRefresh && cached.sources && typeof cached.sources === "object" ? (cached.sources as SourceMap) : {};
  let totalCost = options.forceRefresh ? 0 : lead.totalCost;
  const logs = [];
  const skippedDueToBudget: string[] = [];

  for (const config of providerConfigs.filter((provider) => provider.enabled).sort((a, b) => a.priority - b.priority)) {
    const providerName = config.provider as ProviderName;
    const adapter = PROVIDER_ADAPTERS[providerName];

    if (hasGoodEnoughLead(current, confidence) && !(providerName === "twilio" && current.phones?.length)) {
      break;
    }

    if (!adapter) {
      const log = await logSkippedProvider(lead.id, config, "Provider is configured but no adapter is implemented yet");
      logs.push(serializeProviderLog(log));
      continue;
    }

    const expectedCost = config.costPerRequest + config.costPerSuccessfulContact;
    const budget = await isWithinBudget(config, expectedCost);

    if (!budget.allowed) {
      skippedDueToBudget.push(config.provider);
      const log = await prisma.providerLog.create({
        data: {
          leadId: lead.id,
          provider: config.provider,
          endpoint: "budget-guardrail",
          success: false,
          requestSummary: { linkedinUrl, expectedCost },
          responseSummary: {
            dailySpend: budget.dailySpend,
            monthlySpend: budget.monthlySpend,
            dailyLimit: config.dailyLimit,
            monthlyLimit: config.monthlyLimit,
          },
          fieldsReturned: [] as Prisma.InputJsonValue,
          cost: 0,
          error: budget.reason ?? "Provider skipped due to budget",
        },
      });
      logs.push(serializeProviderLog(log));
      continue;
    }

    const result = await adapter({
      linkedinUrl,
      leadId: lead.id,
      current,
      config,
    });
    const log = await logProviderResult(lead.id, result);
    logs.push(serializeProviderLog(log));
    totalCost += result.cost;

    if (result.success && result.data) {
      const merged = mergeProviderResult(current, confidence, sources, result);
      current = merged.data;
      confidence = merged.confidence;
      sources = merged.sources;
    }

    if (hasGoodEnoughLead(current, confidence) && legalContactReturned(current)) {
      continue;
    }
  }

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      fullName: current.fullName ?? null,
      currentCompany: current.currentCompany ?? null,
      currentDesignation: current.currentDesignation ?? null,
      totalYearsExperience: current.totalYearsExperience ?? null,
      emails: (current.emails ?? []) as Prisma.InputJsonValue,
      phones: (current.phones ?? []) as Prisma.InputJsonValue,
      workHistory: (current.workHistory ?? []) as Prisma.InputJsonValue,
      confidence: confidence as Prisma.InputJsonValue,
      sources: sources as Prisma.InputJsonValue,
      totalCost,
      isCached: false,
    },
  });

  return {
    lead: serializeLead(updated, false),
    logs,
    cached: false,
    skippedDueToBudget,
  };
}
