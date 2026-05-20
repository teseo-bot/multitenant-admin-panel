import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    const body = await request.json();
    const { decision, reason } = body;

    if (decision !== 'approved' && decision !== 'rejected') {
      return NextResponse.json({ error: 'Decision must be approved or rejected' }, { status: 400 });
    }

    // Insert approval record
    const { data: approval, error: approvalError } = await supabase
      .from('campaign_approvals')
      .insert({
        campaign_id: id,
        reviewer_id: user.id,
        decision,
        reason: reason || null
      })
      .select()
      .single();

    if (approvalError) {
      return NextResponse.json({ error: approvalError.message }, { status: 500 });
    }

    // Update campaign status
    const newStatus = decision === 'approved' ? 'approved' : 'rejected';
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({ status: newStatus })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(approval, { status: 201 });
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ error: error.message || 'Bad Request' }, { status: 400 });
  }
}
