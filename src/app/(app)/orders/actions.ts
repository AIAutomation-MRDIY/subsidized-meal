'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { assertCapability } from '@/lib/session';

/** Mark a refund notification as seen so the in-app banner stops showing. */
export async function dismissRefundBanner(formData: FormData): Promise<void> {
  const user = await assertCapability('order:place');
  const orderId = String(formData.get('orderId') ?? '');
  if (!orderId) return;

  await prisma.order.updateMany({
    where: { id: orderId, userId: user.id, status: 'REFUNDED' },
    data: { refundSeenAt: new Date() },
  });

  revalidatePath('/orders');
}
