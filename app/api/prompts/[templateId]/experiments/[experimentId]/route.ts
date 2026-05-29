import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { templateId: string; experimentId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  // Fetch experiment
  const { data: experiment, error: expError } = await supabase
    .from('ab_experiments')
    .select('*')
    .eq('id', params.experimentId)
    .single();

  if (expError) return NextResponse.json({ error: expError.message }, { status: 500 });

  // Fetch variants
  const { data: variants, error: varError } = await supabase
    .from('ab_variants')
    .select('*, version:prompt_versions(version_number, content)')
    .eq('experiment_id', params.experimentId);

  if (varError) return NextResponse.json({ error: varError.message }, { status: 500 });

  // Combine
  const result = {
    ...experiment,
    variants: variants.map(v => ({
      ...v,
      versionNumber: v.version?.version_number,
      content: v.version?.content
    }))
  };

  return NextResponse.json(result);
}
