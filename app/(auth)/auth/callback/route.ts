import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/admin'

  // En Cloud Run, Next.js behind el GFE a veces recibe origin como http://0.0.0.0:3000
  // Para redirigir correctamente usamos x-forwarded-host con HTTPS
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'
  const baseUrl = isLocalEnv ? origin : (forwardedHost ? `https://${forwardedHost}` : origin)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${baseUrl}${next}`)
    } else {
      console.error('Callback error:', error.message)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`)
}
