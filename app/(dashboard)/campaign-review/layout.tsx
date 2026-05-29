"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function CampaignReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen w-full bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="h-14 flex items-center px-4 border-b border-slate-200">
          <h1 className="font-semibold text-slate-800">Teseo AI CRM</h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <Link
            href="/campaign-review"
            className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              pathname === "/campaign-review" || (pathname !== "/campaign-review" && !pathname?.startsWith("/campaign-review/tenants"))
                ? "bg-slate-100 text-slate-900"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            Campaigns
          </Link>
          <Link
            href="/campaign-review/tenants"
            className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              pathname?.startsWith("/campaign-review/tenants")
                ? "bg-slate-100 text-slate-900"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            Tenants
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header / Breadcrumbs */}
        <header className="h-14 flex items-center px-6 border-b border-slate-200 bg-white">
          <nav className="flex text-sm font-medium text-slate-500">
            <Link href="/campaign-review" className="hover:text-slate-900 transition-colors">
              Campaigns
            </Link>
            {pathname !== "/campaign-review" && (
              <>
                <span className="mx-2 text-slate-400">/</span>
                <span className="text-slate-900">
                  {pathname?.includes("/review") ? "Review" : "Detail"}
                </span>
              </>
            )}
          </nav>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
    </QueryClientProvider>
  );
}