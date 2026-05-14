import { prisma } from "@/lib/prisma";
import type { ProviderConfigInput } from "@/lib/types";
import { DEFAULT_PROVIDER_CONFIGS } from "@/lib/cost-engine/defaults";

export async function ensureDefaultProviderConfigs() {
  const legacyProxycurl = await prisma.providerConfig.findUnique({
    where: { provider: "proxycurl" },
  });
  const existingNinjaPear = await prisma.providerConfig.findUnique({
    where: { provider: "ninjapear" },
  });

  if (legacyProxycurl && !existingNinjaPear) {
    await prisma.providerConfig.update({
      where: { provider: "proxycurl" },
      data: {
        provider: "ninjapear",
        priority: 3,
        costPerRequest: legacyProxycurl.costPerRequest || 0.03,
      },
    });
  } else if (legacyProxycurl && existingNinjaPear) {
    await prisma.providerConfig.update({
      where: { provider: "proxycurl" },
      data: {
        enabled: false,
      },
    });
  }

  await Promise.all(
    DEFAULT_PROVIDER_CONFIGS.map((config) =>
      prisma.providerConfig.upsert({
        where: { provider: config.provider },
        create: config,
        update: {},
      }),
    ),
  );

  return prisma.providerConfig.findMany({
    orderBy: [{ priority: "asc" }, { provider: "asc" }],
  });
}

export function calculateProviderCost(config: ProviderConfigInput, returnedContact: boolean) {
  return config.costPerRequest + (returnedContact ? config.costPerSuccessfulContact : 0);
}

export async function getProviderSpend(provider: string) {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [daily, monthly] = await Promise.all([
    prisma.providerLog.aggregate({
      where: {
        provider,
        createdAt: {
          gte: dayStart,
        },
      },
      _sum: {
        cost: true,
      },
    }),
    prisma.providerLog.aggregate({
      where: {
        provider,
        createdAt: {
          gte: monthStart,
        },
      },
      _sum: {
        cost: true,
      },
    }),
  ]);

  return {
    daily: daily._sum.cost ?? 0,
    monthly: monthly._sum.cost ?? 0,
  };
}

export async function isWithinBudget(config: ProviderConfigInput, expectedCost: number) {
  const spend = await getProviderSpend(config.provider);
  const dailyAllowed = config.dailyLimit == null || spend.daily + expectedCost <= config.dailyLimit;
  const monthlyAllowed = config.monthlyLimit == null || spend.monthly + expectedCost <= config.monthlyLimit;

  return {
    allowed: dailyAllowed && monthlyAllowed,
    dailySpend: spend.daily,
    monthlySpend: spend.monthly,
    reason: !dailyAllowed ? "Provider skipped due to daily budget" : !monthlyAllowed ? "Provider skipped due to monthly budget" : null,
  };
}
