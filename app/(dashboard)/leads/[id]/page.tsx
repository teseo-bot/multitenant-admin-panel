/**
 * app/(dashboard)/leads/[id]/page.tsx
 * 
 * Lead Detail page — renders the full LeadDetail component.
 * Route: /leads/:id
 * 
 * This is a thin wrapper that extracts the route param and passes it
 * to the client-side LeadDetail component.
 */

import { LeadDetail } from "@/components/lead-detail";

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params;

  return <LeadDetail leadId={id} />;
}
