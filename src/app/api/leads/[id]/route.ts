import { getCurrentAdmin } from "@/lib/auth/session";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeLead, serializeProviderLog } from "@/lib/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  const { id } = await context.params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      providerLogs: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!lead) {
    return jsonError("Lead not found", 404);
  }

  return Response.json({
    lead: serializeLead(lead),
    logs: lead.providerLogs.map((log) => serializeProviderLog(log)),
  });
}
