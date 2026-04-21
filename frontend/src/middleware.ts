import { NextResponse, type NextRequest } from 'next/server'

/**
 * Edge-runtime auth gate.
 *
 * Pages under the (authenticated) route group require a JWT cookie. Missing
 * token → redirect to /login with a `redirect=` hint so we can bounce the user
 * back to where they were going after sign-in.
 *
 * The token is also mirrored into localStorage / sessionStorage on the client
 * (for the axios interceptor + WebSocket auth). The cookie is the source of
 * truth for server-side gating.
 */

const PUBLIC_PATHS = new Set<string>(['/login', '/setup'])

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  // Static assets, Next internals, and API routes pass through.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/icons') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.json'
  ) {
    return NextResponse.next()
  }

  const token = req.cookies.get('pentagron_token')?.value

  // Public paths — bounce authenticated users away from /login.
  if (PUBLIC_PATHS.has(pathname)) {
    if (token && pathname === '/login') {
      const dest = req.nextUrl.clone()
      dest.pathname = '/'
      dest.search = ''
      return NextResponse.redirect(dest)
    }
    return NextResponse.next()
  }

  // Everything else requires auth.
  if (!token) {
    const dest = req.nextUrl.clone()
    dest.pathname = '/login'
    dest.search = `?redirect=${encodeURIComponent(pathname + search)}`
    return NextResponse.redirect(dest)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image
     * - favicon, manifest, icons
     * (The function above does a finer check too, this is just the coarse net.)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)',
  ],
}
