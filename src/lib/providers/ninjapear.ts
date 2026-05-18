import "server-only";

import { getProviderApiKey } from "@/lib/integrations/credentials";
import type { LeadEnrichment, ProviderLookupContext, ProviderLookupResult, WorkHistoryItem } from "@/lib/types";
import {
  calculateConfiguredCost,
  demoIdentityFromLinkedIn,
  demoWorkHistory,
  fetchJson,
  inferCompanyDomain,
  isMockMode,
  missingApiKey,
} from "@/lib/providers/shared";

type NinjaPearWorkExperience = {
  role?: string | null;
  company_name?: string | null;
  company_website?: string | null;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

type NinjaPearProfile = {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  work_experience?: NinjaPearWorkExperience[];
};

function splitName(fullName?: string | null) {
  const [firstName, ...rest] = (fullName ?? "").split(/\s+/).filter(Boolean);

  return {
    firstName,
    lastName: rest.join(" "),
  };
}

function mapWorkHistory(experiences?: NinjaPearWorkExperience[]): WorkHistoryItem[] {
  return (experiences ?? [])
    .map((experience) => ({
      company: experience.company_name ?? experience.company_website ?? "",
      title: experience.role ?? "",
      startDate: experience.start_date ?? null,
      endDate: experience.end_date ?? null,
      description: experience.description ?? null,
    }))
    .filter((experience) => experience.company || experience.title)
    .slice(0, 8);
}

function estimateExperienceYears(workHistory: WorkHistoryItem[]) {
  const datedRoles = workHistory
    .map((role) => role.startDate)
    .filter((date): date is string => Boolean(date))
    .map((date) => new Date(`${date.length === 7 ? `${date}-01` : date}`))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (!datedRoles.length) {
    return null;
  }

  const earliest = datedRoles.sort((left, right) => left.getTime() - right.getTime())[0];
  const years = (Date.now() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

  return Math.max(Math.round(years * 10) / 10, 0);
}

function buildProfileParams(current: LeadEnrichment) {
  const params = new URLSearchParams();
  const workEmail = current.emails?.[0];

  if (workEmail) {
    params.set("work_email", workEmail);
  }

  const { firstName, lastName } = splitName(current.fullName);
  const employer = inferCompanyDomain(current.currentCompany) ?? current.currentCompany;
  const role = current.currentDesignation;

  if (firstName && employer) {
    params.set("first_name", firstName);
    if (lastName) {
      params.set("last_name", lastName);
    }
    params.set("employer_website", employer);
    if (role) {
      params.set("role", role);
    }
  } else if (employer && role) {
    params.set("employer_website", employer);
    params.set("role", role);
  }

  params.set("use_cache", "if-recent");

  if (!params.has("work_email") && !params.has("employer_website")) {
    return null;
  }

  return params;
}

export async function lookupNinjaPear(context: ProviderLookupContext): Promise<ProviderLookupResult> {
  const endpoint = "https://nubela.co/api/v1/employee/profile";

  if (isMockMode(context.enrichmentMode)) {
    const identity = demoIdentityFromLinkedIn(context.linkedinUrl);
    const data = {
      fullName: identity.fullName,
      currentCompany: identity.company,
      currentDesignation: identity.title,
      totalYearsExperience: 7.5,
      workHistory: demoWorkHistory(context.linkedinUrl),
    };

    return {
      provider: "ninjapear",
      endpoint: "mock:ninjapear-profile",
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
      cost: 0,
    };
  }

  const apiKey = await getProviderApiKey("ninjapear");

  if (!apiKey) {
    return missingApiKey("ninjapear", "NINJAPEAR_API_KEY/PROXYCURL_API_KEY", endpoint);
  }

  const params = buildProfileParams(context.current);

  if (!params) {
    return {
      provider: "ninjapear",
      endpoint,
      success: false,
      skipped: true,
      fieldsReturned: [],
      requestSummary: { linkedinUrl: context.linkedinUrl },
      responseSummary: { skipped: true },
      cost: 0,
      error:
        "NinjaPear skipped because its profile endpoint requires work_email, first_name + employer_website, or employer_website + role. LinkedIn URL alone is not supported.",
    };
  }

  try {
    const profile = await fetchJson<NinjaPearProfile>(`${endpoint}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const workHistory = mapWorkHistory(profile.work_experience);
    const currentExperience = workHistory.find((role) => !role.endDate) ?? workHistory[0];
    const fullName =
      profile.full_name ?? ([profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ") || null);
    const data = {
      fullName,
      currentCompany: currentExperience?.company ?? null,
      currentDesignation: currentExperience?.title ?? null,
      workHistory,
      totalYearsExperience: estimateExperienceYears(workHistory),
      emails: params.get("work_email") ? [params.get("work_email") as string] : [],
    };

    return {
      provider: "ninjapear",
      endpoint,
      success: true,
      data,
      fieldsReturned: [
        data.fullName ? "fullName" : null,
        data.currentCompany ? "currentCompany" : null,
        data.currentDesignation ? "currentDesignation" : null,
        data.totalYearsExperience ? "totalYearsExperience" : null,
        data.workHistory.length ? "workHistory" : null,
        data.emails.length ? "emails" : null,
      ].filter(Boolean) as ProviderLookupResult["fieldsReturned"],
      requestSummary: {
        inputMode: params.has("work_email") ? "work_email" : "name_or_role_with_employer",
      },
      responseSummary: {
        hasProfile: Boolean(fullName),
        experienceCount: workHistory.length,
      },
      confidence: {
        fullName: params.has("work_email") ? 85 : 60,
        currentCompany: 60,
        currentDesignation: 60,
        totalYearsExperience: 60,
        workHistory: 60,
        emails: params.has("work_email") ? 95 : 0,
      },
      cost: calculateConfiguredCost(context.config, data),
    };
  } catch (error) {
    return {
      provider: "ninjapear",
      endpoint,
      success: false,
      fieldsReturned: [],
      requestSummary: { linkedinUrl: context.linkedinUrl },
      responseSummary: {},
      cost: context.config.costPerRequest,
      error: error instanceof Error ? error.message : "NinjaPear request failed",
    };
  }
}
