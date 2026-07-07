import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/auth/guards';
import { pool } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT * FROM lead_assignment_outbox
         WHERE status IN ($1, $2, $3)
         ORDER BY created_at DESC
         LIMIT 100`,
        ['failed', 'dead', 'pending']
      );

      return NextResponse.json(res.rows, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('api.admin.dlq.error', { error: String(err) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
