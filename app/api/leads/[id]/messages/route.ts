import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('inbox_messages')
    .select('*')
    .eq('lead_id', params.id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // BYPASS DEV: Simular guardado exitoso si no hay Supabase Auth real
  if (process.env.NODE_ENV === 'development') {
    console.log(`[MOCK] Mensaje simulado para lead ${params.id}`);
    return NextResponse.json({ data: [{ id: "mock-id-123", content: "Mensaje mock", sender: "human_admin" }] });
  }

  const supabase = await createClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('inbox_messages')
    .insert([
      {
        lead_id: params.id,
        content: body.content,
        sender: body.sender || 'human',
        channel: 'web'
      }
    ])
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Automatic Takeover: Si el operador envía un mensaje, silenciamos al agente implícitamente
  if (body.sender === 'human' || !body.sender) {
    const { data: lead } = await supabase
      .from('leads')
      .select('thread_id')
      .eq('id', params.id)
      .single();

    if (lead?.thread_id) {
      const COMPILER_URL = process.env.COMPILER_INTERNAL_URL || 'http://localhost:8000';
      fetch(`${COMPILER_URL}/api/internal/graph/interrupt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: lead.thread_id,
          is_human_handled: true
        })
      }).catch(console.error);
    }
  }

  return NextResponse.json({ data });
}
