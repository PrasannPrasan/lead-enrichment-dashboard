import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({
      ok: true,
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        database: "unavailable",
        error: error instanceof Error ? error.message : "Database health check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
