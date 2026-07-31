'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { loginAction, type LoginState } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Signing in...' : 'Sign in'}
    </button>
  );
}

export function LoginForm({ ssoEnabled, ldapEnabled }: { ssoEnabled: boolean; ldapEnabled: boolean }) {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        {state.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {state.error}
          </div>
        ) : null}

        <div>
          <label htmlFor="email" className="label">
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            className="input"
            placeholder="name@mrdiy.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="input"
            placeholder="••••••••"
          />
        </div>

        <SubmitButton />
      </form>

      {ldapEnabled ? (
        <p className="text-center text-xs text-slate-500">
          Your MR DIY directory password works here.
        </p>
      ) : null}

      {ssoEnabled ? (
        <>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs uppercase tracking-wide text-slate-400">or</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <a href="/api/auth/oidc/start" className="btn-secondary w-full">
            Sign in with company SSO
          </a>
        </>
      ) : null}
    </div>
  );
}
