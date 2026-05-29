import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

import { UpdatePromptVersionSchema } from '@/lib/schemas/prompt';

export async function GET(
  req: NextRequest,
  { params }: { params: { templateId: string; versionId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabase
    .from('prompt_versions')
    .select('*')
    .eq('id', params.versionId)
    .eq('template_id', params.templateId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { templateId: string; versionId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = UpdatePromptVersionSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('prompt_versions')
    .update(parsed.data)
    .eq('id', params.versionId)
    .eq('template_id', params.templateId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
