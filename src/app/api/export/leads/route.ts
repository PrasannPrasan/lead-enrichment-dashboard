import { getCurrentAdmin } from "@/lib/auth/session";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(value: unknown) {
  const text = value == null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  const leads = await prisma.lead.findMany({
    orderBy: {
      updatedAt: "desc",
    },
  });

  const headers = [
    "id",
    "linkedinUrl",
    "fullName",
    "currentCompany",
    "currentDesignation",
    "totalYearsExperience",
    "emails",
    "phones",
    "totalCost",
    "createdAt",
    "updatedAt",
  ];

  const rows = leads.map((lead) =>
    [
      lead.id,
      lead.linkedinUrl,
      lead.fullName,
      lead.currentCompany,
      lead.currentDesignation,
      lead.totalYearsExperience,
      lead.emails,
      lead.phones,
      lead.totalCost,
      lead.createdAt.toISOString(),
      lead.updatedAt.toISOString(),
    ]
      .map(csvEscape)
      .join(","),
  );

  return new Response([headers.join(","), ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
