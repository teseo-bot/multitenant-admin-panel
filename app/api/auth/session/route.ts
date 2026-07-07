import { NextResponse, type NextRequest } from 'next/server';
import { createSession, verifySession, destroySession, SESSION_COOKIE } from '@/lib/gcp-auth/session';

export const dynamic = 'force-dynamic';

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json() as { idToken: string };

    if (!idToken) {
      return NextResponse.json(
        { ok: false, error: 'Missing idToken' },
        { status: 400 }
      );
    }

    const sessionCookie = await createSession(idToken);

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: SEVEN_DAYS_SECONDS,
      path: '/',
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Invalid idToken' },
      { status: 401 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieValue = request.cookies.get(SESSION_COOKIE)?.value;

    if (cookieValue) {
      const decoded = await verifySession(cookieValue);
      if (decoded) {
        await destroySession(decoded.uid);
      }
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Error destroying session' },
      { status: 500 }
    );
  }
}
