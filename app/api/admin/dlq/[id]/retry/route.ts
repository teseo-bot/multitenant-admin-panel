import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/auth/guards';
import { pool } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const params = await context.params;
    const { id } = params;

    const client = await pool.connect();
    try {
      // Set back to pending manually bypassing the dead state
      const res = await client.query(
        `UPDATE lead_assignment_outbox
         SET status = $1, attempts = 0, next_retry_at = $2
         WHERE id = $3
         RETURNING *`,
        ['pending', new Date().toISOString(), id]
      );

      if (res.rows.length === 0) {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 });
      }

      // Trigger explicit webhook dispatch logic could go here
      // ...

      return NextResponse.json({ success: true, data: res.rows[0] }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('api.admin.dlq.retry.error', { error: String(err) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
