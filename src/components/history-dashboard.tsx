"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Loader2, RefreshCw, Search } from "lucide-react";

import type { SerializedLead } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function HistoryDashboard() {
  const [leads, setLeads] = useState<SerializedLead[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadLeads() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/leads", {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load leads");
      }

      setLeads(payload.leads);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load leads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLeads();
  }, []);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return leads;
    }

    return leads.filter((lead) =>
      [lead.fullName, lead.currentCompany, lead.currentDesignation, lead.linkedinUrl]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query)),
    );
  }, [leads, search]);

  return (
    <div className="container space-y-6 py-6 md:py-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Lookup History</h1>
          <p className="text-sm text-muted-foreground">Search previous enrichments and export lead records.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadLeads()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
          <Button asChild>
            <Link href="/api/export/leads">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leads</CardTitle>
          <CardDescription>{filteredLeads.length} records shown.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, company, title, or URL"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Loading history...
                  </TableCell>
                </TableRow>
              ) : filteredLeads.length ? (
                filteredLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div className="font-medium">{lead.fullName ?? "Unknown lead"}</div>
                      <div className="max-w-[300px] truncate text-xs text-muted-foreground">{lead.linkedinUrl}</div>
                    </TableCell>
                    <TableCell>
                      <div>{lead.currentCompany ?? "Not found"}</div>
                      <div className="text-xs text-muted-foreground">{lead.currentDesignation ?? "No title"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {lead.emails.length ? <Badge variant="success">{lead.emails.length} email</Badge> : null}
                        {lead.phones.length ? <Badge variant="warning">{lead.phones.length} phone</Badge> : null}
                        {!lead.emails.length && !lead.phones.length ? <Badge variant="outline">No contact</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(lead.totalCost)}</TableCell>
                    <TableCell>{formatDate(lead.updatedAt)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No lead records found.
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
