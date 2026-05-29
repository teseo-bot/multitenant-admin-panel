import { pool } from '@/lib/db';
import { getTenantContext } from '@/lib/auth/get-tenant-context';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const result = await getTenantContext(request);
    if (!result.ok) return new Response(result.err.error, { status: result.err.status });
    const { tenantId } = result.ctx;

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
          if (msg.channel === 'tenant_alerts_channel') {
            try {
              const payload = JSON.parse(msg.payload || '{}');
              // Strict tenant isolation check (ADR-135)
              if (payload.tenant_id === tenantId) {
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`));
              }
            } catch (err) {
               console.error("Error parsing SSE payload", err);
            }
          }
        });

        await client.query('LISTEN tenant_alerts_channel');

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
    console.error(`GET /api/system/alerts/stream error:`, error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
