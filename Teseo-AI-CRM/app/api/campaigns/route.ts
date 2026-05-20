import { NextRequest, NextResponse } from 'next/server';
import { CampaignStatus } from '@/types/campaign';
import { Channel } from '@/types/conversation';
import { getTenantContext } from '@/lib/auth/get-tenant-context';

export async function GET(request: NextRequest) {
  const result = await getTenantContext(request);
  if (!result.ok) return new Response(result.err.error, { status: result.err.status });
  const { supabase } = result.ctx;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as CampaignStatus | null;
  const channel = searchParams.get('channel') as Channel | null;
  const search = searchParams.get('search');
  const cursor = searchParams.get('cursor'); // uuid
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  let query = supabase
    .from('campaigns')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('status', status);
  if (channel) query = query.eq('channel', channel);
  if (search) query = query.ilike('name', `%${search}%`);
  if (cursor) {
    // using created_at for cursor pagination requires fetching the cursor's created_at, 
    // but simplified we can just use ID if sequential, or offset.
    // For simplicity, we just assume cursor is offset if it's a number, but usually it's id.
    // Implementing offset fallback here for simplicity:
    const offset = parseInt(cursor, 10);
    if (!isNaN(offset)) {
      query = query.range(offset, offset + limit - 1);
    }
  }

  const { data: campaigns, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Next cursor logic (simple offset-based for demonstration if cursor was an offset)
  let nextCursor = null;
  if (campaigns && campaigns.length === limit) {
    const currentOffset = cursor ? parseInt(cursor, 10) : 0;
    nextCursor = (currentOffset + limit).toString();
  }

  return NextResponse.json({
    campaigns,
    nextCursor,
    totalCount: count || 0
  });
}

export async function POST(request: NextRequest) {
  const result = await getTenantContext(request);
  if (!result.ok) return new Response(result.err.error, { status: result.err.status });
  const { user, tenantId, supabase } = result.ctx;

  try {
    const body = await request.json();
    const { name, description, agentRoles, channel, targetAudience, scheduledStart, scheduledEnd } = body;

    if (!name || !agentRoles || !channel) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        tenant_id: tenantId,
        name,
        description,
        agent_roles: agentRoles,
        channel,
        status: 'draft',
        target_audience: targetAudience || {},
        scheduled_start: scheduledStart || null,
        scheduled_end: scheduledEnd || null,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(campaign, { status: 201 });
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ error: error.message || 'Bad Request' }, { status: 400 });
  }
}
