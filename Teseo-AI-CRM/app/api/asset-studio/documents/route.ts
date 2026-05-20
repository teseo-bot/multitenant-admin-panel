import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('documents')
      .select(`
        id,
        name,
        file_path,
        file_type,
        size_bytes,
        status,
        error_message,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("[Asset Studio API] Error fetching documents:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[Asset Studio API] Error Crítico:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
