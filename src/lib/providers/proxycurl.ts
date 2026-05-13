import "server-only";

import type { ProviderLookupContext, ProviderLookupResult, WorkHistoryItem } from "@/lib/types";
import {
  calculateConfiguredCost,
  demoIdentityFromLinkedIn,
  demoWorkHistory,
  fetchJson,
  isMockMode,
  missingApiKey,
} from "@/lib/providers/shared";

type ProxycurlExperience = {
  company?: string;
  company_name?: string;
  title?: string;
  starts_at?: { year?: number; month?: number; day?: number };
  ends_at?: { year?: number; month?: number; day?: number } | null;
  description?: string;
};

type ProxycurlProfile = {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  occupation?: string;
  headline?: string;
  experiences?: ProxycurlExperience[];
};

function formatProxycurlDate(value?: ProxycurlExperience["starts_at"]) {
  if (!value?.year) {
    return null;
  }

  return `${value.year}-${String(value.month ?? 1).padStart(2, "0")}`;
}

function mapWorkHistory(experiences?: ProxycurlExperience[]): WorkHistoryItem[] {
  return (experiences ?? [])
    .map((experience) => ({
      company: experience.company ?? experience.company_name ?? "",
      title: experience.title ?? "",
      startDate: formatProxycurlDate(experience.starts_at),
      endDate: formatProxycurlDate(experience.ends_at ?? undefined),
      description: experience.description ?? null,
    }))
    .filter((experience) => experience.company || experience.title)
    .slice(0, 8);
}

export async function lookupProxycurl(context: ProviderLookupContext): Promise<ProviderLookupResult> {
  const apiKey = process.env.PROXYCURL_API_KEY;
  const endpoint = "https://nubela.co/proxycurl/api/v2/linkedin";

  if (!apiKey) {
    if (!isMockMode()) {
      return missingApiKey("proxycurl", "PROXYCURL_API_KEY", endpoint);
    }

    const identity = demoIdentityFromLinkedIn(context.linkedinUrl);
    const data = {
      fullName: identity.fullName,
      currentCompany: identity.company,
      currentDesignation: identity.title,
      totalYearsExperience: 7.5,
      workHistory: demoWorkHistory(context.linkedinUrl),
    };

    return {
      provider: "proxycurl",
      endpoint: "mock:proxycurl-profile",
      success: true,
      data,
      fieldsReturned: ["fullName", "currentCompany", "currentDesignation", "totalYearsExperience", "workHistory"],
      requestSummary: { linkedinUrl: context.linkedinUrl, mode: "mock" },
      responseSummary: { profileMatch: true },
      confidence: {
        fullName: 85,
        currentCompany: 85,
        currentDesignation: 85,
        totalYearsExperience: 85,
        workHistory: 85,
      },
      sources: {
        fullName: ["proxycurl"],
        currentCompany: ["proxycurl"],
        currentDesignation: ["proxycurl"],
        totalYearsExperience: ["proxycurl"],
        workHistory: ["proxycurl"],
      },
      cost: calculateConfiguredCost(context.config, data),
    };
  }

  try {
    const params = new URLSearchParams({
      url: context.linkedinUrl,
      fallback_to_cache: "on-error",
      use_cache: "if-present",
      skills: "include",
    });
    const profile = await fetchJson<ProxycurlProfile>(`${endpoint}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const workHistory = mapWorkHistory(profile.experiences);
    const currentExperience = workHistory[0];
    const fullName = profile.full_name ?? ([profile.first_name, profile.last_name].filter(Boolean).join(" ") || null);
    const data = {
      fullName,
      currentCompany: currentExperience?.company ?? null,
      currentDesignation: currentExperience?.title ?? profile.occupation ?? profile.headline ?? null,
      workHistory,
      totalYearsExperience: workHistory.length ? Math.max(workHistory.length * 2, 1) : null,
    };

    return {
      provider: "proxycurl",
      endpoint,
      success: true,
      data,
      fieldsReturned: ["fullName", "currentCompany", "currentDesignation", "totalYearsExperience", "workHistory"].filter(
        (field) => Boolean(data[field as keyof typeof data]),
      ) as ProviderLookupResult["fieldsReturned"],
      requestSummary: { linkedinUrl: context.linkedinUrl },
      responseSummary: { hasProfile: Boolean(fullName), experienceCount: workHistory.length },
      confidence: {
        fullName: 85,
        currentCompany: 85,
        currentDesignation: 85,
        totalYearsExperience: 85,
        workHistory: 85,
      },
      cost: calculateConfiguredCost(context.config, data),
    };
  } catch (error) {
    return {
      provider: "proxycurl",
      endpoint,
      success: false,
      fieldsReturned: [],
      requestSummary: { linkedinUrl: context.linkedinUrl },
      responseSummary: {},
      cost: context.config.costPerRequest,
      error: error instanceof Error ? error.message : "Proxycurl request failed",
    };
  }
}
