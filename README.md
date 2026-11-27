# LOS — Lunch Ordering System

Weekly staff meal planning and ordering. Admins plan a menu ahead of each service week, publish it, staff order until the cutoff, and food is served the following week. The company subsidy is applied automatically at checkout; staff pay the remainder through the configured payment gateway.

> **Review before use.** This system was built with AI assistance. Verify the
> business rules, pricing, subsidy policy and payment configuration against your
> own requirements before deploying it or making decisions from its reports.
> Anything touching payroll, payments or employee data needs authorised sign-off.

---

## The weekly cycle

```
Week W-2   Admin drafts the menu for service week W          (DRAFT)
Week W-1   Mon 00:00  publish → ordering opens               (PUBLISHED)
Week W-1   Wed 17:00  cutoff → ordering closes               (CLOSED)
Week W     Mon–Fri    food served                            (FULFILLED)
```

- A cycle is identified by the **Monday of the week the food is served**.
- The cutoff weekday and time are configurable (`ORDER_CUTOFF_*`) and can be
  overridden per cycle in the admin UI.
- All wall-clock reasoning happens in `APP_TIMEZONE` (default `Asia/Kuala_Lumpur`).
- Once a menu is published, dishes and prices are locked.

---

## Roles

Access is capability-based (`src/lib/rbac.ts`), not role-literal.

| Role              | Landing page   | Can do                                                                                                           |
| ----------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Administrator** | `/analytics`   | Restaurants, dishes, menus, subsidy rules, users, companies, entities, settings, bulk refund, upload and review vendor invoices, audit log, kitchen counts; also orders their own meals. **Does not have Finance access** — Finance is a separate department. |
| **Analytics**     | `/analytics`   | Demand dashboards, participation, top dishes, kitchen counts, audit log; also orders their own meals             |
| **Finance**       | `/finance`     | Revenue, subsidy cost, per-entity reconciliation, CSV exports, vendor invoice review and approval, kitchen counts, audit log; also orders their own meals |
| **Reception**     | `/reception`   | Mark deliveries as received at the assigned site (with optional photo proof); also orders their own meals        |
| **Employee**      | `/menu`        | Browse the open menu and order for next week; self-cancel within the ordering window                             |

> **superAdmin flag:** A user with `superAdmin = true` in the database bypasses all capability checks and sees every navigation item and page, regardless of their assigned role. This is for break-glass system administrators only — set via Prisma Studio or a direct DB update, not via the UI.

---

## Entities and Companies

The system is multi-entity. Each **Entity** is a legal entity with its own payment gateway account (e.g. MR D.I.Y Trading Sdn Bhd). Each **Company** belongs to one entity and groups the employees who pay through that entity's account.

Managed via **Admin → Companies**:
- Add/edit entities and their payment credentials (encrypted in DB).
- Add/edit companies and assign them to an entity.
- Enable or disable a company's access via its entitlement flag.

An order's payment is routed through the entity that the ordering employee's company belongs to.

---

## Subsidies

Rules live in **Admin → Subsidies**. Three types:

- **Fixed per item** — e.g. RM 5.00 off each dish
- **Percentage** — e.g. 60% off, optionally capped per item
- **Daily cap** — the company never pays more than RM X per person per day

How they combine:

1. One per-item rule is chosen: highest `priority` wins; a `DEPARTMENT` rule
   beats an `ALL` rule at equal priority.
2. Applied per unit, never exceeding the unit price.
3. The daily cap limits total subsidy across every line sharing a service date,
   scaled down proportionally with exact integer conservation.

Whatever is left is what the employee pays. A fully subsidised order skips the payment gateway entirely. Rules are snapshotted onto the order at checkout.

---

## Receipt Confirmation

After a meal is served, employees confirm receipt on the **Receipt** page (`/receipt`).

- **Confirm received** — marks the meal as collected.
- **Report not received** — triggers an admin notification email.
- **Auto-confirm** — any unconfirmed receipt is automatically confirmed at the cutoff hour configured in **Admin → Settings** (`mealReceiptCutoffHour`, default 6 PM).

Admins see the same page as a grouped summary (by restaurant + dish + delivery site), with coloured badge pills showing confirmed / pending / not-received counts per group. Clicking a group opens a popup listing each employee's name, staff ID, department, and status.

The **Kitchen** page (`/kitchen`) also shows per-employee receipt status when a production count row is expanded.

---

## Cancel and Refund

Employees can self-cancel a paid order while the cycle's ordering window is open (`orderOpenAt` → `orderCutoffAt`). Self-cancel is toggled in **Admin → Settings** (`selfCancelEnabled`).

A cancellation request queues the order as `REFUND_PENDING`. A nightly cron job at **8 pm MYT** calls the payment gateway refund API for every pending order. Failed attempts retry each night for up to **7 attempts**, then the order is marked `REFUND_FAILED` for manual follow-up.

Admins can also refund immediately via **Admin → Bulk Refund**, which filters by cycle, service day, restaurant and dish. The Bulk Refund page shows an amber warning banner listing every `REFUND_FAILED` order with the employee name, staff ID, food items, amount, and service week.

---

## Money

Every monetary column is an **integer number of sen** (1 MYR = 100 sen). No floats, no `Decimal` serialisation issues. Format with `formatSen()` from `src/lib/money.ts`.

---

## Getting started

**Prerequisites:** Node 20+. Postgres is optional for local dev — see below.

```bash
npm install
cp .env.example .env
# Fill in AUTH_SECRET and HITPAY_ENCRYPTION_KEY at minimum, then:
npm run db:push && npm run db:seed && npm run dev
```

Generate the required secrets:

```bash
openssl rand -base64 48   # → AUTH_SECRET
openssl rand -hex 32      # → HITPAY_ENCRYPTION_KEY
openssl rand -hex 32      # → CRON_SECRET
```

The seed prints one sign-in per role. **Change those passwords before this touches a real environment.**

### Postgres or SQLite

With no `DATABASE_URL` configured the app falls back to **SQLite** at `prisma/dev.db` (zero setup, development only). Point it at Postgres:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mrdiy_food?schema=public"
```

The provider is inferred from the URL scheme, or forced with `DATABASE_PROVIDER=postgresql|sqlite`.

**SQLite is for development and demos.** Use Postgres for anything with real users — concurrent writes during the lunch rush need it.

### Other commands

```bash
npm run test        # cycle arithmetic + subsidy engine (no DB needed)
npm run typecheck   # tsc --noEmit
npm run build       # production build
npm run db:studio   # browse the database (Prisma Studio)
npm run db:push     # sync schema to DB (no migration files)
npm run db:reset    # DESTRUCTIVE — drop everything, then re-seed
```

---

## Payment Gateways

### HitPay

Each entity has its own HitPay account. Credentials are managed two ways:

**Preferred — Admin UI (encrypted in DB):**

1. Go to **Admin → Companies → Entities**.
2. Add or edit an entity, enter the API key and webhook salt.
3. The app encrypts them with `HITPAY_ENCRYPTION_KEY` (AES-256-GCM) before saving.

**Fallback — environment variables:**

```
HITPAY_API_KEY_TRADING="..."
HITPAY_SALT_TRADING="..."
HITPAY_MODE_TRADING="sandbox"
```

DB credentials take absolute priority. Env vars are only checked when no DB credential exists for that entity.

**`HITPAY_ENCRYPTION_KEY` is required** to use DB-stored credentials. Generate with `openssl rand -hex 32`. Back it up — losing it makes all stored keys unreadable.

**The webhook is the only thing that marks an order paid.** Register it at:

```
{APP_URL}/api/webhooks/hitpay
```

The handler verifies the HMAC signature, rejects underpayments, is idempotent (HitPay retries until 200), and returns a failed order to `CART` so the employee can retry.

`APP_URL` must be reachable by HitPay — no localhost. Use a tunnel (ngrok, Cloudflare Tunnel) for local testing.

Global defaults (apply when no entity-specific key is set):

```
HITPAY_MODE="sandbox"              # "sandbox" or "live"
HITPAY_CURRENCY="MYR"
HITPAY_PAYMENT_METHODS="touch_n_go,duitnow"
```

### Betterpay

An alternative payment gateway. Configure per entity using the entity code in uppercase (e.g. `ECOMMERCE`, `TRADING`):

```
BETTERPAY_API_KEY_<ENTITY>="..."
BETTERPAY_MERCHANT_ID_<ENTITY>="..."
BETTERPAY_MODE_<ENTITY>="sandbox"   # "sandbox" or "live"
BETTERPAY_CURRENCY_<ENTITY>="MYR"
BETTERPAY_PAYMENT_METHODS_<ENTITY>="b2c,ewallet"
```

Register the Betterpay backend webhook at:

```
{APP_URL}/api/webhooks/betterpay
```

Betterpay retries the webhook 3 times every 10 minutes until it receives a plain-text `OK` response. The handler responds `OK` for all matched payments regardless of outcome to stop retries.

---

## Email notifications

Transactional emails are sent via SMTP (nodemailer). Without `SMTP_HOST`, all emails are silently skipped and a warning is logged — the app continues to work without email configured.

### SMTP environment variables

```
SMTP_HOST=""           # e.g. smtp.gmail.com or mail.yourcompany.com
SMTP_PORT="587"        # 587 for STARTTLS, 465 for SSL
SMTP_USER=""           # SMTP login username
SMTP_PASS=""           # SMTP login password (use an App Password for Gmail)
SMTP_FROM="LOS Food Ordering <no-reply@yourdomain.com>"
SMTP_SECURE="false"    # "true" for port 465 SSL, "false" for 587 STARTTLS
```

For **Gmail**, generate an App Password at myaccount.google.com → Security → App Passwords. For testing without sending real emails, use **Mailtrap** (mailtrap.io) — it captures all outgoing emails in a test inbox.

### Email templates

| Template | Recipient | Trigger |
| --- | --- | --- |
| Order confirmed | Employee who placed the order | Payment webhook succeeds |
| Refund request received | Employee whose refund was queued | Self-cancel submitted |
| Refund processed | Employee whose refund succeeded | Nightly cron successfully refunds |
| Refund failed (employee) | Employee whose refund exhausted attempts | Refund fails after max attempts |
| Meal not received | All users with `role = ADMIN` or `superAdmin = true` | Employee reports meal not received |
| Refund failed (admin) | All users with `role = ADMIN` or `superAdmin = true` | Refund fails after max attempts |
| Invoice uploaded | All users with `role = ADMIN` or `superAdmin = true` | Admin uploads a vendor invoice |

Admin alert emails are broadcast to every admin account in the database, not to a single support address.

### Testing emails

A test endpoint simulates each real trigger, pulls a live record from the database, and sends to the actual recipient the system would use. Only accessible in development (or with `x-cron-secret` header):

```
GET /api/test-email?event=<name>
```

| `event` value | Recipient | Real data source |
| --- | --- | --- |
| `order-confirmed` | Employee | Most recent PAID order |
| `refund-queued` | Employee | Most recent PAID order |
| `refund-success` | Employee | Most recent PAID order |
| `refund-failed` | Employee + first admin | Most recent PAID order |
| `meal-not-received` | First admin | Most recent not-received order item |
| `invoice-uploaded` | First admin | Most recent vendor invoice |

Target a specific record by ID:

```
GET /api/test-email?event=order-confirmed&order=<orderId>
GET /api/test-email?event=meal-not-received&item=<orderItemId>
GET /api/test-email?event=invoice-uploaded&invoice=<invoiceId>
```

The endpoint awaits the send before responding, so the result (`sent` / `failed`) is visible directly in the response body. Use port `2525` for Mailtrap — ports 465 and 587 are often blocked on corporate networks and by Vercel's serverless infrastructure.

---

## API documentation (Swagger UI)

The interactive API reference is available at `/api-docs` once the app is running:

```
http://localhost:3000/api-docs
https://<your-app>.vercel.app/api-docs
```

It reads `public/swagger.yaml` and renders it with Swagger UI. To test authenticated endpoints:

1. **Session-based endpoints** — sign in to the app at `/login` first in the same browser, then open `/api-docs`. The `session` HttpOnly cookie is sent automatically.
2. **Cron / test endpoints** — click **Authorize** (🔒) in Swagger UI, enter your `CRON_SECRET` under `cronSecret`, then close. All subsequent requests will include the `x-cron-secret` header.

The `/api-docs` page itself requires no authentication to view.

---

## File storage (Vercel Blob)

Delivery photos and vendor invoices are stored in Vercel Blob. Create **two Blob stores** in Vercel → Storage → Blob:

| Store | Token var | Use |
| --- | --- | --- |
| Private store | `BLOB_READ_WRITE_TOKEN` | Delivery photos, vendor invoices. Files are served via authenticated proxy routes — never directly accessible. |
| Public store | `PUBLIC_READ_WRITE_TOKEN` | Dish images. Served directly from Vercel's CDN. |

Without these tokens, image uploads fall back to base64 stored in the database.

> **Local development:** Blob uploads are skipped automatically when `NODE_ENV=development`, even if `BLOB_READ_WRITE_TOKEN` is present (e.g. pulled via `vercel env pull`). Files fall back to base64 inline storage with no delay.

---

## Authentication

Local email + password is always available. Additional options:

**LDAP / Active Directory** — set `AUTH_LDAP_ENABLED=true` plus `LDAP_*` vars. Binds as a service account, searches by email, re-binds as the user. New users are provisioned as Employee on first sign-in; an admin promotes them.

```
AUTH_LDAP_ENABLED="true"
LDAP_URL="ldaps://ldap.example.com:636"
LDAP_BIND_DN="CN=svc-food,OU=Service Accounts,DC=example,DC=com"
LDAP_BIND_PASSWORD=""
LDAP_SEARCH_BASE="OU=Users,DC=example,DC=com"
LDAP_SEARCH_FILTER="(&(objectClass=user)(mail={{email}}))"
LDAP_ATTR_NAME="displayName"
LDAP_ATTR_STAFF_ID="employeeID"
LDAP_ATTR_DEPARTMENT="department"
```

**OIDC / SSO** — set `AUTH_OIDC_ENABLED=true` plus `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`. Authorization Code + PKCE flow, works with Entra ID / Azure AD. Register redirect URI: `{APP_URL}/api/auth/oidc/callback`.

```
AUTH_OIDC_ENABLED="true"
OIDC_ISSUER="https://login.microsoftonline.com/<tenant-id>/v2.0"
OIDC_CLIENT_ID=""
OIDC_CLIENT_SECRET=""
OIDC_SCOPES="openid profile email"
```

**Joget embedded (iframe) mode** — set `AUTH_JOGET_SSO_ENABLED=true`. Joget calls `/api/auth/joget-identify` with a signed JWT. The app provisions the user, maps Joget group names to roles via `JOGET_GROUP_ROLE_MAP`, and assigns their company if `companyCode=<code>` is passed in the SSO URL. The page renders in a minimal mobile layout inside the iframe.

```
AUTH_JOGET_SSO_ENABLED="true"
JOGET_SSO_SECRET=""           # shared secret for JWT verification
JOGET_SSO_ISSUER="joget"
JOGET_SSO_AUDIENCE="food-ordering-app"
# Maps Joget group name (case-insensitive) → app role.
# Anyone not in a listed group falls back to USER.
# Priority order: ADMIN > FINANCE > ANALYTICS > RECEPTION > USER
JOGET_GROUP_ROLE_MAP="Admin:ADMIN,Finance:FINANCE,Analytics:ANALYTICS,Reception:RECEPTION"
```

Notes:
- A local password wins if one is set — break-glass admin accounts keep working when the directory is unreachable.
- Roles are assigned on creation and never overwritten by the directory.
- Role and active status are re-read from the database on every request, so revoking an account takes effect immediately.

---

## Site settings

Managed via **Admin → Settings**. Changes take effect immediately (cached with a short TTL).

| Setting | Default | Description |
| --- | --- | --- |
| Site name | `LOS` | Displayed in the header beside the logo |
| Logo URL | `/los-logo.svg` | Custom logo; falls back to the built-in LOS icon |
| Favicon URL | `/los-logo.svg` | Browser tab icon |
| Support email | — | Recipient for admin notification emails (not-received, refund failures, invoice uploads) |
| Maintenance message | — | When set, shows a banner to all users |
| Meal receipt cutoff hour | `18` (6 PM) | Hour after which unconfirmed receipts are auto-confirmed |
| Max meals per day | `1` | Maximum subsidised meals per employee per service day |
| Self-cancel enabled | `false` | Whether employees can self-cancel a PAID order |

---

## Deploying to Vercel

**SQLite will not work on Vercel** — the filesystem is ephemeral. Use Postgres.

1. **Create a Postgres database** (Supabase, Neon, Vercel Postgres, or any managed Postgres). On Supabase, use both URLs:
   - `DATABASE_URL` — transaction pooler (`:6543?pgbouncer=true&connection_limit=1`)
   - `DIRECT_URL` — direct connection (`:5432`) for schema pushes

2. **Set environment variables** in Vercel → Settings → Environment Variables:

   | Variable                | Required | Value                                              |
   | ----------------------- | -------- | -------------------------------------------------- |
   | `DATABASE_URL`          | ✅       | Pooled Postgres URL                                |
   | `DIRECT_URL`            | Supabase | Direct/session URL for schema pushes               |
   | `AUTH_SECRET`           | ✅       | `openssl rand -base64 48`                          |
   | `HITPAY_ENCRYPTION_KEY` | ✅       | `openssl rand -hex 32`                             |
   | `CRON_SECRET`           | ✅       | `openssl rand -hex 32`                             |
   | `APP_URL`               | ✅       | `https://<your-project>.vercel.app`                |
   | `APP_TIMEZONE`          | ✅       | `Asia/Kuala_Lumpur`                                |
   | `HITPAY_MODE`           | ✅       | `sandbox` until ready for real money               |
   | `HITPAY_CURRENCY`       |          | `MYR`                                              |
   | `HITPAY_PAYMENT_METHODS`|          | `touch_n_go,duitnow`                               |
   | `BLOB_READ_WRITE_TOKEN` |          | Vercel Blob private store token                    |
   | `PUBLIC_READ_WRITE_TOKEN`|         | Vercel Blob public store token (dish images)       |
   | `SMTP_HOST`             |          | SMTP server hostname (email disabled if unset)     |
   | `SMTP_PORT`             |          | `587`                                              |
   | `SMTP_USER`             |          | SMTP username                                      |
   | `SMTP_PASS`             |          | SMTP password / App Password                       |
   | `SMTP_FROM`             |          | `LOS Food Ordering <no-reply@yourdomain.com>`      |
   | `SMTP_SECURE`           |          | `false` for port 587, `true` for port 465          |
   | `AUTH_JOGET_SSO_ENABLED`|          | `true` to enable Joget embedded mode               |
   | `JOGET_SSO_SECRET`      | Joget    | Shared JWT secret                                  |
   | `JOGET_GROUP_ROLE_MAP`  | Joget    | Group→role mapping                                 |

   Payment gateway credentials (HitPay API key + salt, Betterpay API key + merchant ID) are entered via **Admin → Companies → Entities** after deploy, not as env vars.

3. **Push the schema:**

   ```bash
   DATABASE_URL="<pooled>" DIRECT_URL="<direct>" npm run db:push
   ```

4. **Seed sample data** (optional):

   ```bash
   DATABASE_URL="<pooled>" DIRECT_URL="<direct>" \
   SEED_DEFAULT_PASSWORD="$(openssl rand -base64 18)" npm run db:seed
   ```

   Creates 4 entities, 4 companies, 13 staff accounts, 4 restaurants, 16 dishes, 3 subsidy rules, and 5 service weeks. Sign-in list printed at the end.

   `SEED_DEFAULT_PASSWORD` is required for remote databases — the default is published here, so seeding without it is refused.

5. **Deploy.** `npm run build` runs `prisma generate` automatically.

### Before going live

- Enter live payment gateway API keys via **Admin → Companies → Entities**.
- Switch `HITPAY_MODE` to `live`.
- Confirm the HitPay webhook reaches `{APP_URL}/api/webhooks/hitpay`.
- Register the Betterpay webhook at `{APP_URL}/api/webhooks/betterpay` if using Betterpay.
- Set `SMTP_HOST` and related vars; test each template with `/api/test-email?event=<name>` (see email testing section above).
- Admin alert emails (meal not received, refund failed, invoice uploaded) are broadcast to all users with `role = ADMIN` or `superAdmin = true` — ensure at least one admin account has an email address.
- Change every seeded password.

---

## Scheduled jobs (cron)

On Vercel, `vercel.json` schedules these automatically. For self-hosted deployments, call the same URLs on a schedule with `Authorization: Bearer <CRON_SECRET>`.

| Endpoint                        | Schedule (MYT) | Purpose                                              |
| ------------------------------- | -------------- | ---------------------------------------------------- |
| `/api/cron/process-refunds`     | Daily 8 PM     | Attempt payment gateway refund for all `REFUND_PENDING` orders |
| `/api/cron/confirm-meals`       | Daily 6 PM     | Auto-mark unconfirmed meal receipts as received      |
| `/api/cron/close-cycles`        | Daily 5 PM     | Flip overdue `PUBLISHED` cycles to `CLOSED`          |
| `/api/cron/expire-orders`       | Daily 10 AM    | Cancel `AWAITING_PAYMENT` orders older than 24h      |

`/api/cron` (no suffix) runs all four jobs in one request — use this for self-hosted crontab entries:

```bash
# /etc/cron.d/los-food  (times in UTC = MYT-8)
0 12 * * * root curl -s -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron
```

---

## Data protection

The Finance exports contain **employee names, staff IDs and departments**. That is personal data:

- Only `finance:export` (**Finance** role only; Admin does not have this capability) can download them.
- Every export is written to the audit log.
- Keep the files on approved systems; share only within Finance and HR.

Other notes:

- Passwords are bcrypt-hashed at cost 12 and never logged.
- Payment gateway API keys and salts are AES-256-GCM encrypted at rest.
- Raw payment webhook payloads are stored on `Payment.rawPayload` for dispute handling — treat as sensitive.
- Delivery photos are stored in a private Blob store and served via an authenticated proxy; they are never publicly accessible.
- Do not put real employee records into a shared or public deployment without approval.

---

## Project layout

```
prisma/
  schema.prisma          data model (Postgres form); money is integer sen
  seed.ts                4 entities, 4 companies, 13 accounts, 5 service weeks

scripts/
  db-config.mjs          provider resolution + SQLite schema derivation
  prisma.mjs             runs Prisma CLI against the right schema

public/
  los-logo.svg           default LOS icon (fork/knife in red rounded square)

src/lib/
  cycle.ts               week arithmetic, ordering windows, phases
  subsidy.ts             the subsidy engine (pure, fully tested)
  orders.ts              cart, capacity, repricing, checkout guards
  hitpay.ts              HitPay gateway client + webhook signature verification
  betterpay.ts           Betterpay gateway client + webhook signature verification
  entity-config.ts       entity payment credentials (DB-first, env fallback)
  encrypt.ts             AES-256-GCM encrypt/decrypt for stored credentials
  refund.ts              queue and process refunds, eligibility check
  rbac.ts                capability table and role→landing page mapping
  session.ts             JWT cookie session
  auth.ts                provider chain: local → LDAP → OIDC → Joget
  reporting.ts           aggregates for Analytics / Finance / Kitchen
  cache.ts               unstable_cache wrappers for analytics dashboard
  settings.ts            site settings with defaults; getSiteSettings()
  email.ts               SMTP email sender (nodemailer); skips if SMTP_HOST unset
  email-templates.ts     7 HTML email templates (order confirmed, refunds, alerts)
  money.ts, csv.ts       formatting and safe CSV output
  db-compat.ts           Postgres/SQLite differences in one file

src/app/api-docs/        Swagger UI page — reads public/swagger.yaml; no auth required to view

src/app/(app)/
  menu/                  employee: browse and order
  orders/                employee: history, order detail, retry payment
  receipt/               employee + admin: confirm/report meal receipt; admin group popup
  kitchen/               production counts per restaurant per day; expanded employee status
  analytics/             demand, participation, popularity — by entity tab
  finance/               spend, subsidy cost, reconciliation, exports
  admin/cycles/          plan, publish, close weekly menus
  admin/restaurants/     vendors
  admin/dishes/          catalogue and prices
  admin/subsidies/       company contribution rules
  admin/users/           accounts and roles
  admin/companies/       entities, companies, entitlements
  admin/bulk-refund/     select and immediately refund paid orders
  admin/settings/        site name, logo, favicon, cutoff hour, self-cancel toggle

src/app/api/
  webhooks/hitpay/       HitPay payment confirmation (HMAC verified)
  webhooks/betterpay/    Betterpay payment confirmation
  auth/joget-identify/   Joget SSO embedded login
  auth/oidc/             OIDC SSO start + callback
  cron/                  scheduled background jobs (refunds, meal confirm, cycle close)
  exports/[type]/        CSV / Excel downloads (finance, kitchen, catalogue, personal orders)
  test-email/            dev/testing endpoint — simulates real email events using live DB data
```

---

## Design decisions worth knowing

- **Prices are snapshotted.** A `MenuItem` copies the dish price when added to a week. Editing the catalogue later never changes a published menu or order.
- **Deactivate, don't delete.** Anything with order history is deactivated instead of deleted so reports stay correct.
- **One order per employee per week.** Starts as a `CART`; the unique index on `(userId, cycleId)` arbitrates concurrent tabs.
- **Capacity is held by committed orders only** (`AWAITING_PAYMENT` + `PAID`). A cart does not reserve a portion; capacity is re-checked at checkout.
- **Order line items are denormalised** (dish name, restaurant name, delivery site, service date) so historical reports survive catalogue changes.
- **Entity routing.** At checkout the order is tagged with the entity code from the user's company. Payment is processed through that entity's gateway account. Refunds use the same entity credentials.
- **The last active administrator cannot be demoted or deactivated.**
- **One meal per person per service day.** Enforced in `selectMeal()` and re-checked in `validateForCheckout()`.
- **Employees never see the company's contribution.** Staff see the price they pay; Finance sees the full split.
- **The payment gateway is not named in employee-facing screens.**
- **Submitted orders reuse the ordering screen, read-only.**
- **Create forms live in dialogs**, not permanent side panels.
- **Awaited email with error isolation.** All transactional email sends are `await`ed so they complete before the serverless function returns (required on Vercel), but errors are caught locally so an SMTP failure never breaks the main request flow.

---

## Not built

Deliberately out of scope — flag if you want any of them:

- Push notifications (browser or mobile) for publish announcements, cutoff reminders, and collection reminders.
- Per-restaurant vendor portal logins.
- Dietary preference matching and allergen warnings beyond free-text tags.
- Multi-entity analytics comparison (cross-entity charts on a single view).
