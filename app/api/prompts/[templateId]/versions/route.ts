import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { CreatePromptVersionSchema } from '@/lib/schemas/prompt';
import { extractVariables } from '@/lib/prompt-utils';

export async function GET(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabase
    .from('prompt_versions')
    .select('*')
    .eq('template_id', params.templateId)
    .order('version_number', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = CreatePromptVersionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  // Extract variables
  const variablesKeys = extractVariables(parsed.data.content);
  // Transform to VariableRef[] format for the prompt_versions table
  const variables = variablesKeys.map(key => ({
    key,
    label: key,
    type: 'text',
    required: false
  }));

  const { data, error } = await supabase
    .from('prompt_versions')
    .insert({
      template_id: params.templateId,
      content: parsed.data.content,
      variables,
      changelog: parsed.data.changelog ?? null,
      status: 'draft',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
