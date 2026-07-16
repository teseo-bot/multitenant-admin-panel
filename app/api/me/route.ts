import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    platformAdmin: user.platformAdmin,
  });
}
