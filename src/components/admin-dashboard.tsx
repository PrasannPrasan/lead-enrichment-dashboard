"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RotateCcw, Save, Settings } from "lucide-react";

import type { ProviderConfigInput } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ProviderConfig = ProviderConfigInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

type ProviderLog = {
  id: string;
  leadId: string | null;
  provider: string;
  endpoint: string;
  success: boolean;
  requestSummary: Record<string, unknown>;
  responseSummary: Record<string, unknown>;
  fieldsReturned: string[];
  cost: number;
  error?: string | null;
  createdAt: string;
};

type CostSummary = {
  totalCost: number;
  leadCount: number;
  successfulLeadCount: number;
  costPerSuccessfulLead: number;
  providerStats: Record<string, { calls: number; successes: number; cost: number }>;
};

const EMPTY_CONFIG: ProviderConfigInput = {
  provider: "",
  enabled: false,
  priority: 20,
  costPerRequest: 0,
  costPerSuccessfulContact: 0,
  dailyLimit: null,
  monthlyLimit: null,
};

function providerRunStatus(log: ProviderLog) {
  if (log.success) {
    return {
      label: "Success",
      variant: "success" as const,
    };
  }

  const error = log.error?.toLowerCase() ?? "";
  const skipped =
    log.endpoint === "skipped" ||
    log.endpoint === "budget-guardrail" ||
    log.responseSummary?.skipped === true ||
    error.includes("skipped") ||
    error.includes("not configured");

  return {
    label: skipped ? "Skipped" : "Failed",
    variant: skipped ? ("warning" as const) : ("destructive" as const),
  };
}

export function AdminDashboard() {
  const [configs, setConfigs] = useState<ProviderConfig[]>([]);
  const [logs, setLogs] = useState<ProviderLog[]>([]);
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [newConfig, setNewConfig] = useState<ProviderConfigInput>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAdminData() {
    setLoading(true);
    setError(null);

    try {
      const [configsResponse, logsResponse, summaryResponse] = await Promise.all([
        fetch("/api/admin/provider-config", { cache: "no-store" }),
        fetch("/api/provider-logs", { cache: "no-store" }),
        fetch("/api/cost-summary", { cache: "no-store" }),
      ]);
      const [configsPayload, logsPayload, summaryPayload] = await Promise.all([
        configsResponse.json(),
        logsResponse.json(),
        summaryResponse.json(),
      ]);

      if (!configsResponse.ok) throw new Error(configsPayload.error ?? "Unable to load provider configs");
      if (!logsResponse.ok) throw new Error(logsPayload.error ?? "Unable to load provider logs");
      if (!summaryResponse.ok) throw new Error(summaryPayload.error ?? "Unable to load cost summary");

      setConfigs(configsPayload.configs);
      setLogs(logsPayload.logs);
      setSummary(summaryPayload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load admin data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAdminData();
  }, []);

  function patchLocalConfig(id: string, patch: Partial<ProviderConfig>) {
    setConfigs((current) => current.map((config) => (config.id === id ? { ...config, ...patch } : config)));
  }

  async function saveConfig(config: ProviderConfig) {
    setSavingId(config.id);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/provider-config/${config.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: config.enabled,
          priority: config.priority,
          costPerRequest: config.costPerRequest,
          costPerSuccessfulContact: config.costPerSuccessfulContact,
          dailyLimit: config.dailyLimit,
          monthlyLimit: config.monthlyLimit,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save config");
      }

      patchLocalConfig(config.id, payload.config);
      setMessage(`${config.provider} settings saved.`);
      void loadAdminData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save config");
    } finally {
      setSavingId(null);
    }
  }

  async function addConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingId("new");
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/provider-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newConfig),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to add provider");
      }

      setConfigs((current) => [...current, payload.config].sort((a, b) => a.priority - b.priority));
      setNewConfig(EMPTY_CONFIG);
      setMessage("Provider config added.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to add provider");
    } finally {
      setSavingId(null);
    }
  }

  async function retryLookup(log: ProviderLog) {
    const linkedinUrl = typeof log.requestSummary.linkedinUrl === "string" ? log.requestSummary.linkedinUrl : null;

    if (!linkedinUrl) {
      setError("This log does not include a LinkedIn URL to retry.");
      return;
    }

    setSavingId(log.id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/enrich", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ linkedinUrl, forceRefresh: true }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Retry failed");
      }

      setMessage("Lookup retry completed.");
      void loadAdminData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Retry failed");
    } finally {
      setSavingId(null);
    }
  }

  const providerRows = useMemo(
    () =>
      configs.map((config) => ({
        ...config,
        stats: summary?.providerStats[config.provider] ?? { calls: 0, successes: 0, cost: 0 },
      })),
    [configs, summary],
  );

  return (
    <div className="container space-y-6 py-6 md:py-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage provider priority, budget limits, call costs, and retry failed enrichment.</p>
        </div>
        <Button variant="outline" onClick={() => void loadAdminData()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total cost</CardDescription>
            <CardTitle>{formatCurrency(summary?.totalCost ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total leads</CardDescription>
            <CardTitle>{summary?.leadCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Successful leads</CardDescription>
            <CardTitle>{summary?.successfulLeadCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Cost per success</CardDescription>
            <CardTitle>{formatCurrency(summary?.costPerSuccessfulLead ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Provider Settings</CardTitle>
          <CardDescription>Lower priority numbers run earlier in the waterfall.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Request Cost</TableHead>
                <TableHead>Contact Cost</TableHead>
                <TableHead>Daily Limit</TableHead>
                <TableHead>Monthly Limit</TableHead>
                <TableHead>Success Rate</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providerRows.map((config) => {
                const successRate = config.stats.calls ? Math.round((config.stats.successes / config.stats.calls) * 100) : 0;

                return (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">{config.provider}</TableCell>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={config.enabled}
                        onChange={(event) => patchLocalConfig(config.id, { enabled: event.target.checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="w-20"
                        type="number"
                        value={config.priority}
                        onChange={(event) => patchLocalConfig(config.id, { priority: Number(event.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="w-24"
                        type="number"
                        step="0.001"
                        value={config.costPerRequest}
                        onChange={(event) => patchLocalConfig(config.id, { costPerRequest: Number(event.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="w-24"
                        type="number"
                        step="0.001"
                        value={config.costPerSuccessfulContact}
                        onChange={(event) => patchLocalConfig(config.id, { costPerSuccessfulContact: Number(event.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="w-24"
                        type="number"
                        step="0.01"
                        value={config.dailyLimit ?? ""}
                        onChange={(event) =>
                          patchLocalConfig(config.id, { dailyLimit: event.target.value === "" ? null : Number(event.target.value) })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="w-24"
                        type="number"
                        step="0.01"
                        value={config.monthlyLimit ?? ""}
                        onChange={(event) =>
                          patchLocalConfig(config.id, { monthlyLimit: event.target.value === "" ? null : Number(event.target.value) })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={successRate >= 70 ? "success" : successRate ? "warning" : "outline"}>{successRate}%</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => void saveConfig(config)} disabled={savingId === config.id}>
                        {savingId === config.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Provider Config</CardTitle>
          <CardDescription>Use this for later providers such as Dropcontact, Snov.io, or Findymail.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_repeat(5,120px)_auto]" onSubmit={addConfig}>
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Input
                id="provider"
                value={newConfig.provider}
                onChange={(event) => setNewConfig((current) => ({ ...current, provider: event.target.value }))}
                placeholder="dropcontact"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Input
                type="number"
                value={newConfig.priority}
                onChange={(event) => setNewConfig((current) => ({ ...current, priority: Number(event.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Request</Label>
              <Input
                type="number"
                step="0.001"
                value={newConfig.costPerRequest}
                onChange={(event) => setNewConfig((current) => ({ ...current, costPerRequest: Number(event.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Contact</Label>
              <Input
                type="number"
                step="0.001"
                value={newConfig.costPerSuccessfulContact}
                onChange={(event) => setNewConfig((current) => ({ ...current, costPerSuccessfulContact: Number(event.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Daily</Label>
              <Input
                type="number"
                value={newConfig.dailyLimit ?? ""}
                onChange={(event) =>
                  setNewConfig((current) => ({ ...current, dailyLimit: event.target.value === "" ? null : Number(event.target.value) }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly</Label>
              <Input
                type="number"
                value={newConfig.monthlyLimit ?? ""}
                onChange={(event) =>
                  setNewConfig((current) => ({ ...current, monthlyLimit: event.target.value === "" ? null : Number(event.target.value) }))
                }
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={savingId === "new"}>
                {savingId === "new" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provider Logs</CardTitle>
          <CardDescription>Recent provider calls, skips, failures, returned fields, and cost.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fields</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Retry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length ? (
                logs.map((log) => {
                  const status = providerRunStatus(log);

                  return (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.provider}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>{log.fieldsReturned.length ? log.fieldsReturned.join(", ") : "None"}</TableCell>
                      <TableCell>{formatCurrency(log.cost)}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">{log.error ?? "None"}</TableCell>
                      <TableCell>{formatDate(log.createdAt)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => void retryLookup(log)} disabled={savingId === log.id}>
                          {savingId === log.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                          Retry
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    No provider logs yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
