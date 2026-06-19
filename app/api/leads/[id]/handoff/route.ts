import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { z } from 'zod';

const ParamsSchema = z.object({
  id: z.string().uuid()
});

const HandoffBodySchema = z.object({
  operatorId: z.string().uuid(),
  action: z.enum(['take_over', 'return_to_agent', 'resolve', 'escalate']),
  reason: z.string().optional()
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const parsedParams = ParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: 'Invalid lead ID format' }, { status: 400 });
    }
    const id = parsedParams.data.id;

    const body = await request.json();
    const parsedBody = HandoffBodySchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.issues }, { status: 400 });
    }

    const { action } = parsedBody.data;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Determine the target state based on the action
    let newStatus = 'active';
    let assignedNode = 'admin'; // default for manual intervention
    
    if (action === 'take_over') {
      newStatus = 'human_active';
      assignedNode = 'admin';
    } else if (action === 'return_to_agent') {
      newStatus = 'agent_active';
      assignedNode = 'sdr';
    } else if (action === 'resolve') {
      newStatus = 'resolved';
    } else if (action === 'escalate') {
      newStatus = 'pending_handoff';
    }

    // Perform the database update on the unified leads table
    const { data: updatedLead, error } = await supabase
      .from('leads')
      .update({
        pipeline_status: newStatus,
        assigned_node: assignedNode,
      })
      .eq('id', id)
      .select('id, thread_id, pipeline_status, assigned_node')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Call LangGraph internal webhook to inject is_human_handled state
    if (updatedLead?.thread_id && (action === 'take_over' || action === 'return_to_agent')) {
      const COMPILER_URL = process.env.COMPILER_INTERNAL_URL || 'http://localhost:8000';
      try {
        const response = await fetch(`${COMPILER_URL}/api/internal/graph/interrupt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            thread_id: updatedLead.thread_id, 
            is_human_handled: action === 'take_over' 
          })
        });
        if (!response.ok) {
          console.error(`[Handoff] graph/interrupt returned ${response.status}`);
        }
      } catch (err) {
        console.error('[Handoff] Error notifying orchestrator:', err);
      }
    }

    return NextResponse.json(updatedLead, { status: 200 });
  } catch (error: unknown) {
    console.error('Unhandled error in POST /api/leads/[id]/handoff:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
