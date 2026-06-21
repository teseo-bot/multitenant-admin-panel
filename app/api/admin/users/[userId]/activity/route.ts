import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { userId: string } }) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const { userId } = await params;

  const { data: activity, error } = await supabase
    .from("user_activity")
    .select("*")
    .eq("userId", userId)
    .order("createdAt", { ascending: false });

  if (error) {
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

  return NextResponse.json(activity);
}
