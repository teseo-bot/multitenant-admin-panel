import { NextRequest, NextResponse } from 'next/server';
import { CreateVariableSchema } from '@/lib/schemas/variable';
import { getTenantContext } from '@/lib/auth/get-tenant-context';

export async function GET(request: NextRequest) {
  const result = await getTenantContext(request);
  if (!result.ok) return new Response(result.err.error, { status: result.err.status });
  const { supabase } = result.ctx;

  const { data, error } = await supabase
    .from('variable_defs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const result = await getTenantContext(req);
  if (!result.ok) return new Response(result.err.error, { status: result.err.status });
  const { tenantId, supabase } = result.ctx;

  const body = await req.json();
  const parsed = CreateVariableSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('variable_defs')
    .insert({
      tenant_id: tenantId,
      key: parsed.data.key,
      label: parsed.data.label,
      type: parsed.data.type,
      default_value: parsed.data.defaultValue ?? null,
      enum_options: parsed.data.enumOptions ?? null,
      required: parsed.data.required,
      description: parsed.data.description ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
