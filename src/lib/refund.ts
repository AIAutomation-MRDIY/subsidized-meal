import 'server-only';

import { prisma } from './prisma';
import { refundPayment } from './hitpay';
import { getEntityCredentials } from './entity-config';
import { audit } from './orders';
import { sendEmail } from './email';
import { refundSuccessEmail, refundQueuedEmail, refundFailedEmployeeEmail, refundFailedAdminEmail } from './email-templates';
import { formatWeekRange } from './cycle';
import type { SiteSettings } from './settings';

// ---------------------------------------------------------------------------
// Employee batch path — queue the request, HitPay is called later by cron
// ---------------------------------------------------------------------------

export type QueueRefundResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Record a cancel+refund request from an employee.
 * Marks the order REFUND_PENDING without touching HitPay.
 * The nightly cron job picks it up and issues the actual refund.
 */
export async function queueRefundRequest(
  orderId: string,
  actorId: string,
  reason: string,
): Promise<QueueRefundResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      reference: true,
      user: { select: { name: true, email: true } },
      cycle: { select: { serviceWeekStart: true } },
    },
  });

  if (!order) return { ok: false, error: 'Order not found.' };
  if (order.status !== 'PAID') {
    return { ok: false, error: 'Only paid orders can be cancelled.' };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'REFUND_PENDING',
      cancelledAt: new Date(),
      cancelReason: reason,
    },
  });

  await audit(actorId, 'order.refund_queued', 'Order', orderId, {
    reference: order.reference,
    reason,
  });

  if (order.user.email) {
    const { subject, html } = refundQueuedEmail({
      name: order.user.name,
      reference: order.reference,
      serviceWeek: formatWeekRange(order.cycle.serviceWeekStart),
      appUrl: process.env.APP_URL ?? '',
    });
    await sendEmail({ to: order.user.email, subject, html }).catch((err) =>
      console.error('[refund] queue email failed for', order.reference, err),
    );
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Immediate path — calls HitPay now; used by admin and the nightly cron
// ---------------------------------------------------------------------------

export type ProcessRefundResult =
  | { ok: true; refundId: string }
  | { ok: false; error: string };

const MAX_REFUND_ATTEMPTS = 7;

/**
 * Attempt an immediate HitPay refund for a PAID, REFUND_PENDING, or REFUND_FAILED order.
 * Tracks attempt count. After MAX_REFUND_ATTEMPTS failures the order is marked
 * REFUND_FAILED so the nightly cron stops retrying. Admins can still retry manually.
 */
export async function processRefund(
  orderId: string,
  actorId: string | null,
  reason?: string,
): Promise<ProcessRefundResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payments: {
        where: { status: 'SUCCEEDED' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      user: { select: { name: true, email: true } },
      cycle: { select: { serviceWeekStart: true } },
    },
  });

  if (!order) return { ok: false, error: 'Order not found.' };
  if (order.status !== 'PAID' && order.status !== 'REFUND_PENDING' && order.status !== 'REFUND_FAILED') {
    return { ok: false, error: `Order is ${order.status} — only PAID, REFUND_PENDING, or REFUND_FAILED orders can be refunded.` };
  }

  const newAttempts = (order.refundAttempts ?? 0) + 1;
  await prisma.order.update({
    where: { id: orderId },
    data: { refundAttempts: newAttempts, lastRefundAttemptAt: new Date() },
  });

  const payment = order.payments[0];
  if (!payment) return { ok: false, error: 'No successful payment found for this order.' };
  if (!payment.paymentId) {
    return { ok: false, error: 'Payment ID is missing — cannot process refund.' };
  }

  const entityId = order.entityId ?? 'trading';

  let apiKey: string;
  let mode: string;
  try {
    const creds = await getEntityCredentials(entityId);
    apiKey = creds.apiKey;
    mode = creds.mode;
  } catch {
    return { ok: false, error: 'HitPay is not configured for this entity.' };
  }

  try {
    const refund = await refundPayment({
      paymentRequestId: payment.requestId ?? '',
      paymentId: payment.paymentId,
      amountSen: payment.amountSen,
      apiKey,
      mode,
    });

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'REFUNDED' },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'REFUNDED',
          refundSeenAt: null, // reset so the in-app banner shows
          cancelledAt: order.cancelledAt ?? new Date(),
          cancelReason: order.cancelReason ?? reason ?? 'Refunded',
        },
      }),
    ]);

    await audit(actorId, 'order.refunded', 'Order', order.id, {
      reference: order.reference,
      amountSen: payment.amountSen,
      refundId: refund.id,
    });

    if (order.user.email) {
      const { subject, html } = refundSuccessEmail({
        name: order.user.name,
        reference: order.reference,
        amountSen: payment.amountSen,
        serviceWeek: formatWeekRange(order.cycle.serviceWeekStart),
        appUrl: process.env.APP_URL ?? '',
      });
      await sendEmail({ to: order.user.email, subject, html }).catch((err) =>
        console.error('[refund] email failed for', order.reference, err),
      );
    }

    return { ok: true, refundId: refund.id };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Refund failed.';
    console.error('[refund] processRefund failed for', order.reference, `(attempt ${newAttempts})`, err);

    if (newAttempts >= MAX_REFUND_ATTEMPTS) {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'REFUND_FAILED' },
      });
      await audit(actorId, 'order.refund_failed', 'Order', order.id, {
        reference: order.reference,
        attempts: newAttempts,
        lastError: errMsg,
      });

      if (order.user.email) {
        const { subject, html } = refundFailedEmployeeEmail({
          name: order.user.name,
          reference: order.reference,
          amountSen: payment.amountSen,
          appUrl: process.env.APP_URL ?? '',
        });
        await sendEmail({ to: order.user.email, subject, html }).catch((err) =>
          console.error('[refund] employee failed email failed for', order.reference, err),
        );
      }

      try {
        const admins = await prisma.user.findMany({
          where: { OR: [{ superAdmin: true }, { role: 'ADMIN' }] },
          select: { email: true },
        });
        const { subject, html } = refundFailedAdminEmail({
          reference: order.reference,
          employeeName: order.user.name,
          attempts: newAttempts,
          amountSen: payment.amountSen,
          appUrl: process.env.APP_URL ?? '',
        });
        await Promise.all(
          admins.filter((a) => a.email).map((a) =>
            sendEmail({ to: a.email!, subject, html }).catch((err) =>
              console.error('[refund] admin alert email failed', err),
            ),
          ),
        );
      } catch (err) {
        console.error('[refund] admin alert query failed', err);
      }
    }

    return { ok: false, error: errMsg };
  }
}

// ---------------------------------------------------------------------------
// Eligibility check
// ---------------------------------------------------------------------------

/**
 * Check whether a user is currently allowed to self-cancel their PAID order.
 * The window is open from cycle.orderOpenAt until cycle.orderCutoffAt.
 */
export function canUserCancelOrder(
  order: { status: string },
  settings: Pick<SiteSettings, 'selfCancelEnabled'>,
  cycle: { orderOpenAt: Date; orderCutoffAt: Date },
): { allowed: boolean; reason?: string; minutesLeft?: number } {
  if (!settings.selfCancelEnabled) {
    return { allowed: false, reason: 'Self-cancellation is not enabled.' };
  }
  if (order.status !== 'PAID') {
    return { allowed: false, reason: 'Only paid orders can be cancelled.' };
  }

  const now = Date.now();

  if (now < cycle.orderOpenAt.getTime()) {
    return { allowed: false, reason: 'The cancellation window has not opened yet.' };
  }

  const msLeft = cycle.orderCutoffAt.getTime() - now;
  if (msLeft <= 0) {
    return { allowed: false, reason: 'The ordering cutoff for this cycle has passed.' };
  }

  const minutesLeft = Math.ceil(msLeft / 60000);
  return { allowed: true, minutesLeft };
}
