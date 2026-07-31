import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/session';
import { landingPathFor } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user ? landingPathFor(user.role) : '/login');
}
