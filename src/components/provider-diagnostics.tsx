"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Play, RotateCcw } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

type DiagnosticProvider = "hunter" | "ninjapear";

type DiagnosticResult = {
  result: {
    provider: DiagnosticProvider;
    endpoint: string;
    success: boolean;
    skipped?: boolean;
    fieldsReturned: string[];
    requestSummary: Record<string, unknown>;
    responseSummary: Record<string, unknown>;
    cost: number;
    error?: string | null;
  };
  log: {
    id: string;
    createdAt: string;
  };
};

type DiagnosticResponse = {
  input: Record<string, unknown>;
  results: DiagnosticResult[];
};

const INITIAL_FORM = {
  linkedinUrl: "",
  fullName: "",
  company: "",
  title: "",
  email: "",
};

function resultStatus(result: DiagnosticResult["result"]) {
  if (result.success) {
    return { label: "Success", variant: "success" as const };
  }

  if (result.skipped || result.endpoint === "skipped") {
    return { label: "Skipped", variant: "warning" as const };
  }

  return { label: "Failed", variant: "destructive" as const };
}

export function ProviderDiagnostics() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [providers, setProviders] = useState<Record<DiagnosticProvider, boolean>>({
    hunter: true,
    ninjapear: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DiagnosticResponse | null>(null);

  const selectedProviders = useMemo(
    () => (Object.entries(providers) as Array<[DiagnosticProvider, boolean]>).filter(([, enabled]) => enabled).map(([provider]) => provider),
    [providers],
  );

  async function runDiagnostics(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setPayload(null);

    try {
      const response = await fetch("/api/admin/provider-diagnostics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          providers: selectedProviders,
          linkedinUrl: form.linkedinUrl || undefined,
          fullName: form.fullName || undefined,
          company: form.company || undefined,
          title: form.title || undefined,
          email: form.email || undefined,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Diagnostic test failed");
      }

      setPayload(body);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Diagnostic test failed");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm(INITIAL_FORM);
    setPayload(null);
    setError(null);
  }

  return (
    <div className="container space-y-6 py-6 md:py-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Provider Diagnostics</h1>
          <p className="text-sm text-muted-foreground">Run manual Hunter and NinjaPear checks with your own sample inputs.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Admin
          </Link>
        </Button>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,520px)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Manual Test</CardTitle>
            <CardDescription>Provider calls run from the server and may consume provider credits.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={runDiagnostics}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={providers.hunter}
                    onChange={(event) => setProviders((current) => ({ ...current, hunter: event.target.checked }))}
                  />
                  Hunter
                </label>
                <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={providers.ninjapear}
                    onChange={(event) => setProviders((current) => ({ ...current, ninjapear: event.target.checked }))}
                  />
                  NinjaPear
                </label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="diagnostic-email">Email</Label>
                <Input
                  id="diagnostic-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="name@company.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="diagnostic-name">Full name</Label>
                <Input
                  id="diagnostic-name"
                  value={form.fullName}
                  onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                  placeholder="Jane Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="diagnostic-company">Company or domain</Label>
                <Input
                  id="diagnostic-company"
                  value={form.company}
                  onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}
                  placeholder="example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="diagnostic-title">Title</Label>
                <Input
                  id="diagnostic-title"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Revenue Operations Lead"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="diagnostic-linkedin">LinkedIn URL</Label>
                <Input
                  id="diagnostic-linkedin"
                  type="url"
                  value={form.linkedinUrl}
                  onChange={(event) => setForm((current) => ({ ...current, linkedinUrl: event.target.value }))}
                  placeholder="https://www.linkedin.com/in/profile"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" disabled={loading || selectedProviders.length === 0}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  Run Test
                </Button>
                <Button type="button" variant="outline" onClick={resetForm} disabled={loading}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {payload?.results.length ? (
            payload.results.map(({ result, log }) => {
              const status = resultStatus(result);

              return (
                <Card key={log.id}>
                  <CardHeader>
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                      <div>
                        <CardTitle className="capitalize">{result.provider}</CardTitle>
                        <CardDescription>{result.endpoint}</CardDescription>
                      </div>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <div className="text-muted-foreground">Cost</div>
                        <div className="font-medium">{formatCurrency(result.cost)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Fields</div>
                        <div className="font-medium">{result.fieldsReturned.length ? result.fieldsReturned.join(", ") : "None"}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Log ID</div>
                        <div className="truncate font-medium">{log.id}</div>
                      </div>
                    </div>

                    {result.error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{result.error}</div> : null}

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Request summary</Label>
                        <Textarea readOnly value={JSON.stringify(result.requestSummary, null, 2)} className="min-h-40 font-mono text-xs" />
                      </div>
                      <div className="space-y-2">
                        <Label>Response summary</Label>
                        <Textarea readOnly value={JSON.stringify(result.responseSummary, null, 2)} className="min-h-40 font-mono text-xs" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Results</CardTitle>
                <CardDescription>Run a test to see provider status, endpoint, cost, fields, and error messages.</CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
