import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import {
  orderConfirmedEmail,
  refundSuccessEmail,
  refundQueuedEmail,
  refundFailedEmployeeEmail,
  refundFailedAdminEmail,
  mealNotReceivedAdminEmail,
  invoiceUploadedAdminEmail,
} from '@/lib/email-templates';
import { formatWeekRange, toDateKey } from '@/lib/cycle';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = req.headers.get('x-cron-secret');
  return secret === process.env.CRON_SECRET;
}

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

async function getOneAdmin() {
  const admin = await prisma.user.findFirst({
    where: { OR: [{ superAdmin: true }, { role: 'ADMIN' }], email: { not: null } },
    select: { name: true, email: true },
  });
  return admin?.email ? (admin as { name: string; email: string }) : null;
}

// ---------------------------------------------------------------------------
// GET /api/test-email?event=<name>[&order=<id>][&item=<id>][&invoice=<id>]
//
// Events:
//   order-confirmed      → employee who placed the order
//   refund-queued        → employee whose refund was queued
//   refund-success       → employee whose refund succeeded
//   refund-failed        → employee (failed notice) + first admin (alert)
//   meal-not-received    → first admin
//   invoice-uploaded     → first admin
//
// Responds immediately after DB lookups; email sends happen in the background.
// ---------------------------------------------------------------------------

const VALID_EVENTS = ['order-confirmed', 'refund-queued', 'refund-success', 'refund-failed', 'meal-not-received', 'invoice-uploaded'];

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const event     = searchParams.get('event');
  const orderId   = searchParams.get('order')   ?? undefined;
  const itemId    = searchParams.get('item')    ?? undefined;
  const invoiceId = searchParams.get('invoice') ?? undefined;

  if (!event) {
    return NextResponse.json(
      { error: `Provide ?event=<name>. Valid: ${VALID_EVENTS.join(', ')}` },
      { status: 400 },
    );
  }
  if (!VALID_EVENTS.includes(event)) {
    return NextResponse.json(
      { error: `Unknown event "${event}". Valid: ${VALID_EVENTS.join(', ')}` },
      { status: 400 },
    );
  }

  // Collect { to, subject, html } pairs from DB, then fire and forget
  const sends: { label: string; to: string; subject: string; html: string }[] = [];

  // ── order-confirmed ──────────────────────────────────────────────────────
  if (event === 'order-confirmed') {
    const order = await prisma.order.findFirst({
      where: orderId ? { id: orderId } : { status: 'PAID' },
      orderBy: orderId ? undefined : { paidAt: 'desc' },
      select: {
        reference: true, netSen: true,
        user: { select: { name: true, email: true } },
        cycle: { select: { serviceWeekStart: true } },
        _count: { select: { items: true } },
      },
    });
    if (!order) return NextResponse.json({ error: 'No PAID order found' }, { status: 404 });
    if (!order.user.email) return NextResponse.json({ error: `User "${order.user.name}" has no email` }, { status: 400 });
    const { subject, html } = orderConfirmedEmail({
      name: order.user.name, reference: order.reference, amountSen: order.netSen,
      serviceWeek: formatWeekRange(order.cycle.serviceWeekStart), mealCount: order._count.items, appUrl: APP_URL,
    });
    sends.push({ label: event, to: order.user.email, subject, html });
  }

  // ── refund-queued ────────────────────────────────────────────────────────
  else if (event === 'refund-queued') {
    const order = await prisma.order.findFirst({
      where: orderId ? { id: orderId } : { status: 'PAID' },
      orderBy: orderId ? undefined : { paidAt: 'desc' },
      select: {
        reference: true,
        user: { select: { name: true, email: true } },
        cycle: { select: { serviceWeekStart: true } },
      },
    });
    if (!order) return NextResponse.json({ error: 'No order found' }, { status: 404 });
    if (!order.user.email) return NextResponse.json({ error: `User "${order.user.name}" has no email` }, { status: 400 });
    const { subject, html } = refundQueuedEmail({
      name: order.user.name, reference: order.reference,
      serviceWeek: formatWeekRange(order.cycle.serviceWeekStart), appUrl: APP_URL,
    });
    sends.push({ label: event, to: order.user.email, subject, html });
  }

  // ── refund-success ───────────────────────────────────────────────────────
  else if (event === 'refund-success') {
    const order = await prisma.order.findFirst({
      where: orderId ? { id: orderId } : { status: 'PAID' },
      orderBy: orderId ? undefined : { paidAt: 'desc' },
      select: {
        reference: true, netSen: true,
        user: { select: { name: true, email: true } },
        cycle: { select: { serviceWeekStart: true } },
      },
    });
    if (!order) return NextResponse.json({ error: 'No order found' }, { status: 404 });
    if (!order.user.email) return NextResponse.json({ error: `User "${order.user.name}" has no email` }, { status: 400 });
    const { subject, html } = refundSuccessEmail({
      name: order.user.name, reference: order.reference, amountSen: order.netSen,
      serviceWeek: formatWeekRange(order.cycle.serviceWeekStart), appUrl: APP_URL,
    });
    sends.push({ label: event, to: order.user.email, subject, html });
  }

  // ── refund-failed — employee + first admin ───────────────────────────────
  else if (event === 'refund-failed') {
    const order = await prisma.order.findFirst({
      where: orderId ? { id: orderId } : { status: 'PAID' },
      orderBy: orderId ? undefined : { paidAt: 'desc' },
      select: {
        reference: true, netSen: true, refundAttempts: true,
        user: { select: { name: true, email: true } },
      },
    });
    if (!order) return NextResponse.json({ error: 'No order found' }, { status: 404 });
    const admin = await getOneAdmin();
    if (!admin) return NextResponse.json({ error: 'No admin with email found' }, { status: 400 });

    if (order.user.email) {
      const { subject, html } = refundFailedEmployeeEmail({
        name: order.user.name, reference: order.reference, amountSen: order.netSen, appUrl: APP_URL,
      });
      sends.push({ label: 'refund-failed-employee', to: order.user.email, subject, html });
    }
    const { subject, html } = refundFailedAdminEmail({
      reference: order.reference, employeeName: order.user.name,
      attempts: order.refundAttempts || 3, amountSen: order.netSen, appUrl: APP_URL,
    });
    sends.push({ label: 'refund-failed-admin', to: admin.email, subject, html });
  }

  // ── meal-not-received — first admin ──────────────────────────────────────
  else if (event === 'meal-not-received') {
    const item = await prisma.orderItem.findFirst({
      where: itemId ? { id: itemId } : { notReceivedAt: { not: null } },
      orderBy: itemId ? undefined : { notReceivedAt: 'desc' },
      select: {
        dishName: true, serviceDate: true,
        order: { select: { reference: true, user: { select: { name: true } } } },
      },
    });
    if (!item) return NextResponse.json({ error: 'No meal-not-received item found' }, { status: 404 });
    const admin = await getOneAdmin();
    if (!admin) return NextResponse.json({ error: 'No admin with email found' }, { status: 400 });
    const { subject, html } = mealNotReceivedAdminEmail({
      employeeName: item.order.user.name, dishName: item.dishName,
      serviceDate: toDateKey(item.serviceDate), orderReference: item.order.reference, appUrl: APP_URL,
    });
    sends.push({ label: event, to: admin.email, subject, html });
  }

  // ── invoice-uploaded — first admin ───────────────────────────────────────
  else if (event === 'invoice-uploaded') {
    const invoice = await prisma.vendorInvoice.findFirst({
      where: invoiceId ? { id: invoiceId } : {},
      orderBy: invoiceId ? undefined : { uploadedAt: 'desc' },
      select: {
        invoiceNumber: true, amountSen: true,
        restaurant: { select: { name: true } },
        cycle: { select: { serviceWeekStart: true } },
        uploadedBy: { select: { name: true } },
      },
    });
    if (!invoice) return NextResponse.json({ error: 'No vendor invoice found' }, { status: 404 });
    const admin = await getOneAdmin();
    if (!admin) return NextResponse.json({ error: 'No admin with email found' }, { status: 400 });
    const { subject, html } = invoiceUploadedAdminEmail({
      restaurantName: invoice.restaurant.name, cycleWeek: formatWeekRange(invoice.cycle.serviceWeekStart),
      invoiceNumber: invoice.invoiceNumber ?? undefined, amountSen: invoice.amountSen,
      uploadedBy: invoice.uploadedBy?.name ?? 'Admin', appUrl: APP_URL,
    });
    sends.push({ label: event, to: admin.email, subject, html });
  }

  const results: { event: string; to: string; status: 'sent' | 'failed'; error?: string }[] = [];
  for (const s of sends) {
    try {
      await sendEmail({ to: s.to, subject: s.subject, html: s.html });
      results.push({ event: s.label, to: s.to, status: 'sent' });
    } catch (err) {
      results.push({ event: s.label, to: s.to, status: 'failed', error: String(err) });
    }
  }

  return NextResponse.json({ results });
}
