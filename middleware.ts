import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = ['/admin', '/tenants', '/settings', '/knowledge-ops', '/lab']
const AUTH_ROUTES = ['/auth/login', '/auth/callback', '/auth/auth-code-error']
const SESSION_COOKIE = '__session'

export function middleware(request: NextRequest) {
  // Handle root redirect directly in middleware to avoid NEXT_REDIRECT errors in layout/page
  if (request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  const pathname = request.nextUrl.pathname
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value

  // If authenticated and trying to access auth routes, redirect to dashboard
  if (sessionCookie && AUTH_ROUTES.some(r => pathname.startsWith(r))) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/users'
    return NextResponse.redirect(url)
  }

  // If NOT authenticated and trying to access protected routes, redirect to login with reason
  if (!sessionCookie && PROTECTED_PREFIXES.some(p => pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('reason', 'expired')
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
