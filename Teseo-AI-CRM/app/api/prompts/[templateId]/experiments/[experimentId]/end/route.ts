import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { z } from 'zod';

const EndExperimentSchema = z.object({
  winnerVariantId: z.string().uuid(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { templateId: string; experimentId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const parsed = EndExperimentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  // 1. End experiment and set winner
  const { data: experiment, error: expError } = await supabase
    .from('ab_experiments')
    .update({ 
      status: 'completed', 
      ended_at: new Date().toISOString(),
      winner_variant_id: parsed.data.winnerVariantId
    })
    .eq('id', params.experimentId)
    .select()
    .single();

  if (expError) return NextResponse.json({ error: expError.message }, { status: 500 });

  // 2. Fetch the variant to know which version won
  const { data: variant, error: varError } = await supabase
    .from('ab_variants')
    .select('version_id')
    .eq('id', parsed.data.winnerVariantId)
    .single();

  if (varError || !variant) {
    return NextResponse.json({ error: varError?.message || 'Variant not found' }, { status: 500 });
  }

  // 3. Promote the winning version to active via internal logic
  const { data: template } = await supabase
    .from('prompt_templates')
    .select('active_version_id')
    .eq('id', params.templateId)
    .single();

  if (template?.active_version_id) {
    await supabase
      .from('prompt_versions')
      .update({ status: 'archived' })
      .eq('id', template.active_version_id);
  }

  await supabase
    .from('prompt_versions')
    .update({ status: 'active' })
    .eq('id', variant.version_id);

  await supabase
    .from('prompt_templates')
    .update({ active_version_id: variant.version_id })
    .eq('id', params.templateId);

  return NextResponse.json(experiment);
}
