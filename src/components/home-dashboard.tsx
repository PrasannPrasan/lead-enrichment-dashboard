"use client";

import { FormEvent, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, CircleDollarSign, Loader2, Search, ShieldCheck } from "lucide-react";

import type { LeadField, SerializedLead } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type EnrichResponse = {
  lead: SerializedLead;
  logs: Array<{
    id: string;
    provider: string;
    endpoint: string;
    success: boolean;
    fieldsReturned: string[];
    cost: number;
    error?: string | null;
    createdAt: string;
  }>;
  cached: boolean;
  skippedDueToBudget: string[];
};

const FIELD_LABELS: Record<LeadField, string> = {
  fullName: "Full Name",
  currentCompany: "Current Company",
  currentDesignation: "Current Designation",
  totalYearsExperience: "Total Experience",
  emails: "Email Address(es)",
  phones: "Phone Number(s)",
  workHistory: "Work History",
};

function confidenceVariant(score?: number) {
  if ((score ?? 0) >= 85) return "success";
  if ((score ?? 0) >= 60) return "warning";
  return "destructive";
}

function FieldMeta({ lead, field }: { lead: SerializedLead; field: LeadField }) {
  const confidence = lead.confidence[field];
  const sources = lead.sources[field] ?? [];

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant={confidenceVariant(confidence)}>{confidence ?? 0}% confidence</Badge>
      {sources.map((source) => (
        <Badge key={source} variant="outline">
          {source}
        </Badge>
      ))}
    </div>
  );
}

function LeadFieldRow({ lead, field, value }: { lead: SerializedLead; field: LeadField; value: string }) {
  return (
    <div className="grid gap-2 border-b py-4 last:border-0 md:grid-cols-[190px_1fr]">
      <div className="text-sm font-medium text-muted-foreground">{FIELD_LABELS[field]}</div>
      <div className="space-y-2">
        <div className="text-sm font-semibold">{value || "Not found"}</div>
        <FieldMeta lead={lead} field={field} />
      </div>
    </div>
  );
}

export function HomeDashboard() {
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EnrichResponse | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/enrich", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ linkedinUrl }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Enrichment failed");
      }

      setResult(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to enrich this lead");
    } finally {
      setLoading(false);
    }
  }

  const totalProviderCost = useMemo(
    () => result?.logs.reduce((sum, log) => sum + log.cost, 0) ?? result?.lead.totalCost ?? 0,
    [result],
  );

  return (
    <div className="container space-y-6 py-6 md:py-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Enrich a LinkedIn profile</CardTitle>
            <CardDescription>Provider calls run through server-side routes and are cached by LinkedIn URL.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-[1fr_auto]" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="linkedinUrl">LinkedIn Profile URL</Label>
                <Input
                  id="linkedinUrl"
                  placeholder="https://www.linkedin.com/in/example"
                  value={linkedinUrl}
                  onChange={(event) => setLinkedinUrl(event.target.value)}
                  required
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full md:w-auto" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Enrich
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lookup Controls</CardTitle>
            <CardDescription>Waterfall order and cost guardrails are configured in the admin panel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              API keys are read only on the server.
            </div>
            <div className="flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-primary" />
              Paid fallbacks stop once required fields are found.
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Successful lookups are cached in PostgreSQL.
            </div>
          </CardContent>
        </Card>
      </section>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-red-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error}
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>{result.lead.fullName ?? "Lead result"}</CardTitle>
                  <CardDescription>{result.lead.linkedinUrl}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={result.cached ? "success" : "secondary"}>
                    {result.cached ? "Cached result" : "Fresh lookup"}
                  </Badge>
                  {result.skippedDueToBudget.map((provider) => (
                    <Badge key={provider} variant="warning">
                      {provider} skipped due to budget
                    </Badge>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <LeadFieldRow lead={result.lead} field="fullName" value={result.lead.fullName ?? ""} />
              <LeadFieldRow lead={result.lead} field="currentCompany" value={result.lead.currentCompany ?? ""} />
              <LeadFieldRow lead={result.lead} field="currentDesignation" value={result.lead.currentDesignation ?? ""} />
              <LeadFieldRow
                lead={result.lead}
                field="totalYearsExperience"
                value={result.lead.totalYearsExperience ? `${result.lead.totalYearsExperience} years` : ""}
              />
              <LeadFieldRow lead={result.lead} field="emails" value={result.lead.emails.join(", ")} />
              <LeadFieldRow lead={result.lead} field="phones" value={result.lead.phones.join(", ")} />
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Cost Breakdown</CardTitle>
                <CardDescription>{formatCurrency(totalProviderCost)} spent on this lookup run.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.logs.length ? (
                      result.logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">{log.provider}</TableCell>
                          <TableCell>
                            <Badge variant={log.success ? "success" : "destructive"}>{log.success ? "Success" : "Skipped/Failed"}</Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(log.cost)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-muted-foreground">
                          Served from cache with no provider calls.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Experience Timeline</CardTitle>
                <CardDescription>{result.lead.workHistory.length} roles returned.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.lead.workHistory.length ? (
                  result.lead.workHistory.map((role, index) => (
                    <div key={`${role.company}-${role.title}-${index}`} className="border-l-2 border-primary/30 pl-4">
                      <div className="text-sm font-semibold">{role.title || "Role"}</div>
                      <div className="text-sm text-muted-foreground">{role.company}</div>
                      <div className="text-xs text-muted-foreground">
                        {role.startDate ?? "Unknown"} - {role.endDate ?? "Present"}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No work history returned.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lookup Metadata</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatDate(result.lead.createdAt)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Updated</span>
                  <span>{formatDate(result.lead.updatedAt)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}
    </div>
  );
}
