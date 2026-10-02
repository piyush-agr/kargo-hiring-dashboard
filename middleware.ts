import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return NextResponse.next();
  const h = req.headers.get('authorization') || '';
  if (h.startsWith('Basic ')) {
    const [, p] = atob(h.slice(6)).split(':');
    if (p === pw) return NextResponse.next();
  }
  return new NextResponse('Auth required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Kargo Hiring"' } });
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
