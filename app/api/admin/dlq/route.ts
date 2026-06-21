import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requirePlatformAdmin } from '@/lib/auth/guards';

export async function GET() {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = await createClient();

    const { data: outbox, error } = await supabase
      .from('lead_assignment_outbox')
      .select('*')
      .in('status', ['failed', 'dead', 'pending'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(outbox, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
