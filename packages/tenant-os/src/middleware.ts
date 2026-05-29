
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Define public and authentication-related routes
const PUBLIC_PREFIXES = ['/auth', '/api', '/unauthorized-tenant'];
const AUTH_ROUTE = '/auth/login';
const DASHBOARD_ROUTE = '/dashboard';

export async function middleware(request: NextRequest) {
  // Start with a clean response object. We'll modify it as needed.
  let response = NextResponse.next({
    request, // Correctly pass the full request object as per the Builder's report
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // The cookie functions now operate on the `response` object.
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // This call refreshes the session and updates the cookies in the `response` object
  // if the session token is expired.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;

  // Rule 1: Authenticated user on an auth page -> redirect to dashboard
  if (session && pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL(DASHBOARD_ROUTE, request.url));
  }

  // Rule 2: Allow access to explicitly public routes or the root page
  if (PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix)) || pathname === '/') {
    return response; // Return the response object which may have updated cookies
  }

  // Rule 3: Unauthenticated user on a protected route -> redirect to login
  if (!session) {
    const redirectUrl = new URL(AUTH_ROUTE, request.url);
    if (pathname !== '/') {
        redirectUrl.searchParams.set('redirectTo', pathname);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // Rule 4: All checks passed. User is authenticated and on a protected route.
  // Return the potentially modified response.
  return response;
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
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
