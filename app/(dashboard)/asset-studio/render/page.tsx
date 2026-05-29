import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

// Esta ruta NO DEBE tener Layout (o debe sobreescribirlo) para evitar renderizar menús laterales.
// Por simplicidad, renderizamos un div puro.

export default async function RenderPage({
  searchParams,
}: {
  searchParams: { templateId?: string; versionId?: string };
}) {
  const { templateId, versionId } = searchParams;

  if (!templateId) return notFound();

  const supabase = await createClient();

  // Buscar el template
  const { data: template } = await supabase
    .from('prompt_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (!template) return notFound();

  // Buscar la versión específica o la más reciente
  let versionQuery;

  if (versionId) {
    versionQuery = supabase
      .from('prompt_versions')
      .select('*')
      .eq('id', versionId)
      .single();
  } else {
    versionQuery = supabase
      .from('prompt_versions')
      .select('*')
      .eq('template_id', templateId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();
  }

  const { data: version } = await versionQuery;

  return (
    <div className="bg-white p-8 min-h-screen flex items-center justify-center">
      {/* 
        El ID "render-container" es crítico.
        Es el target que busca el API de Playwright para tomar el snapshot.
      */}
      <div 
        id="render-container" 
        className="w-[800px] bg-slate-50 border rounded-xl shadow-lg p-6 font-mono text-sm whitespace-pre-wrap"
      >
        <div className="border-b pb-4 mb-4 flex justify-between items-center text-slate-500">
            <div>
                <h1 className="text-xl font-bold text-slate-800 font-sans">{template.name}</h1>
                <p>Versión: {version ? version.version_number : 'N/A'} | Creado: {version ? new Date(version.created_at).toLocaleDateString() : ''}</p>
            </div>
            <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                Teseo Asset Studio
            </div>
        </div>
        
        {version?.content || 'Contenido vacío.'}
      </div>
    </div>
  );
}
