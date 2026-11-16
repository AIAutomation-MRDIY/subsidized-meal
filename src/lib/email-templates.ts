import { formatSen } from './money';

// ---------------------------------------------------------------------------
// HTML email templates.
// All templates return a complete HTML document safe to send as an email body.
// ---------------------------------------------------------------------------

const baseStyle = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f8fafc; margin: 0; padding: 0;
`;

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${baseStyle}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- Header -->
        <tr>
          <td style="background:#c8102e;border-radius:12px 12px 0 0;padding:24px 32px">
            <p style="margin:0;font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.3px">
              MR DIY Food Ordering
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#fff;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:0 0 12px 12px;padding:16px 32px">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">
              This is an automated message from MR DIY Food Ordering. Please do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Refund successful
// ---------------------------------------------------------------------------

export function refundSuccessEmail(opts: {
  name: string;
  reference: string;
  amountSen: number;
  serviceWeek: string;
  appUrl: string;
}): { subject: string; html: string } {
  const amount = formatSen(opts.amountSen);

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a">
      Your refund has been processed ✓
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569">
      Hi ${opts.name}, your refund for order <strong>${opts.reference}</strong> has been successfully processed.
    </p>

    <!-- Amount card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
      <tr>
        <td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px 24px">
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:0.5px">
            Refund Amount
          </p>
          <p style="margin:0;font-size:28px;font-weight:700;color:#15803d">${amount}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#4ade80">Service week: ${opts.serviceWeek}</p>
        </td>
      </tr>
    </table>

    <!-- Details -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px">
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9">
          <span style="font-size:12px;color:#94a3b8">Order Reference</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a;font-family:monospace">${opts.reference}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px">
          <span style="font-size:12px;color:#94a3b8">Status</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#15803d">Refunded</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px;font-size:14px;color:#64748b">
      The refund has been sent back to your original payment method. Depending on your bank, it may take
      <strong>3–10 business days</strong> to appear in your account.
    </p>

    <a href="${opts.appUrl}/orders"
       style="display:inline-block;background:#c8102e;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">
      View My Orders
    </a>
  `;

  return {
    subject: `Refund processed — ${opts.reference} (${amount})`,
    html: layout(content),
  };
}

// ---------------------------------------------------------------------------
// Order confirmed (payment received)
// ---------------------------------------------------------------------------

export function orderConfirmedEmail(opts: {
  name: string;
  reference: string;
  amountSen: number;
  serviceWeek: string;
  mealCount: number;
  appUrl: string;
}): { subject: string; html: string } {
  const amount = formatSen(opts.amountSen);

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a">
      Order confirmed ✓
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569">
      Hi ${opts.name}, your payment has been received and your meal order is confirmed.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px">
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9">
          <span style="font-size:12px;color:#94a3b8">Order Reference</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a;font-family:monospace">${opts.reference}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9">
          <span style="font-size:12px;color:#94a3b8">Service Week</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a">${opts.serviceWeek}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9">
          <span style="font-size:12px;color:#94a3b8">Meals</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a">${opts.mealCount} meal${opts.mealCount !== 1 ? 's' : ''}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px">
          <span style="font-size:12px;color:#94a3b8">Amount Paid</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a">${amount}</p>
        </td>
      </tr>
    </table>

    <a href="${opts.appUrl}/orders"
       style="display:inline-block;background:#c8102e;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">
      View My Orders
    </a>
  `;

  return {
    subject: `Order confirmed — ${opts.reference}`,
    html: layout(content),
  };
}

// ---------------------------------------------------------------------------
// Meal not received — admin alert
// ---------------------------------------------------------------------------

export function mealNotReceivedAdminEmail(opts: {
  employeeName: string;
  dishName: string;
  serviceDate: string;
  orderReference: string;
  appUrl: string;
}): { subject: string; html: string } {
  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a">
      Meal not received — action may be needed
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569">
      An employee has reported that their meal was not received today.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #fed7aa;border-radius:8px;background:#fff7ed">
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #fed7aa">
          <span style="font-size:12px;color:#9a3412">Employee</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a">${opts.employeeName}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #fed7aa">
          <span style="font-size:12px;color:#9a3412">Dish</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a">${opts.dishName}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #fed7aa">
          <span style="font-size:12px;color:#9a3412">Service Date</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a">${opts.serviceDate}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px">
          <span style="font-size:12px;color:#9a3412">Order Reference</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a;font-family:monospace">${opts.orderReference}</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px;font-size:14px;color:#64748b">
      Please check the Kitchen Counts page for a full list of unreceived meals today, and follow up with the restaurant if needed.
    </p>

    <a href="${opts.appUrl}/kitchen"
       style="display:inline-block;background:#c8102e;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">
      View Kitchen Counts
    </a>
  `;

  return {
    subject: `Meal not received — ${opts.employeeName} · ${opts.serviceDate}`,
    html: layout(content),
  };
}

// ---------------------------------------------------------------------------
// Refund queued (employee acknowledgement)
// ---------------------------------------------------------------------------

export function refundQueuedEmail(opts: {
  name: string;
  reference: string;
  serviceWeek: string;
  appUrl: string;
}): { subject: string; html: string } {
  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a">
      Refund request received
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569">
      Hi ${opts.name}, we've received your cancellation request for order
      <strong>${opts.reference}</strong> (service week: ${opts.serviceWeek}).
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px">
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9">
          <span style="font-size:12px;color:#94a3b8">Order Reference</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a;font-family:monospace">${opts.reference}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px">
          <span style="font-size:12px;color:#94a3b8">Status</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a">Refund Pending</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px;font-size:14px;color:#64748b">
      Your refund will be processed in the next available batch. Once processed, please allow
      <strong>3–10 business days</strong> for the amount to appear in your account.
    </p>

    <a href="${opts.appUrl}/orders"
       style="display:inline-block;background:#c8102e;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">
      View My Orders
    </a>
  `;

  return {
    subject: `Refund request received — ${opts.reference}`,
    html: layout(content),
  };
}

// ---------------------------------------------------------------------------
// Refund failed — employee notification
// ---------------------------------------------------------------------------

export function refundFailedEmployeeEmail(opts: {
  name: string;
  reference: string;
  amountSen: number;
  appUrl: string;
}): { subject: string; html: string } {
  const amount = formatSen(opts.amountSen);

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a">
      We're still working on your refund
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569">
      Hi ${opts.name}, we encountered an issue processing your refund for order
      <strong>${opts.reference}</strong>. Our team has been notified and will handle it manually.
      <strong>No action is needed from you.</strong>
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px">
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9">
          <span style="font-size:12px;color:#94a3b8">Order Reference</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a;font-family:monospace">${opts.reference}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9">
          <span style="font-size:12px;color:#94a3b8">Refund Amount</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a">${amount}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px">
          <span style="font-size:12px;color:#94a3b8">Status</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#b45309">Under Review</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px;font-size:14px;color:#64748b">
      If you don't receive your refund within <strong>5 business days</strong>, please contact
      your HR or admin team and quote the order reference above.
    </p>

    <a href="${opts.appUrl}/orders"
       style="display:inline-block;background:#c8102e;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">
      View My Orders
    </a>
  `;

  return {
    subject: `Refund update — ${opts.reference}`,
    html: layout(content),
  };
}

// ---------------------------------------------------------------------------
// Refund failed — admin alert
// ---------------------------------------------------------------------------

export function refundFailedAdminEmail(opts: {
  reference: string;
  employeeName: string;
  attempts: number;
  amountSen: number;
  appUrl: string;
}): { subject: string; html: string } {
  const amount = formatSen(opts.amountSen);

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a">
      Refund failed — manual action required
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569">
      Order <strong>${opts.reference}</strong> has failed to refund after
      ${opts.attempts} attempts and requires manual intervention.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #fecaca;border-radius:8px;background:#fef2f2">
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #fecaca">
          <span style="font-size:12px;color:#991b1b">Order Reference</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a;font-family:monospace">${opts.reference}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #fecaca">
          <span style="font-size:12px;color:#991b1b">Employee</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a">${opts.employeeName}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #fecaca">
          <span style="font-size:12px;color:#991b1b">Amount</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a">${amount}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px">
          <span style="font-size:12px;color:#991b1b">Attempts</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#dc2626">${opts.attempts} (max reached — cron will no longer retry)</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px;font-size:14px;color:#64748b">
      Please log in to the admin panel and process this refund manually via the Bulk Refund tool
      or directly in HitPay.
    </p>

    <a href="${opts.appUrl}/admin/bulk-refund"
       style="display:inline-block;background:#c8102e;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">
      Go to Bulk Refund
    </a>
  `;

  return {
    subject: `[ACTION REQUIRED] Refund failed — ${opts.reference}`,
    html: layout(content),
  };
}

// ---------------------------------------------------------------------------
// Invoice uploaded — admin alert
// ---------------------------------------------------------------------------

export function invoiceUploadedAdminEmail(opts: {
  restaurantName: string;
  cycleWeek: string;
  invoiceNumber?: string;
  amountSen: number;
  uploadedBy: string;
  appUrl: string;
}): { subject: string; html: string } {
  const amount = formatSen(opts.amountSen);

  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a">
      New vendor invoice uploaded
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569">
      A new invoice from <strong>${opts.restaurantName}</strong> has been uploaded and is awaiting review.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px">
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9">
          <span style="font-size:12px;color:#94a3b8">Restaurant</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a">${opts.restaurantName}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9">
          <span style="font-size:12px;color:#94a3b8">Service Week</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a">${opts.cycleWeek}</p>
        </td>
      </tr>
      ${opts.invoiceNumber ? `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9">
          <span style="font-size:12px;color:#94a3b8">Invoice Number</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a;font-family:monospace">${opts.invoiceNumber}</p>
        </td>
      </tr>` : ''}
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9">
          <span style="font-size:12px;color:#94a3b8">Amount</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a">${amount}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px">
          <span style="font-size:12px;color:#94a3b8">Uploaded By</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#0f172a">${opts.uploadedBy}</p>
        </td>
      </tr>
    </table>

    <a href="${opts.appUrl}/admin/invoices"
       style="display:inline-block;background:#c8102e;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">
      Review Invoice
    </a>
  `;

  return {
    subject: `New invoice: ${opts.restaurantName}${opts.invoiceNumber ? ` — ${opts.invoiceNumber}` : ''} (${amount})`,
    html: layout(content),
  };
}
