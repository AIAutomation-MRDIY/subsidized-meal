import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { buildAuthorizeUrl, oidcEnabled, pkceChallenge, randomUrlSafe } from '@/lib/auth/oidc';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  if (!oidcEnabled()) {
    return NextResponse.redirect(new URL('/login?error=sso_disabled', process.env.APP_URL ?? 'http://localhost:3000'));
  }

  const state = randomUrlSafe();
  const verifier = randomUrlSafe(48);
  const challenge = await pkceChallenge(verifier);

  const store = await cookies();
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600, // the round trip should take well under 10 minutes
  };
  store.set('oidc_state', state, opts);
  store.set('oidc_verifier', verifier, opts);

  return NextResponse.redirect(await buildAuthorizeUrl(state, challenge));
}
