import type { Lead, ProviderConfig, ProviderLog } from "@prisma/client";

import type { ConfidenceMap, ProviderConfigInput, SerializedLead, SourceMap, WorkHistoryItem } from "@/lib/types";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asWorkHistory(value: unknown): WorkHistoryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is WorkHistoryItem => Boolean(item) && typeof item === "object");
}

function asRecord<T>(value: unknown): T {
  return (value && typeof value === "object" ? value : {}) as T;
}

export function serializeLead(lead: Lead, cachedOverride?: boolean): SerializedLead {
  return {
    id: lead.id,
    linkedinUrl: lead.linkedinUrl,
    fullName: lead.fullName,
    currentCompany: lead.currentCompany,
    currentDesignation: lead.currentDesignation,
    totalYearsExperience: lead.totalYearsExperience,
    emails: asStringArray(lead.emails),
    phones: asStringArray(lead.phones),
    workHistory: asWorkHistory(lead.workHistory),
    confidence: asRecord<ConfidenceMap>(lead.confidence),
    sources: asRecord<SourceMap>(lead.sources),
    totalCost: lead.totalCost,
    isCached: cachedOverride ?? lead.isCached,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

export function serializeProviderLog(log: ProviderLog) {
  return {
    id: log.id,
    leadId: log.leadId,
    provider: log.provider,
    endpoint: log.endpoint,
    success: log.success,
    requestSummary: log.requestSummary,
    responseSummary: log.responseSummary,
    fieldsReturned: log.fieldsReturned,
    cost: log.cost,
    error: log.error,
    createdAt: log.createdAt.toISOString(),
  };
}

export function serializeProviderConfig(config: ProviderConfig): ProviderConfigInput & { id: string; createdAt: string; updatedAt: string } {
  return {
    id: config.id,
    provider: config.provider,
    enabled: config.enabled,
    priority: config.priority,
    costPerRequest: config.costPerRequest,
    costPerSuccessfulContact: config.costPerSuccessfulContact,
    dailyLimit: config.dailyLimit,
    monthlyLimit: config.monthlyLimit,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}
