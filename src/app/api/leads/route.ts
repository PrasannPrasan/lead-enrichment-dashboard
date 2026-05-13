import { getCurrentAdmin } from "@/lib/auth/session";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeLead } from "@/lib/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();

  const leads = await prisma.lead.findMany({
    where: search
      ? {
          OR: [
            { linkedinUrl: { contains: search, mode: "insensitive" } },
            { fullName: { contains: search, mode: "insensitive" } },
            { currentCompany: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: {
      updatedAt: "desc",
    },
    take: 250,
  });

  return Response.json({
    leads: leads.map((lead) => serializeLead(lead)),
  });
}
