import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/auth/get-tenant-context';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getTenantContext(req);
    if (!result.ok) return new Response(result.err.error, { status: result.err.status });
    const { tenantId, supabase } = result.ctx;

    const id = params.id;

    // Fetch the prompt template and its active version's canvas_data
    const { data: template, error: templateError } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    let activeVersion = null;
    if (template.active_version_id) {
      const { data: versionData } = await supabase
        .from('prompt_versions')
        .select('canvas_data, content, version_number')
        .eq('id', template.active_version_id)
        .single();
      
      activeVersion = versionData;
    }

    const canvasData = activeVersion?.canvas_data;

    return NextResponse.json({
      id: template.id,
      name: template.name,
      layout: canvasData || null,
      versionNumber: activeVersion?.version_number,
      content: activeVersion?.content,
      createdAt: template.created_at,
      updatedAt: template.updated_at
    });

  } catch (error: unknown) {
    console.error('[Template Fetch Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}