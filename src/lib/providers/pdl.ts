import "server-only";

import { getProviderApiKey } from "@/lib/integrations/credentials";
import type { ProviderLookupContext, ProviderLookupResult, WorkHistoryItem } from "@/lib/types";
import {
  calculateConfiguredCost,
  demoIdentityFromLinkedIn,
  demoWorkHistory,
  fetchJson,
  isMockMode,
  missingApiKey,
} from "@/lib/providers/shared";

type PdlProfile = {
  full_name?: string;
  job_title?: string;
  job_company_name?: string;
  work_email?: string;
  personal_emails?: string[];
  phone_numbers?: string[];
  experience?: Array<{
    company?: { name?: string };
    title?: { name?: string };
    start_date?: string;
    end_date?: string;
    summary?: string;
  }>;
};

function mapExperience(experience?: PdlProfile["experience"]): WorkHistoryItem[] {
  return (experience ?? [])
    .map((item) => ({
      company: item.company?.name ?? "",
      title: item.title?.name ?? "",
      startDate: item.start_date ?? null,
      endDate: item.end_date ?? null,
      description: item.summary ?? null,
    }))
    .filter((item) => item.company || item.title)
    .slice(0, 8);
}

export async function lookupPdl(context: ProviderLookupContext): Promise<ProviderLookupResult> {
  const apiKey = await getProviderApiKey("pdl");
  const endpoint = "https://api.peopledatalabs.com/v5/person/enrich";

  if (!apiKey) {
    if (!isMockMode()) {
      return missingApiKey("pdl", "PDL_API_KEY", endpoint);
    }

    const identity = demoIdentityFromLinkedIn(context.linkedinUrl);
    const data = {
      fullName: context.current.fullName ?? identity.fullName,
      currentCompany: context.current.currentCompany ?? identity.company,
      currentDesignation: context.current.currentDesignation ?? identity.title,
      emails: context.current.emails?.length ? context.current.emails : [`${identity.first[0]}${identity.last}@${identity.domain}`.toLowerCase()],
      workHistory: context.current.workHistory?.length ? context.current.workHistory : demoWorkHistory(context.linkedinUrl),
    };

    return {
      provider: "pdl",
      endpoint: "mock:pdl-person-enrich",
      success: true,
      data,
      fieldsReturned: ["fullName", "currentCompany", "currentDesignation", "emails", "workHistory"],
      requestSummary: { linkedinUrl: context.linkedinUrl, mode: "mock" },
      responseSummary: { matched: true },
      confidence: {
        fullName: 60,
        currentCompany: 60,
        currentDesignation: 60,
        emails: 60,
        workHistory: 60,
      },
      cost: calculateConfiguredCost(context.config, data),
    };
  }

  try {
    const params = new URLSearchParams({
      profile: context.linkedinUrl,
    });
    const payload = await fetchJson<PdlProfile>(`${endpoint}?${params.toString()}`, {
      headers: {
        "X-Api-Key": apiKey,
      },
    });
    const emails = [payload.work_email, ...(payload.personal_emails ?? [])].filter(Boolean) as string[];
    const data = {
      fullName: payload.full_name ?? null,
      currentCompany: payload.job_company_name ?? null,
      currentDesignation: payload.job_title ?? null,
      emails,
      phones: payload.phone_numbers ?? [],
      workHistory: mapExperience(payload.experience),
    };
    const fieldsReturned = [
      data.fullName ? "fullName" : null,
      data.currentCompany ? "currentCompany" : null,
      data.currentDesignation ? "currentDesignation" : null,
      data.emails.length ? "emails" : null,
      data.phones.length ? "phones" : null,
      data.workHistory.length ? "workHistory" : null,
    ].filter(Boolean) as ProviderLookupResult["fieldsReturned"];
    const hasUsableFields = fieldsReturned.length > 0;

    return {
      provider: "pdl",
      endpoint,
      success: hasUsableFields,
      data,
      fieldsReturned,
      requestSummary: { linkedinUrl: context.linkedinUrl },
      responseSummary: {
        emailCount: emails.length,
        phoneCount: data.phones.length,
        experienceCount: data.workHistory.length,
        hasUsableFields,
      },
      confidence: {
        fullName: 60,
        currentCompany: 60,
        currentDesignation: 60,
        emails: 60,
        phones: 60,
        workHistory: 60,
      },
      cost: calculateConfiguredCost(context.config, data),
      error: hasUsableFields ? undefined : "People Data Labs returned no usable lead fields for this profile",
    };
  } catch (error) {
    return {
      provider: "pdl",
      endpoint,
      success: false,
      fieldsReturned: [],
      requestSummary: { linkedinUrl: context.linkedinUrl },
      responseSummary: {},
      cost: context.config.costPerRequest,
      error: error instanceof Error ? error.message : "People Data Labs request failed",
    };
  }
}
