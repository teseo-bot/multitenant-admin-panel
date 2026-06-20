import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/admin'

  // Construir baseUrl robusto para Cloud Run:
  // 1. En dev local, usar origin directamente
  // 2. En prod, priorizar x-forwarded-host (inyectado por GFE de Cloud Run)
  // 3. Fallback: usar origin si no hay forwardedHost (puede ser 0.0.0.0 pero es último recurso)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'
  const baseUrl = isLocalEnv
    ? origin
    : forwardedHost
      ? `https://${forwardedHost}`
      : origin

  // Si hay código PKCE, intentar canjear por sesión
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Éxito: redirigir al destino solicitado
      return NextResponse.redirect(`${baseUrl}${next}`)
    }
    // Fallo en el exchange: redirigir a error con detalle
    console.error('[auth/callback] exchangeCodeForSession failed:', error.message)
    const errorUrl = new URL('/auth/auth-code-error', baseUrl)
    errorUrl.searchParams.set('error', error.message)
    return NextResponse.redirect(errorUrl)
  }

  // No hay código: redirigir a error
  const errorUrl = new URL('/auth/auth-code-error', baseUrl)
  errorUrl.searchParams.set('error', 'No se recibió código de autenticación')
  return NextResponse.redirect(errorUrl)
}
