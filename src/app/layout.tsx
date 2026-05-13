import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "@/app/globals.css";
import { AppNav } from "@/components/app-nav";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lead Enrichment Dashboard",
  description: "Server-side lead enrichment waterfall with provider cost controls.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppNav />
        <main>{children}</main>
      </body>
    </html>
  );
}
