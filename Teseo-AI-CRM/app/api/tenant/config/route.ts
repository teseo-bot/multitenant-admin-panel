import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { UserRole } from '@/lib/validators/user';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: tenantUser, error: tuError } = await supabase
      .from('tenant_users')
      .select('tenant_id, role, tenants(id, name, domain)')
      .eq('user_id', user.id)
      .single();

    if (tuError || !tenantUser) {
      return NextResponse.json({ error: 'Tenant not found for user' }, { status: 404 });
    }

    const { data: config, error: configError } = await supabase
      .from('tenant_configs')
      .select('primary_color, accent_color, logo_url, theme_mode')
      .eq('tenant_id', tenantUser.tenant_id)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      return NextResponse.json({ error: configError.message }, { status: 500 });
    }

    const branding = config ? {
      primaryColor: config.primary_color,
      accentColor: config.accent_color,
      logoUrl: config.logo_url,
      themeMode: config.theme_mode
    } : {
      primaryColor: 'oklch(0.556 0.2 250)',
      accentColor: 'oklch(0.97 0 0)',
      logoUrl: null,
      themeMode: 'SYSTEM'
    };

    return NextResponse.json({
      organization: Array.isArray(tenantUser.tenants) ? tenantUser.tenants[0] : tenantUser.tenants,
      role: tenantUser.role,
      branding
    });
  } catch (err: any) {
    if (err?.digest === 'DYNAMIC_SERVER_USAGE') {
      throw err;
    }
    console.error("Error fetching tenant config:", err);
    return NextResponse.json({
      organization: null,
      role: 'member',
      branding: {
        primaryColor: 'oklch(0.556 0.2 250)',
        accentColor: 'oklch(0.97 0 0)',
        logoUrl: null,
        themeMode: 'SYSTEM'
      }
    });
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: tenantUser, error: tuError } = await supabase
    .from('tenant_users')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (tuError || !tenantUser) {
    return NextResponse.json({ error: 'Tenant not found for user' }, { status: 404 });
  }

  if (tenantUser.role !== UserRole.ADMIN && tenantUser.role !== UserRole.OWNER) {
    return NextResponse.json({ error: 'Forbidden. Admin role required.' }, { status: 403 });
  }

  const body = await req.json();
  const { primaryColor, accentColor, logoUrl, themeMode } = body;

  const updatePayload: any = { tenant_id: tenantUser.tenant_id };
  if (primaryColor !== undefined) updatePayload.primary_color = primaryColor;
  if (accentColor !== undefined) updatePayload.accent_color = accentColor;
  if (logoUrl !== undefined) updatePayload.logo_url = logoUrl;
  if (themeMode !== undefined) updatePayload.theme_mode = themeMode;

  const { data, error } = await supabase
    .from('tenant_configs')
    .upsert(updatePayload, { onConflict: 'tenant_id' })
    .select('primary_color, accent_color, logo_url, theme_mode')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    branding: {
      primaryColor: data.primary_color,
      accentColor: data.accent_color,
      logoUrl: data.logo_url,
      themeMode: data.theme_mode
    }
  });
}
