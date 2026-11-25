import 'server-only';

import nodemailer from 'nodemailer';

// ---------------------------------------------------------------------------
// Email sending via SMTP (nodemailer).
//
// Required env var to enable: SMTP_HOST
// When SMTP_HOST is absent, all calls are silently skipped and a warning
// is logged — the app continues to work without email configured.
//
// Minimal setup (fill these in .env):
//   SMTP_HOST=mail.yourcompany.com
//   SMTP_PORT=587          (default)
//   SMTP_USER=no-reply@yourcompany.com
//   SMTP_PASS=yourpassword
//   SMTP_FROM=MR DIY Food Ordering <no-reply@yourcompany.com>
//   SMTP_SECURE=false      (true for port 465 SSL, false for 587 STARTTLS)
// ---------------------------------------------------------------------------

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.warn('[email] SMTP_HOST not set — email skipped:', payload.subject);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    ...(process.env.SMTP_USER && process.env.SMTP_PASS
      ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
      : {}),
    tls: { rejectUnauthorized: false },
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? 'MR DIY Food Ordering <no-reply@mrdiy.com>',
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
  } finally {
    transporter.close();
  }
}
