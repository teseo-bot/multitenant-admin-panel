import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { LeadAssignResultSchema } from '@/lib/schemas/lead-assign-result';

// Use a service role client to bypass RLS for internal webhook processing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    if (token !== process.env.LANGGRAPH_INTERNAL_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const leadId = params.id;

    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead ID' }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = LeadAssignResultSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation Error', issues: parsed.error.issues }, { status: 400 });
    }

    const { assigned_node, thread_id } = parsed.data;

    // Optimistic lock: update ONLY if assigned_node = 'unassigned'
    // To get the row count and check if the update was applied, we select the updated row.
    const { data, error } = await supabase
      .from('leads')
      .update({
        assigned_node,
        thread_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId)
      .eq('assigned_node', 'unassigned')
      .select();

    if (error) {
      console.error('Error updating lead:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    // If no row was updated, it means it wasn't found or wasn't 'unassigned' (already assigned)
    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: true, message: 'Lead already assigned or not found (idempotent)', skipped: true },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, data: data[0] }, { status: 200 });

  } catch (error: unknown) {
    console.error("PATCH /api/internal/leads/[id]/assign-result error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
