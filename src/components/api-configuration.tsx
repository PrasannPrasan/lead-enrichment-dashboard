"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Save, Trash2, XCircle, Circle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type IntegrationStatus = "connected" | "invalid" | "not_configured";
type IntegrationProvider = "apollo" | "hunter" | "ninjapear" | "pdl";

type Integration = {
  provider: IntegrationProvider;
  label: string;
  description: string;
  envNames: string[];
  status: IntegrationStatus;
  source: "database" | "environment" | "none";
  keyHint: string | null;
  lastError: string | null;
  lastValidatedAt: string | null;
  fallbackAvailable: boolean;
};

function statusBadge(status: IntegrationStatus) {
  if (status === "connected") {
    return {
      label: "Connected",
      variant: "success" as const,
      icon: CheckCircle2,
    };
  }

  if (status === "invalid") {
    return {
      label: "Invalid",
      variant: "destructive" as const,
      icon: XCircle,
    };
  }

  return {
    label: "Not configured",
    variant: "outline" as const,
    icon: Circle,
  };
}

function keyHint(integration: Integration) {
  if (integration.source === "environment") {
    return `Using ${integration.keyHint ?? integration.envNames.join(" / ")}`;
  }

  if (integration.source === "database" && integration.keyHint) {
    return `Saved key ending ${integration.keyHint}`;
  }

  if (integration.fallbackAvailable) {
    return "Environment fallback available";
  }

  return "No saved key";
}

export function ApiConfiguration() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState<string | null>(null);

  const integrationRows = useMemo(() => integrations, [integrations]);

  async function loadIntegrations() {
    setLoading(true);

    try {
      const response = await fetch("/api/admin/api-keys", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load API configuration");
      }

      setIntegrations(payload.integrations);
      setStorageWarning(payload.storageAvailable === false ? payload.warning ?? "Encrypted API key storage is unavailable." : null);
    } catch (requestError) {
      setMessage(null);
      setRowErrors({ global: requestError instanceof Error ? requestError.message : "Unable to load API configuration" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadIntegrations();
  }, []);

  function patchIntegration(updated: Integration) {
    setIntegrations((current) => current.map((integration) => (integration.provider === updated.provider ? updated : integration)));
  }

  async function saveKey(event: FormEvent<HTMLFormElement>, provider: IntegrationProvider) {
    event.preventDefault();
    setSavingProvider(provider);
    setMessage(null);
    setRowErrors((current) => ({ ...current, [provider]: null, global: null }));

    try {
      const response = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          apiKey: keys[provider] ?? "",
        }),
      });
      const payload = await response.json();

      if (payload.integration) {
        patchIntegration(payload.integration);
      }

      if (!response.ok) {
        throw new Error(payload.error ?? "API key is invalid");
      }

      setKeys((current) => ({ ...current, [provider]: "" }));
      setMessage(`${payload.integration.label} connected.`);
    } catch (requestError) {
      setRowErrors((current) => ({
        ...current,
        [provider]: requestError instanceof Error ? requestError.message : "Unable to save API key",
      }));
    } finally {
      setSavingProvider(null);
    }
  }

  async function removeKey(provider: IntegrationProvider) {
    setSavingProvider(provider);
    setMessage(null);
    setRowErrors((current) => ({ ...current, [provider]: null, global: null }));

    try {
      const response = await fetch(`/api/admin/api-keys/${provider}`, {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to remove API key");
      }

      patchIntegration(payload.integration);
      setKeys((current) => ({ ...current, [provider]: "" }));
      setMessage(`${payload.integration.label} key removed.`);
    } catch (requestError) {
      setRowErrors((current) => ({
        ...current,
        [provider]: requestError instanceof Error ? requestError.message : "Unable to remove API key",
      }));
    } finally {
      setSavingProvider(null);
    }
  }

  return (
    <div className="container space-y-6 py-6 md:py-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage provider API credentials and integration health.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Admin
          </Link>
        </Button>
      </div>

      {rowErrors.global ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{rowErrors.global}</div> : null}
      {storageWarning ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{storageWarning}</div> : null}
      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
          <CardDescription>Saved keys are validated server-side before the integration is enabled.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading integrations
            </div>
          ) : (
            integrationRows.map((integration) => {
              const status = statusBadge(integration.status);
              const StatusIcon = status.icon;
              const isSaving = savingProvider === integration.provider;

              return (
                <form
                  key={integration.provider}
                  className="grid gap-4 rounded-md border p-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)_auto]"
                  onSubmit={(event) => void saveKey(event, integration.provider)}
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{integration.label}</h3>
                      <Badge variant={status.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{integration.description}</p>
                    <p className="text-xs text-muted-foreground">{keyHint(integration)}</p>
                    {integration.lastValidatedAt ? (
                      <p className="text-xs text-muted-foreground">Last validated {new Date(integration.lastValidatedAt).toLocaleString()}</p>
                    ) : null}
                    {integration.lastError || rowErrors[integration.provider] ? (
                      <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                        {rowErrors[integration.provider] ?? integration.lastError}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`${integration.provider}-api-key`}>API key</Label>
                    <div className="flex gap-2">
                      <Input
                        id={`${integration.provider}-api-key`}
                        type={visible[integration.provider] ? "text" : "password"}
                        autoComplete="off"
                        value={keys[integration.provider] ?? ""}
                        onChange={(event) => setKeys((current) => ({ ...current, [integration.provider]: event.target.value }))}
                        placeholder="Paste a new API key"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={visible[integration.provider] ? "Hide API key" : "Show API key"}
                        onClick={() => setVisible((current) => ({ ...current, [integration.provider]: !current[integration.provider] }))}
                      >
                        {visible[integration.provider] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Environment fallback: {integration.envNames.join(" or ")}</p>
                  </div>

                  <div className="flex flex-col gap-2 lg:items-end lg:justify-end">
                    <Button type="submit" disabled={isSaving || !(keys[integration.provider] ?? "").trim()}>
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save API Key
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSaving || (integration.source !== "database" && integration.status !== "invalid")}
                      onClick={() => void removeKey(integration.provider)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </form>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
