import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  
  const { data: { user }, error: authError } = token 
    ? await supabase.auth.getUser(token)
    : await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(campaign);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  
  const { data: { user }, error: authError } = token 
    ? await supabase.auth.getUser(token)
    : await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    const body = await request.json();
    const { name, description, agentRoles, channel, status, targetAudience, scheduledStart, scheduledEnd } = body;

    const updateData: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (agentRoles !== undefined) updateData.agent_roles = agentRoles;
    if (channel !== undefined) updateData.channel = channel;
    if (status !== undefined) updateData.status = status;
    if (targetAudience !== undefined) updateData.target_audience = targetAudience;
    if (scheduledStart !== undefined) updateData.scheduled_start = scheduledStart;
    if (scheduledEnd !== undefined) updateData.scheduled_end = scheduledEnd;

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(campaign);
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ error: error.message || 'Bad Request' }, { status: 400 });
  }
}
