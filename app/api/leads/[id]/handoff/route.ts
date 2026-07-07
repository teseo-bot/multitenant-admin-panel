import { NextResponse } from 'next/server';
import { z } from 'zod';
import { pool } from '@/lib/db';
import { logger } from '@/lib/logger';

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
    const client = await pool.connect();
    try {
      const res = await client.query(
        `UPDATE leads SET pipeline_status = $1, assigned_node = $2 WHERE id = $3
         RETURNING id, thread_id, pipeline_status, assigned_node`,
        [newStatus, assignedNode, id]
      );

      if (res.rows.length === 0) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }

      const updatedLead = res.rows[0];
    client.release();

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
            logger.warn('[Handoff] graph/interrupt returned status', { status: response.status });
          }
        } catch (err) {
          logger.error('[Handoff] Error notifying orchestrator', { error: String(err) });
        }
      }

      return NextResponse.json(updatedLead, { status: 200 });
    } catch (dbError) {
      logger.error('api.leads.handoff.db_error', { error: String(dbError) });
      client.release();
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  } catch (error: unknown) {
    logger.error('api.leads.handoff.unhandled_error', { error: String(error) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
