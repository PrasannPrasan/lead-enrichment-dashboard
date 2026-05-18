import "server-only";

import { prisma } from "@/lib/prisma";
import type { EnrichmentMode } from "@/lib/types";

export const ENRICHMENT_MODE_SETTING_KEY = "enrichment.mode";

function envDefaultMode(): EnrichmentMode {
  return process.env.MOCK_PROVIDER_MODE === "true" ? "mock" : "live";
}

export function normalizeEnrichmentMode(value: unknown): EnrichmentMode | null {
  return value === "mock" || value === "live" ? value : null;
}

export async function getEnrichmentMode(): Promise<EnrichmentMode> {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: ENRICHMENT_MODE_SETTING_KEY,
    },
  });

  return normalizeEnrichmentMode(setting?.value) ?? envDefaultMode();
}

export async function setEnrichmentMode(mode: EnrichmentMode) {
  return prisma.appSetting.upsert({
    where: {
      key: ENRICHMENT_MODE_SETTING_KEY,
    },
    create: {
      key: ENRICHMENT_MODE_SETTING_KEY,
      value: mode,
    },
    update: {
      value: mode,
    },
  });
}
