import { createClient } from '@/utils/supabase/server';
import { pool } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const uuidSchema = z.string().uuid();

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const { id } = await context.params;
    if (!id) return new Response(JSON.stringify({ error: 'Missing lead id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const uuidValidation = uuidSchema.safeParse(id);
    if (!uuidValidation.success) {
      return new Response(JSON.stringify({ error: 'Invalid UUID format for id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const client = await pool.connect();
    
    let released = false;
    const cleanup = async () => {
      if (released) return;
      released = true;
      try {
        client.removeAllListeners('notification');
        await client.query('UNLISTEN *');
      } catch (err) {
        console.error("Error during UNLISTEN:", err);
      } finally {
        client.release();
      }
    };

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(new TextEncoder().encode(`: connected\n\n`));

        client.on('notification', (msg) => {
          if (msg.channel === 'inbox_channel' && msg.payload === id) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ lead_id: id, refresh: true })}\n\n`));
          }
        });

        await client.query('LISTEN inbox_channel');

        const keepAlive = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(`: keepalive\n\n`));
          } catch {
            clearInterval(keepAlive);
            cleanup();
          }
        }, 30000);

        request.signal.addEventListener('abort', () => {
          clearInterval(keepAlive);
          cleanup();
        });
      },
      cancel() {
        cleanup();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: unknown) {
    console.error(`GET /api/leads/[id]/messages/stream error:`, error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
