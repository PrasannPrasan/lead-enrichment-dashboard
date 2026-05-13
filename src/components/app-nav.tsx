import Link from "next/link";
import { BarChart3, Database, LogIn, Search, Settings } from "lucide-react";

import { getCurrentAdmin } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";

export async function AppNav() {
  const admin = await getCurrentAdmin();

  return (
    <header className="border-b bg-white">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Search className="h-4 w-4" />
          </span>
          Lead Enrichment
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <Search className="mr-2 h-4 w-4" />
              Enrich
            </Link>
          </Button>
          {admin ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/history">
                  <Database className="mr-2 h-4 w-4" />
                  History
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin">
                  <Settings className="mr-2 h-4 w-4" />
                  Admin
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/api/auth/signout">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Sign out
                </Link>
              </Button>
            </>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" />
                Admin Login
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
