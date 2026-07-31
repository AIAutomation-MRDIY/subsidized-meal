'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { authenticate } from '@/lib/auth';
import { createSession, destroySession } from '@/lib/session';
import { landingPathFor } from '@/lib/rbac';
import { audit } from '@/lib/orders';

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  const result = await authenticate(parsed.data.email, parsed.data.password);

  if (!result.ok) {
    if (result.reason === 'inactive') {
      return { error: 'This account has been deactivated. Contact your administrator.' };
    }
    if (result.reason === 'no-local-password') {
      return { error: 'This account signs in with SSO. Use the SSO button below.' };
    }
    // Deliberately vague - do not reveal whether the email exists.
    return { error: 'Incorrect email or password.' };
  }

  const { user } = result;
  await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department,
    staffId: user.staffId,
  });
  await audit(user.id, 'auth.login', 'User', user.id, { provider: user.authProvider });

  redirect(landingPathFor(user.role));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/login');
}
