import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth/options";
import { getClientIp, jsonError } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { enrichLead } from "@/lib/waterfall/enrichLead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const enrichSchema = z.object({
  linkedinUrl: z.string().min(1),
  forceRefresh: z.boolean().optional(),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limited = rateLimit(`enrich:${ip}`, 10, 60_000);

  if (!limited.allowed) {
    return jsonError("Too many enrichment requests. Try again shortly.", 429, {
      resetAt: new Date(limited.resetAt).toISOString(),
    });
  }

  try {
    const body = enrichSchema.parse(await request.json());

    if (body.forceRefresh) {
      const session = await getServerSession(authOptions);
      if (session?.user?.role !== "admin") {
        return jsonError("Only admins can force refresh a cached enrichment.", 401);
      }
    }

    const result = await enrichLead(body.linkedinUrl, {
      forceRefresh: body.forceRefresh,
    });

    return Response.json(result, {
      headers: {
        "x-ratelimit-remaining": String(limited.remaining),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid enrichment request", 422, error.flatten());
    }

    return jsonError(error instanceof Error ? error.message : "Unable to enrich lead", 500);
  }
}
