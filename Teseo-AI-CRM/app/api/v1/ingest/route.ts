import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PgBoss } from 'pg-boss';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Initialize pg-boss singleton (if possible) or connect on demand.
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
let boss: PgBoss | null = null;

async function getBoss() {
  if (!boss) {
    boss = new PgBoss({
      connectionString,
      schema: 'public',
    });
    boss.on('error', (error: unknown) => console.error('[Ingest API] pg-boss error:', error));
    await boss.start();
  }
  return boss;
}

export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = process.env.INGEST_API_KEY;

    if (!expectedApiKey || apiKey !== expectedApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing API Key' },
        { status: 401 }
      );
    }

    const payload = await req.json();
    const idempotencyKey = req.headers.get('idempotency-key') || payload.external_id;

    if (!payload.tenant_id || !idempotencyKey) {
      return NextResponse.json(
        { error: 'Missing tenant_id or external_id (idempotency key)' },
        { status: 400 }
      );
    }

    const source = payload.source || 'api';
    const fileUrl = payload.payload?.media?.url || null;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert new pending record or skip if it already exists (atomic idempotency check)
    // using Supabase upsert with ignoreDuplicates
    const { data: upsertData, error: upsertError } = await supabase
      .from('documents')
      .upsert({
        tenant_id: payload.tenant_id,
        external_id: idempotencyKey,
        source: source,
        raw_file_url: fileUrl,
        status: 'pending'
      }, { 
        onConflict: 'tenant_id, external_id', 
        ignoreDuplicates: true 
      })
      .select('id')
      .maybeSingle();

    if (upsertError) {
      console.error('[Ingest API] Supabase upsert error:', upsertError);
      return NextResponse.json({ error: 'Database error', details: upsertError.message }, { status: 500 });
    }

    let documentId = upsertData?.id;
    let isAlreadyExists = false;

    if (!documentId) {
      // Document already exists, fetch the existing ID to return it
      const { data: existingData, error: existingError } = await supabase
        .from('documents')
        .select('id')
        .eq('tenant_id', payload.tenant_id)
        .eq('external_id', idempotencyKey)
        .single();

      if (existingError || !existingData) {
        console.error('[Ingest API] Supabase fetch existing error:', existingError);
        return NextResponse.json({ error: 'Database error fetching existing document' }, { status: 500 });
      }
      
      documentId = existingData.id;
      isAlreadyExists = true;
    }

    if (isAlreadyExists) {
      return NextResponse.json(
        { status: 'already_exists', document_id: documentId, message: 'Idempotency key matched. Skipped.' },
        { status: 200 }
      );
    }

    // Enqueue job in pg-boss
    const bossInstance = await getBoss();
    const jobId = await bossInstance.send('gbrain_learn', {
      tenant_id: payload.tenant_id,
      document_id: documentId,
      // Pass the rest of the payload context to help the worker
      content: payload.payload?.text || '',
      media: payload.payload?.media ? [payload.payload.media] : []
    });

    return NextResponse.json(
      {
        status: 'accepted',
        document_id: documentId,
        job_id: jobId,
        message: 'Enqueued for processing'
      },
      { status: 202 }
    );
  } catch (error: unknown) {
    console.error('[Ingest API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
