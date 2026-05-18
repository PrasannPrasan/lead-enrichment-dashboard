import "server-only";

import { getProviderApiKey } from "@/lib/integrations/credentials";
import type { ProviderLookupContext, ProviderLookupResult } from "@/lib/types";
import {
  calculateConfiguredCost,
  demoIdentityFromLinkedIn,
  fetchJson,
  inferCompanyDomain,
  isMockMode,
  missingApiKey,
} from "@/lib/providers/shared";

type ApolloPerson = {
  person?: {
    name?: string;
    title?: string;
    organization?: { name?: string };
    email?: string;
    email_status?: string;
  };
};

export async function lookupApollo(context: ProviderLookupContext): Promise<ProviderLookupResult> {
  const endpoint = "https://api.apollo.io/api/v1/people/match";

  if (isMockMode(context.enrichmentMode)) {
    const identity = demoIdentityFromLinkedIn(context.linkedinUrl);
    const data = {
      fullName: context.current.fullName ?? identity.fullName,
      currentCompany: context.current.currentCompany ?? identity.company,
      currentDesignation: context.current.currentDesignation ?? identity.title,
      emails: [`${identity.first}.${identity.last}@${identity.domain}`.toLowerCase()],
    };

    return {
      provider: "apollo",
      endpoint: "mock:apollo-people-match",
      success: true,
      data,
      fieldsReturned: ["fullName", "currentCompany", "currentDesignation", "emails"],
      requestSummary: { linkedinUrl: context.linkedinUrl, mode: "mock" },
      responseSummary: { emailStatus: "likely" },
      confidence: {
        fullName: 75,
        currentCompany: 75,
        currentDesignation: 75,
        emails: 60,
      },
      cost: 0,
    };
  }

  const apiKey = await getProviderApiKey("apollo");

  if (!apiKey) {
    return missingApiKey("apollo", "APOLLO_API_KEY", endpoint);
  }

  try {
    const payload = await fetchJson<ApolloPerson>(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify({
          linkedin_url: context.linkedinUrl,
          reveal_personal_emails: true,
        }),
      },
      20000,
    );

    const person = payload.person;
    const email = person?.email;
    const data = {
      fullName: person?.name ?? null,
      currentCompany: person?.organization?.name ?? null,
      currentDesignation: person?.title ?? null,
      emails: email ? [email] : [],
    };

    return {
      provider: "apollo",
      endpoint,
      success: true,
      data,
      fieldsReturned: [
        data.fullName ? "fullName" : null,
        data.currentCompany ? "currentCompany" : null,
        data.currentDesignation ? "currentDesignation" : null,
        data.emails.length ? "emails" : null,
      ].filter(Boolean) as ProviderLookupResult["fieldsReturned"],
      requestSummary: { linkedinUrl: context.linkedinUrl },
      responseSummary: { emailStatus: person?.email_status, companyDomain: inferCompanyDomain(person?.organization?.name) },
      confidence: {
        fullName: 60,
        currentCompany: 60,
        currentDesignation: 60,
        emails: person?.email_status === "verified" ? 95 : 60,
      },
      cost: calculateConfiguredCost(context.config, data),
    };
  } catch (error) {
    return {
      provider: "apollo",
      endpoint,
      success: false,
      fieldsReturned: [],
      requestSummary: { linkedinUrl: context.linkedinUrl },
      responseSummary: {},
      cost: context.config.costPerRequest,
      error: error instanceof Error ? error.message : "Apollo request failed",
    };
  }
}
