import { NextRequest, NextResponse } from 'next/server';
import { CreatePromptTemplateSchema } from '@/lib/schemas/prompt';
import { getTenantContext } from '@/lib/auth/get-tenant-context';

export async function GET(request: NextRequest) {
  const result = await getTenantContext(request);
  if (!result.ok) return new Response(result.err.error, { status: result.err.status });
  const { supabase } = result.ctx;

  const { data, error } = await supabase
    .from('prompt_templates')
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
  const parsed = CreatePromptTemplateSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('prompt_templates')
    .insert({
      role: parsed.data.role,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      tenant_id: tenantId, // Required field in schema
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
