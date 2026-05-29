import { Pool } from 'pg';
import { getTenantContext } from '@/lib/auth/get-tenant-context';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const result = await getTenantContext(request);
  if (!result.ok) return new Response(result.err.error, { status: result.err.status });
  const { tenantId } = result.ctx;

  const safeTenantId = tenantId.replace(/[^a-zA-Z0-9_-]/g, '');

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      
      const client = await pool.connect();
      
      try {
        await client.query(`SET search_path = "tenant_${safeTenantId}", public`);
        await client.query(`LISTEN "inbox_updates"`);

        const heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        }, 15000);

        client.on('notification', (msg) => {
          controller.enqueue(encoder.encode(`data: ${msg.payload}\n\n`));
        });

        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          client.release();
          pool.end();
          controller.close();
        });
      } catch (err) {
        console.error('SSE DB Error:', err);
        client.release();
        pool.end();
        controller.error(err);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}