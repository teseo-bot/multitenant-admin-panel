import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/admin'

  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'
  const baseUrl = isLocalEnv
    ? origin
    : forwardedHost
      ? `https://${forwardedHost}`
      : origin

  logger.info('auth.callback.start', { hasCode: !!code, next, forwardedHost, isLocalEnv })

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      logger.info('auth.callback.success', { next })
      return NextResponse.redirect(`${baseUrl}${next}`)
    }
    logger.error('auth.callback.exchange_failed', { error: error.message, code: error.code })
    const errorUrl = new URL('/auth/auth-code-error', baseUrl)
    errorUrl.searchParams.set('error', error.message)
    return NextResponse.redirect(errorUrl)
  }

  logger.warn('auth.callback.no_code', { origin, forwardedHost })
  const errorUrl = new URL('/auth/auth-code-error', baseUrl)
  errorUrl.searchParams.set('error', 'No se recibió código de autenticación')
  return NextResponse.redirect(errorUrl)
}
