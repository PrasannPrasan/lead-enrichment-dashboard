import "server-only";

import type { ProviderName } from "@/lib/types";

export type ManagedIntegrationProvider = Extract<ProviderName, "apollo" | "hunter" | "ninjapear" | "pdl">;

export type IntegrationDefinition = {
  provider: ManagedIntegrationProvider;
  label: string;
  description: string;
  envNames: string[];
};

export const API_INTEGRATIONS: IntegrationDefinition[] = [
  {
    provider: "ninjapear",
    label: "NinjaPear / Nubela",
    description: "Profile and work-history enrichment through Nubela's NinjaPear endpoint.",
    envNames: ["NINJAPEAR_API_KEY", "PROXYCURL_API_KEY"],
  },
  {
    provider: "apollo",
    label: "Apollo",
    description: "Email, company, and title enrichment.",
    envNames: ["APOLLO_API_KEY"],
  },
  {
    provider: "hunter",
    label: "Hunter",
    description: "Email finder and email verifier.",
    envNames: ["HUNTER_API_KEY"],
  },
  {
    provider: "pdl",
    label: "People Data Labs",
    description: "Fallback person enrichment provider.",
    envNames: ["PDL_API_KEY"],
  },
];

export function getIntegrationDefinition(provider: string) {
  return API_INTEGRATIONS.find((definition) => definition.provider === provider);
}

export function getEnvKeyForProvider(provider: ManagedIntegrationProvider) {
  const definition = getIntegrationDefinition(provider);

  if (!definition) {
    return null;
  }

  for (const envName of definition.envNames) {
    const value = process.env[envName]?.trim();

    if (value) {
      return {
        value,
        envName,
      };
    }
  }

  return null;
}
