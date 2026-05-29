import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CampaignEventCreateSchema } from '@/lib/schemas/campaign-events';

// Instanciar Supabase Admin Client para validaciones M2M
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id;
    
    // 1. Validar M2M Auth
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const validToken = process.env.M2M_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!token || token !== validToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Extraer y validar X-Idempotency-Key
    const idempotencyKey = request.headers.get('x-idempotency-key');
    if (!idempotencyKey) {
      return NextResponse.json(
        { success: false, error: 'Validation Error', issues: ['Missing X-Idempotency-Key header'] },
        { status: 400 }
      );
    }

    // 3. Parsear body con Zod
    const body = await request.json();
    const validation = CampaignEventCreateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation Error', issues: validation.error.issues },
        { status: 400 }
      );
    }

    const eventData = validation.data;

    // 4. Validar existencia de campaña (mitigación RLS bypass)
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // 5. Insertar evento
    const { data: insertedEvent, error: insertError } = await supabaseAdmin
      .from('campaign_events')
      .insert({
        campaign_id: campaignId,
        event_type: eventData.eventType,
        agent_role: eventData.agentRole,
        thread_id: eventData.threadId,
        lead_id: eventData.leadId,
        payload: eventData.payload,
        occurred_at: eventData.occurredAt || new Date().toISOString(),
        idempotency_key: idempotencyKey
      })
      .select('id')
      .single();

    if (insertError) {
      // Postgres unique constraint violation (PG Code 23505)
      if (insertError.code === '23505') {
        // Encontrar el UUID existente para la idempotency_key
        const { data: existingEvent } = await supabaseAdmin
          .from('campaign_events')
          .select('id')
          .eq('campaign_id', campaignId)
          .eq('idempotency_key', idempotencyKey)
          .single();

        return NextResponse.json(
          { 
            success: true, 
            message: 'Event already processed', 
            data: { id: existingEvent?.id } 
          },
          { status: 409 }
        );
      }

      console.error('Insert error:', insertError);
      return NextResponse.json(
        { success: false, error: 'Internal Server Error' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data: { id: insertedEvent.id } },
      { status: 201 }
    );

  } catch (error: unknown) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
