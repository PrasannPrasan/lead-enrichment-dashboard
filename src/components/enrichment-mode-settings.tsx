"use client";

import { useEffect, useState } from "react";
import { DatabaseZap, Loader2, Save, Server } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EnrichmentMode } from "@/lib/types";

type ModeResponse = {
  mode: EnrichmentMode;
  error?: string;
};

const MODE_COPY: Record<EnrichmentMode, { label: string; description: string }> = {
  live: {
    label: "Live API enrichment",
    description: "Calls enabled providers server-side and uses real API keys, budgets, logs, and cache.",
  },
  mock: {
    label: "Mock data",
    description: "Returns generated demo data from mock adapters and does not call paid provider APIs.",
  },
};

export function EnrichmentModeSettings() {
  const [savedMode, setSavedMode] = useState<EnrichmentMode>("live");
  const [selectedMode, setSelectedMode] = useState<EnrichmentMode>("live");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadMode() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/enrichment-mode", { cache: "no-store" });
      const payload = (await response.json()) as ModeResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load enrichment mode");
      }

      setSavedMode(payload.mode);
      setSelectedMode(payload.mode);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load enrichment mode");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMode();
  }, []);

  async function saveMode() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/enrichment-mode", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: selectedMode }),
      });
      const payload = (await response.json()) as ModeResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update enrichment mode");
      }

      setSavedMode(payload.mode);
      setSelectedMode(payload.mode);
      setMessage(`Enrichment mode set to ${MODE_COPY[payload.mode].label}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update enrichment mode");
    } finally {
      setSaving(false);
    }
  }

  const dirty = selectedMode !== savedMode;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <CardTitle>Enrichment Mode</CardTitle>
            <CardDescription>Choose whether lookups use generated demo data or live provider APIs.</CardDescription>
          </div>
          <Badge variant={savedMode === "mock" ? "warning" : "success"}>{MODE_COPY[savedMode].label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading enrichment mode
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              {(["live", "mock"] as EnrichmentMode[]).map((mode) => {
                const selected = selectedMode === mode;
                const Icon = mode === "live" ? Server : DatabaseZap;

                return (
                  <button
                    key={mode}
                    type="button"
                    className={`rounded-md border p-4 text-left transition-colors ${
                      selected ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                    }`}
                    onClick={() => setSelectedMode(mode)}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="font-semibold">{MODE_COPY[mode].label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{MODE_COPY[mode].description}</p>
                  </button>
                );
              })}
            </div>

            {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
            {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

            <div className="flex justify-end">
              <Button type="button" disabled={!dirty || saving} onClick={() => void saveMode()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Mode
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
