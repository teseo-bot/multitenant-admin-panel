import { NextRequest, NextResponse } from 'next/server';
import { CreateExperimentSchema } from '@/lib/schemas/experiment';
import { getTenantContext } from '@/lib/auth/get-tenant-context';

export async function GET(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const result = await getTenantContext(req);
  if (!result.ok) return new Response(result.err.error, { status: result.err.status });
  const { supabase } = result.ctx;

  const { data, error } = await supabase
    .from('ab_experiments')
    .select('*')
    .eq('template_id', params.templateId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const result = await getTenantContext(req);
  if (!result.ok) return new Response(result.err.error, { status: result.err.status });
  const { user, tenantId, supabase } = result.ctx;

  const body = await req.json();
  const parsed = CreateExperimentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  // Create experiment
  const { data: experiment, error: expError } = await supabase
    .from('ab_experiments')
    .insert({
      tenant_id: tenantId,
      template_id: params.templateId,
      name: parsed.data.name,
      status: 'draft',
      min_impressions: parsed.data.minImpressions,
      confidence_level: parsed.data.confidenceLevel,
      created_by: user.id,
    })
    .select()
    .single();

  if (expError) return NextResponse.json({ error: expError.message }, { status: 500 });

  // Create variants
  const variantsToInsert = parsed.data.variants.map(v => ({
    experiment_id: experiment.id,
    version_id: v.versionId,
    traffic_pct: v.trafficPct,
    label: v.label,
  }));

  const { error: variantsError } = await supabase
    .from('ab_variants')
    .insert(variantsToInsert);

  if (variantsError) return NextResponse.json({ error: variantsError.message }, { status: 500 });

  return NextResponse.json(experiment, { status: 201 });
}
