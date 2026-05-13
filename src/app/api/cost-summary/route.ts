import { getCurrentAdmin } from "@/lib/auth/session";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  const [leadCost, leadCount, successfulLeadCount, providerGroups] = await Promise.all([
    prisma.lead.aggregate({
      _sum: {
        totalCost: true,
      },
    }),
    prisma.lead.count(),
    prisma.lead.count({
      where: {
        OR: [{ fullName: { not: null } }, { emails: { not: [] } }],
      },
    }),
    prisma.providerLog.groupBy({
      by: ["provider", "success"],
      _count: {
        _all: true,
      },
      _sum: {
        cost: true,
      },
    }),
  ]);

  const totalCost = leadCost._sum.totalCost ?? 0;

  return Response.json({
    totalCost,
    leadCount,
    successfulLeadCount,
    costPerSuccessfulLead: successfulLeadCount ? totalCost / successfulLeadCount : 0,
    providerStats: providerGroups.reduce<Record<string, { calls: number; successes: number; cost: number }>>((acc, group) => {
      acc[group.provider] ??= { calls: 0, successes: 0, cost: 0 };
      acc[group.provider].calls += group._count._all;
      acc[group.provider].successes += group.success ? group._count._all : 0;
      acc[group.provider].cost += group._sum.cost ?? 0;
      return acc;
    }, {}),
  });
}
