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

type HunterFinderResponse = {
  data?: {
    email?: string;
    score?: number;
    verification?: {
      status?: string;
    };
  };
};

type HunterVerifierResponse = {
  data?: {
    email?: string;
    status?: string;
    score?: number;
  };
};

function splitName(fullName?: string | null) {
  const [firstName, ...rest] = (fullName ?? "").split(/\s+/).filter(Boolean);
  return {
    firstName,
    lastName: rest.join(" "),
  };
}

export async function lookupHunter(context: ProviderLookupContext): Promise<ProviderLookupResult> {
  const endpoint = "https://api.hunter.io/v2/email-finder";

  if (isMockMode(context.enrichmentMode)) {
    const identity = demoIdentityFromLinkedIn(context.linkedinUrl);
    const email = context.current.emails?.[0] ?? `${identity.first}.${identity.last}@${identity.domain}`.toLowerCase();
    const data = {
      emails: [email],
    };

    return {
      provider: "hunter",
      endpoint: "mock:hunter-email-verifier",
      success: true,
      data,
      fieldsReturned: ["emails"],
      requestSummary: { linkedinUrl: context.linkedinUrl, mode: "mock" },
      responseSummary: { verificationStatus: "valid", score: 96 },
      confidence: {
        emails: 95,
      },
      cost: 0,
    };
  }

  const apiKey = await getProviderApiKey("hunter");

  if (!apiKey) {
    return missingApiKey("hunter", "HUNTER_API_KEY", endpoint);
  }

  try {
    const currentEmail = context.current.emails?.[0];

    if (currentEmail) {
      const params = new URLSearchParams({
        email: currentEmail,
        api_key: apiKey,
      });
      const verification = await fetchJson<HunterVerifierResponse>(
        `https://api.hunter.io/v2/email-verifier?${params.toString()}`,
      );
      const valid = verification.data?.status === "valid";
      const data = valid ? { emails: [currentEmail] } : {};

      return {
        provider: "hunter",
        endpoint: "https://api.hunter.io/v2/email-verifier",
        success: valid,
        data,
        fieldsReturned: valid ? ["emails"] : [],
        requestSummary: { email: currentEmail },
        responseSummary: { status: verification.data?.status, score: verification.data?.score },
        confidence: { emails: valid ? 95 : 45 },
        cost: calculateConfiguredCost(context.config, data),
        error: valid ? undefined : "Email could not be verified",
      };
    }

    const { firstName, lastName } = splitName(context.current.fullName);
    const domain = inferCompanyDomain(context.current.currentCompany);

    if (!firstName || !domain) {
      return {
        provider: "hunter",
        endpoint,
        success: false,
        skipped: true,
        fieldsReturned: [],
        requestSummary: { linkedinUrl: context.linkedinUrl },
        responseSummary: { skipped: true },
        cost: 0,
        error: "Hunter skipped because name or company domain is unavailable",
      };
    }

    const params = new URLSearchParams({
      domain,
      first_name: firstName,
      last_name: lastName,
      api_key: apiKey,
    });
    const payload = await fetchJson<HunterFinderResponse>(`${endpoint}?${params.toString()}`);
    const email = payload.data?.email;
    const verified = payload.data?.verification?.status === "valid" || (payload.data?.score ?? 0) >= 90;
    const data = email ? { emails: [email] } : {};

    return {
      provider: "hunter",
      endpoint,
      success: Boolean(email),
      data,
      fieldsReturned: email ? ["emails"] : [],
      requestSummary: { domain, firstName, lastName },
      responseSummary: { score: payload.data?.score, verificationStatus: payload.data?.verification?.status },
      confidence: { emails: verified ? 95 : 60 },
      cost: calculateConfiguredCost(context.config, data),
      error: email ? undefined : "Hunter did not return an email",
    };
  } catch (error) {
    return {
      provider: "hunter",
      endpoint,
      success: false,
      fieldsReturned: [],
      requestSummary: { linkedinUrl: context.linkedinUrl },
      responseSummary: {},
      cost: context.config.costPerRequest,
      error: error instanceof Error ? error.message : "Hunter request failed",
    };
  }
}
