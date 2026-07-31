import Link from 'next/link';

import { getCurrentUser } from '@/lib/session';
import { landingPathFor, ROLE_LABEL } from '@/lib/rbac';
import { logoutAction } from '@/app/login/actions';

export const dynamic = 'force-dynamic';

export default async function ForbiddenPage() {
  const user = await getCurrentUser();

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card-pad max-w-md text-center">
        <h1 className="text-lg font-semibold text-slate-900">Not available for your role</h1>
        <p className="mt-2 text-sm text-slate-600">
          {user
            ? `You are signed in as ${user.name} (${ROLE_LABEL[user.role]}). That page needs different permissions.`
            : 'You need to sign in to view that page.'}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href={user ? landingPathFor(user.role) : '/login'} className="btn-primary">
            {user ? 'Back to your dashboard' : 'Sign in'}
          </Link>
          {user ? (
            // This page sits outside the app shell, so it needs its own way
            // out - otherwise a wrong-role sign-in is a dead end.
            <form action={logoutAction}>
              <button type="submit" className="btn-secondary">
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </main>
  );
}
