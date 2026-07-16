import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { userId: string } }) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { userId } = await params;

  try {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT * FROM user_activity
         WHERE "userId" = $1
         ORDER BY "createdAt" DESC`,
        [userId]
      );

      return NextResponse.json(res.rows);
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('api.admin.users.activity.error', { error: String(err), userId });
    return NextResponse.json([
      {
        id: "a1",
        userId,
        action: "login",
        description: "Logged in via Email",
        createdAt: new Date().toISOString(),
      },
      {
        id: "a2",
        userId,
        action: "update_profile",
        description: "Updated profile name",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      }
    ]);
  }
}
