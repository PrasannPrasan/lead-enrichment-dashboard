import "server-only";

import type { LeadEnrichment, ProviderConfigInput, ProviderLookupResult, ProviderName, WorkHistoryItem } from "@/lib/types";
import { toTitleCase } from "@/lib/utils";

export function isMockMode() {
  return process.env.MOCK_PROVIDER_MODE === "true";
}

export function missingApiKey(provider: ProviderName, keyName: string, endpoint: string): ProviderLookupResult {
  return {
    provider,
    endpoint,
    success: false,
    skipped: true,
    fieldsReturned: [],
    requestSummary: { keyName },
    responseSummary: { skipped: true },
    cost: 0,
    error: `${keyName} is not configured`,
  };
}

export function calculateConfiguredCost(config: ProviderConfigInput, data?: LeadEnrichment) {
  const contactReturned = Boolean(data?.emails?.length || data?.phones?.length);
  return config.costPerRequest + (contactReturned ? config.costPerSuccessfulContact : 0);
}

export function demoIdentityFromLinkedIn(linkedinUrl: string) {
  const parts = linkedinUrl.split("/").filter(Boolean);
  const slug = parts.at(-1)?.replace(/[^a-zA-Z0-9-_.]/g, "") || "sample-lead";
  const name = toTitleCase(slug.replace(/^\w{1,2}-/, ""));
  const [first = "Sample", last = "Lead"] = name.split(" ");
  const company = "Northstar Revenue";

  return {
    slug,
    fullName: `${first} ${last}`.trim(),
    first,
    last,
    company,
    title: "Revenue Operations Lead",
    domain: "northstar.example",
  };
}

export function demoWorkHistory(linkedinUrl: string): WorkHistoryItem[] {
  const identity = demoIdentityFromLinkedIn(linkedinUrl);

  return [
    {
      company: identity.company,
      title: identity.title,
      startDate: "2022-03",
      endDate: null,
      description: "Owns pipeline operations, enrichment workflows, and GTM systems.",
    },
    {
      company: "Atlas Cloud",
      title: "Sales Operations Manager",
      startDate: "2018-08",
      endDate: "2022-02",
      description: "Managed CRM hygiene, territory planning, and sales tooling.",
    },
  ];
}

export function inferCompanyDomain(company?: string | null) {
  if (!company) {
    return null;
  }

  const slug = company
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

  return slug ? `${slug}.com` : null;
}

export async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 400)}`);
    }

    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function summarizeObject(value: Record<string, unknown>, allowedKeys: string[]) {
  return Object.fromEntries(allowedKeys.map((key) => [key, value[key]]).filter(([, item]) => item !== undefined));
}
