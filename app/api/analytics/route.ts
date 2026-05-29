import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Verificación de autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ejecutar ambos RPCs en paralelo (Supabase respetará el app.current_tenant configurado por RLS)
    const [statusData, conversionData] = await Promise.all([
      supabase.rpc('rpc_get_leads_by_status'),
      supabase.rpc('rpc_get_conversion_metrics')
    ]);

    if (statusData.error) {
      console.error('Error fetching leads by status:', statusData.error);
      return NextResponse.json({ error: 'Failed to fetch status analytics' }, { status: 500 });
    }

    if (conversionData.error) {
      console.error('Error fetching conversion metrics:', conversionData.error);
      return NextResponse.json({ error: 'Failed to fetch conversion analytics' }, { status: 500 });
    }

    // Armado de payload consolidado
    const payload = {
      leadsByStatus: statusData.data,
      conversionMetrics: conversionData.data?.[0] || {
        total_leads: 0,
        won_leads: 0,
        lost_leads: 0,
        avg_conversion_rate: 0
      }
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error('Unhandled analytics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
