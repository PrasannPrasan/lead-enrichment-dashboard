import type { ConfidenceMap, LeadEnrichment, LeadField, ProviderLookupResult, SourceMap } from "@/lib/types";

const FIELD_KEYS: LeadField[] = [
  "fullName",
  "currentCompany",
  "currentDesignation",
  "totalYearsExperience",
  "emails",
  "phones",
  "workHistory",
];

function valuesAgree(left: unknown, right: unknown) {
  if (left == null || right == null) {
    return false;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return false;
  }

  return String(left).trim().toLowerCase() === String(right).trim().toLowerCase();
}

function mergeUnique(left: string[] = [], right: string[] = []) {
  return Array.from(new Set([...left, ...right].filter(Boolean).map((item) => item.trim()))).filter(Boolean);
}

export function mergeProviderResult(
  current: LeadEnrichment,
  confidence: ConfidenceMap,
  sources: SourceMap,
  result: ProviderLookupResult,
) {
  const incoming = result.data ?? {};
  const next: LeadEnrichment = { ...current };
  const nextConfidence: ConfidenceMap = { ...confidence };
  const nextSources: SourceMap = { ...sources };

  for (const field of FIELD_KEYS) {
    const incomingValue = incoming[field as keyof LeadEnrichment];
    if (incomingValue == null || (Array.isArray(incomingValue) && incomingValue.length === 0)) {
      continue;
    }

    const existingValue = next[field as keyof LeadEnrichment];
    const providerScore = result.confidence?.[field] ?? 60;

    if (field === "emails" || field === "phones") {
      const merged = mergeUnique(existingValue as string[] | undefined, incomingValue as string[]);
      next[field] = merged as never;
      nextConfidence[field] = Math.max(nextConfidence[field] ?? 0, providerScore);
    } else if (field === "workHistory") {
      next.workHistory = incomingValue as never;
      nextConfidence.workHistory = Math.max(nextConfidence.workHistory ?? 0, providerScore);
    } else if (existingValue == null || existingValue === "") {
      next[field] = incomingValue as never;
      nextConfidence[field] = Math.max(nextConfidence[field] ?? 0, providerScore);
    } else if (valuesAgree(existingValue, incomingValue)) {
      nextConfidence[field] = Math.max(nextConfidence[field] ?? 0, 75, providerScore);
    } else if ((nextConfidence[field] ?? 0) < providerScore) {
      next[field] = incomingValue as never;
      nextConfidence[field] = providerScore;
    }

    nextSources[field] = Array.from(new Set([...(nextSources[field] ?? []), result.provider]));
  }

  return {
    data: next,
    confidence: nextConfidence,
    sources: nextSources,
  };
}

export function hasGoodEnoughLead(data: LeadEnrichment, confidence: ConfidenceMap) {
  const hasProfile =
    Boolean(data.fullName) &&
    Boolean(data.currentCompany) &&
    Boolean(data.currentDesignation) &&
    Boolean(data.workHistory?.length);

  const profileConfidence =
    (confidence.fullName ?? 0) >= 75 &&
    (confidence.currentCompany ?? 0) >= 60 &&
    (confidence.currentDesignation ?? 0) >= 60;

  const hasContact = Boolean(data.emails?.length) || Boolean(data.phones?.length);

  return hasProfile && profileConfidence && hasContact;
}

export function legalContactReturned(data: LeadEnrichment) {
  return Boolean(data.emails?.length || data.phones?.length);
}
