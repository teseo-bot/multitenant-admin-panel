import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requirePlatformAdmin } from '@/lib/auth/guards';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const params = await context.params;
    const { id } = params;

    const supabase = await createClient();

    // Set back to pending manually bypassing the dead state
    const { data, error } = await supabase
      .from('lead_assignment_outbox')
      .update({
        status: 'pending',
        attempts: 0,
        next_retry_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Trigger explicit webhook dispatch logic could go here
    // ...

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
