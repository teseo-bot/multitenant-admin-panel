import { NextResponse, NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { inviteUserSchema } from "@/lib/schemas/tenant";

const supabaseAdmin = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabaseAdmin) {
       return NextResponse.json({ error: "Missing Supabase admin config" }, { status: 500 });
    }

    const { id: tenantId } = await context.params;
    
    // Auth Check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Platform super-admin bypass: PLATFORM_ADMIN_EMAIL can manage any tenant
    const platformAdminEmail = process.env.PLATFORM_ADMIN_EMAIL;
    const isPlatformAdmin = platformAdminEmail && user.email === platformAdminEmail;

    if (!isPlatformAdmin) {
      const { data: currentMembership } = await supabaseAdmin
        .from("tenant_users")
        .select("role")
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .single();

      if (!currentMembership || !["OWNER", "ADMIN"].includes(currentMembership.role)) {
        return NextResponse.json({ error: "Forbidden: Solo OWNER/ADMIN pueden invitar usuarios" }, { status: 403 });
      }
    }

    const body = await request.json();
    const { email, role } = inviteUserSchema.parse(body);

    // 1. Invite user via Supabase Auth admin
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // 2. Add to tenant_users
    const { error: dbError } = await supabaseAdmin
      .from("tenant_users")
      .upsert({
        tenant_id: tenantId,
        user_id: userId,
        role: role,
      }, { onConflict: "tenant_id,user_id" });

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user_id: userId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
