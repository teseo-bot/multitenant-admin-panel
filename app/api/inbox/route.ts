import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getTenantContext } from '@/lib/auth/get-tenant-context';

export async function GET(request: Request) {
  try {
    const result = await getTenantContext(request);
    if (!result.ok) return new Response(result.err.error, { status: result.err.status });
    const { tenantId } = result.ctx;

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    const client = await pool.connect();
    try {
      const safeTenantId = tenantId.replace(/[^a-zA-Z0-9_-]/g, '');
      await client.query(`SET search_path = "tenant_${safeTenantId}", public`);
      
      const leadsRes = await client.query(`SELECT id, name, status, source FROM leads;`);
      const msgsRes = await client.query(`
        SELECT id, lead_id, content, created_at, sender 
        FROM inbox_messages 
        ORDER BY created_at DESC;
      `);
      
      return NextResponse.json({ leads: leadsRes.rows, messages: msgsRes.rows });
    } finally {
      await client.query(`RESET search_path`);
      client.release();
      await pool.end();
    }
  } catch (error: any) {
    console.error('API Inbox Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
