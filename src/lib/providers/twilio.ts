import "server-only";

import type { ProviderLookupContext, ProviderLookupResult } from "@/lib/types";
import { calculateConfiguredCost, fetchJson, isMockMode, missingApiKey } from "@/lib/providers/shared";

type TwilioLookupResponse = {
  phone_number?: string;
  valid?: boolean;
  validation_errors?: string[];
};

export async function lookupTwilio(context: ProviderLookupContext): Promise<ProviderLookupResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const endpoint = "https://lookups.twilio.com/v2/PhoneNumbers";
  const phone = context.current.phones?.[0];

  if (!phone) {
    return {
      provider: "twilio",
      endpoint,
      success: false,
      skipped: true,
      fieldsReturned: [],
      requestSummary: { linkedinUrl: context.linkedinUrl },
      responseSummary: { skipped: true },
      cost: 0,
      error: "Twilio Lookup skipped because no phone number was returned by an enrichment provider",
    };
  }

  if (!accountSid || !authToken) {
    if (!isMockMode()) {
      return missingApiKey("twilio", "TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN", endpoint);
    }

    const data = { phones: [phone] };
    return {
      provider: "twilio",
      endpoint: "mock:twilio-lookup",
      success: true,
      data,
      fieldsReturned: ["phones"],
      requestSummary: { phone, mode: "mock" },
      responseSummary: { valid: true },
      confidence: { phones: 95 },
      cost: calculateConfiguredCost(context.config, data),
    };
  }

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const payload = await fetchJson<TwilioLookupResponse>(`${endpoint}/${encodeURIComponent(phone)}`, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    const valid = payload.valid !== false && !payload.validation_errors?.length;
    const data = valid ? { phones: [payload.phone_number ?? phone] } : {};

    return {
      provider: "twilio",
      endpoint,
      success: valid,
      data,
      fieldsReturned: valid ? ["phones"] : [],
      requestSummary: { phone },
      responseSummary: { valid, validationErrors: payload.validation_errors ?? [] },
      confidence: { phones: valid ? 95 : 45 },
      cost: calculateConfiguredCost(context.config, data),
      error: valid ? undefined : "Twilio could not validate the phone number",
    };
  } catch (error) {
    return {
      provider: "twilio",
      endpoint,
      success: false,
      fieldsReturned: [],
      requestSummary: { phone },
      responseSummary: {},
      cost: context.config.costPerRequest,
      error: error instanceof Error ? error.message : "Twilio Lookup request failed",
    };
  }
}
