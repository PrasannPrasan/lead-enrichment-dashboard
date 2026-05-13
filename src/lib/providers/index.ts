import type { ProviderLookupContext, ProviderLookupResult, ProviderName } from "@/lib/types";
import { lookupApollo } from "@/lib/providers/apollo";
import { lookupHunter } from "@/lib/providers/hunter";
import { lookupPdl } from "@/lib/providers/pdl";
import { lookupProxycurl } from "@/lib/providers/proxycurl";
import { lookupTwilio } from "@/lib/providers/twilio";

export type ProviderAdapter = (context: ProviderLookupContext) => Promise<ProviderLookupResult>;

export const PROVIDER_ADAPTERS: Partial<Record<ProviderName, ProviderAdapter>> = {
  proxycurl: lookupProxycurl,
  apollo: lookupApollo,
  hunter: lookupHunter,
  pdl: lookupPdl,
  twilio: lookupTwilio,
};
