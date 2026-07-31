import 'server-only';

import { createRemoteJWKSet, jwtVerify } from 'jose';

import { isOidcEnabled } from './providers';
import type { ExternalIdentity } from './providers';

/**
 * OIDC Authorization Code flow with PKCE - for Azure AD / Entra ID or any
 * standards-compliant IdP. Endpoints are read from the issuer's discovery
 * document, so only OIDC_ISSUER / CLIENT_ID / CLIENT_SECRET are configured.
 *
 * Driven by the routes in src/app/api/auth/oidc/.
 */

type Discovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  issuer: string;
};

let cached: { at: number; doc: Discovery } | null = null;
const DISCOVERY_TTL_MS = 60 * 60 * 1000;

export async function discover(): Promise<Discovery> {
  if (cached && Date.now() - cached.at < DISCOVERY_TTL_MS) return cached.doc;

  const issuer = process.env.OIDC_ISSUER!.replace(/\/$/, '');
  const res = await fetch(`${issuer}/.well-known/openid-configuration`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);

  const doc = (await res.json()) as Discovery;
  cached = { at: Date.now(), doc };
  return doc;
}

export function oidcEnabled(): boolean {
  return isOidcEnabled();
}

export function redirectUri(): string {
  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/api/auth/oidc/callback`;
}

export function randomUrlSafe(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64url(buf);
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function buildAuthorizeUrl(state: string, codeChallenge: string): Promise<string> {
  const doc = await discover();
  const url = new URL(doc.authorization_endpoint);
  url.searchParams.set('client_id', process.env.OIDC_CLIENT_ID!);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('scope', process.env.OIDC_SCOPES ?? 'openid profile email');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

/** Exchange the authorization code and verify the returned id_token. */
export async function exchangeCode(code: string, codeVerifier: string): Promise<ExternalIdentity> {
  const doc = await discover();

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    client_id: process.env.OIDC_CLIENT_ID!,
    code_verifier: codeVerifier,
  });
  if (process.env.OIDC_CLIENT_SECRET) {
    body.set('client_secret', process.env.OIDC_CLIENT_SECRET);
  }

  const res = await fetch(doc.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`OIDC token exchange failed: ${res.status} ${await res.text()}`);
  }

  const tokens = (await res.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error('OIDC response contained no id_token.');

  const jwks = createRemoteJWKSet(new URL(doc.jwks_uri));
  const { payload } = await jwtVerify(tokens.id_token, jwks, {
    issuer: doc.issuer,
    audience: process.env.OIDC_CLIENT_ID!,
  });

  const claims = payload as Record<string, unknown>;
  const email = String(claims.email ?? claims.preferred_username ?? '').toLowerCase();
  if (!email) throw new Error('OIDC id_token contained no email claim.');

  return {
    provider: 'OIDC',
    externalId: String(claims.sub),
    email,
    name: String(claims.name ?? email.split('@')[0]),
    staffId: claims.employeeid ? String(claims.employeeid) : null,
    department: claims.department ? String(claims.department) : null,
  };
}
