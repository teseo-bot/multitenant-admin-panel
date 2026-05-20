import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { UpdateVariableSchema } from '@/lib/schemas/variable';

export async function GET(
  req: NextRequest,
  { params }: { params: { variableId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabase
    .from('variable_defs')
    .select('*')
    .eq('id', params.variableId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { variableId: string } }
) {
  const supabase = await createClient();
  const body = await req.json();
  const parsed = UpdateVariableSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if ('defaultValue' in updateData) updateData.default_value = updateData.defaultValue;
  if ('enumOptions' in updateData) updateData.enum_options = updateData.enumOptions;
  delete updateData.defaultValue;
  delete updateData.enumOptions;

  const { data, error } = await supabase
    .from('variable_defs')
    .update(updateData)
    .eq('id', params.variableId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { variableId: string } }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('variable_defs')
    .delete()
    .eq('id', params.variableId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
