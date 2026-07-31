import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { exchangeCode, oidcEnabled } from '@/lib/auth/oidc';
import { provisionFromDirectory } from '@/lib/auth';
import { createSession } from '@/lib/session';
import { landingPathFor } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function base(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export async function GET(request: Request) {
  if (!oidcEnabled()) {
    return NextResponse.redirect(`${base()}/login?error=sso_disabled`);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const idpError = url.searchParams.get('error');

  const store = await cookies();
  const expectedState = store.get('oidc_state')?.value;
  const verifier = store.get('oidc_verifier')?.value;

  // One-shot values - clear them before doing anything else.
  store.delete('oidc_state');
  store.delete('oidc_verifier');

  if (idpError) {
    console.warn('[auth] IdP returned an error:', idpError);
    return NextResponse.redirect(`${base()}/login?error=sso_failed`);
  }
  if (!code || !state || !expectedState || !verifier || state !== expectedState) {
    return NextResponse.redirect(`${base()}/login?error=sso_state`);
  }

  try {
    const identity = await exchangeCode(code, verifier);
    const user = await provisionFromDirectory(identity);

    if (!user.active) {
      return NextResponse.redirect(`${base()}/login?error=inactive`);
    }

    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      staffId: user.staffId,
    });

    await prisma.auditLog.create({
      data: { actorId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id, metadata: { provider: 'OIDC' } },
    });

    return NextResponse.redirect(`${base()}${landingPathFor(user.role)}`);
  } catch (err) {
    console.error('[auth] OIDC callback failed:', err);
    return NextResponse.redirect(`${base()}/login?error=sso_failed`);
  }
}
