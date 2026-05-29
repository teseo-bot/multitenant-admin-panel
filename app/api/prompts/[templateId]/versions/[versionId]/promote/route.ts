import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(
  req: NextRequest,
  { params }: { params: { templateId: string; versionId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  // Start a transaction-like sequence (though Supabase REST doesn't support raw transactions, 
  // we do it sequentially or through an RPC if strictly needed. For now, sequential updates).

  // 1. Get current active version and archive it
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

  // 2. Set the new version to 'active'
  const { error: versionError } = await supabase
    .from('prompt_versions')
    .update({ status: 'active' })
    .eq('id', params.versionId);

  if (versionError) return NextResponse.json({ error: versionError.message }, { status: 500 });

  // 3. Update the template's active_version_id
  const { data, error: templateError } = await supabase
    .from('prompt_templates')
    .update({ active_version_id: params.versionId })
    .eq('id', params.templateId)
    .select()
    .single();

  if (templateError) return NextResponse.json({ error: templateError.message }, { status: 500 });
  return NextResponse.json(data);
}
