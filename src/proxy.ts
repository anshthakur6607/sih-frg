import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/login', '/register', '/forgot-password'];
const AUTH_PATHS = ['/dashboard', '/courses', '/certificates', '/assessments', '/quiz', '/admin', '/assessment', '/quiz-generator', '/ai-tutor', '/learning-path', '/survey', '/my-courses', '/live-quiz', '/recommendations', '/gamification', '/roadmap'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'));
}

function requiresAuth(pathname: string): boolean {
  return AUTH_PATHS.some(path => pathname.startsWith(path));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname) || !requiresAuth(pathname)) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (pathname === '/setup-profile') {
      return supabaseResponse;
    }

    if (pathname.startsWith('/api')) {
      return supabaseResponse;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, designation, department')
      .eq('id', user.id)
      .maybeSingle();

    if (pathname.startsWith('/dashboard/admin') || pathname.startsWith('/admin')) {
      if (profile?.role !== 'admin' && profile?.role !== 'manager') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    if (!profile?.designation || !profile?.department) {
      if (pathname !== '/setup-profile') {
        return NextResponse.redirect(new URL('/setup-profile', request.url));
      }
    }

    return supabaseResponse;
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
