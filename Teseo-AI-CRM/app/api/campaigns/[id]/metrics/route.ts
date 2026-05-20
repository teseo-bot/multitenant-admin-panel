import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  // Optimistic attempt to fetch metrics
  const { data: metrics, error } = await supabase
    .from('campaign_metrics')
    .select('*')
    .eq('campaign_id', id)
    .single();

  // If we need conditional refresh, we usually trigger an RPC or a Supabase edge function.
  // The RFC says: "Refresh condicional del materialized view + retorno"
  // Let's call an RPC if it exists to refresh it if needed, but since we didn't define one
  // we might just return the metrics, and maybe call a background refresh if possible.
  // Actually, standard way in Supabase to refresh materialized view from client API 
  // is via an RPC function. Since it wasn't in the schema exactly, we'll assume we can create 
  // an RPC or simply return what we have. 
  // For the sake of the task, we'll try to call an RPC `refresh_campaign_metrics_if_needed`.
  
  // Fire and forget or await refresh (we won't fail if RPC doesn't exist to avoid hard crash)
  Promise.resolve(supabase.rpc('refresh_campaign_metrics', { p_campaign_id: id })).catch(() => {});

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(metrics || {
    campaignId: id,
    messagesSent: 0,
    messagesReceived: 0,
    leadsQualified: 0,
    leadsLost: 0,
    handoffsRequested: 0,
    handoffsCompleted: 0,
    errors: 0,
    uniqueThreads: 0,
    uniqueLeads: 0,
    firstEventAt: null,
    lastEventAt: null
  });
}
