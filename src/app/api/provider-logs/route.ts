import { getCurrentAdmin } from "@/lib/auth/session";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeProviderLog } from "@/lib/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") ?? undefined;

  const logs = await prisma.providerLog.findMany({
    where: provider ? { provider } : undefined,
    orderBy: {
      createdAt: "desc",
    },
    take: 250,
  });

  return Response.json({
    logs: logs.map((log) => serializeProviderLog(log)),
  });
}
