import { z } from "zod";

import { jsonError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { getEnrichmentMode, setEnrichmentMode } from "@/lib/settings/enrichment-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const modeSchema = z.object({
  mode: z.enum(["live", "mock"]),
});

export async function GET() {
  try {
    await requireAdmin();
    const mode = await getEnrichmentMode();

    return Response.json({
      mode,
    });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "Unauthorized";
    return jsonError(error instanceof Error ? error.message : "Unable to load enrichment mode", unauthorized ? 401 : 500);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = modeSchema.parse(await request.json());
    const setting = await setEnrichmentMode(body.mode);

    return Response.json({
      mode: setting.value,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid enrichment mode", 422, error.flatten());
    }

    const unauthorized = error instanceof Error && error.message === "Unauthorized";
    return jsonError(error instanceof Error ? error.message : "Unable to update enrichment mode", unauthorized ? 401 : 400);
  }
}
