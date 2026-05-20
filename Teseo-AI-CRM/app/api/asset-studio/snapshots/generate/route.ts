import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { chromium } from 'playwright-core';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { templateId, versionId } = body;

    if (!templateId) {
      return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
    }

    // 1. Extraer cookies de sesión para inyectarlas en Headless
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => ({
      name: c.name,
      value: c.value,
      domain: new URL(req.url).hostname,
      path: '/'
    }));

    // 2. Levantar Playwright
    // Nota: En Cloud Run se requiere un ejecutable de Chromium válido
    const browser = await chromium.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext();
    await context.addCookies(cookieHeader);

    const page = await context.newPage();

    // 3. Navegar a una vista de render puro (sin headers/footers)
    // El puerto 3000 es asumido para local; en prod debe ser process.env.NEXT_PUBLIC_APP_URL
    // ADR-135: Dynamic host resolution
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host ? `${protocol}://${host}` : 'http://localhost:3000');
    let targetUrl = `${baseUrl}/asset-studio/render?templateId=${templateId}`;
    if (versionId) targetUrl += `&versionId=${versionId}`;

    await page.goto(targetUrl, { waitUntil: 'networkidle' });

    // 4. Tomar snapshot del contenedor específico
    const element = await page.waitForSelector('#render-container', { timeout: 10000 });
    const buffer = await element.screenshot({ type: 'png' });

    await browser.close();

    // 5. Inyectar en Supabase Storage
    const fileName = `${templateId}/${versionId || 'latest'}-${Date.now()}.png`;
    const { error } = await supabase.storage
      .from('asset_snapshots')
      .upload(fileName, buffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (error) {
      throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from('asset_snapshots')
      .getPublicUrl(fileName);

    return NextResponse.json({ success: true, url: publicUrlData.publicUrl });

  } catch (error: unknown) {
    console.error('[Snapshot API] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
