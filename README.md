# MR DIY Food Ordering

Weekly staff meal planning and ordering. Admins plan a menu two weeks ahead,
publish it, staff order until the Wednesday cutoff, and the food is served the
following week. The company subsidy is applied automatically; staff pay the
remainder through HitPay.

> ⚠️ **Review before use.** This system was generated with AI assistance. Verify
> the business rules, pricing, subsidy policy and payment configuration against
> your own requirements before deploying it or making decisions from its
> reports. Anything touching payroll, payments or employee data needs
> authorised sign-off.

---

## The weekly cycle

This is the rule the whole system is built around:

```
Week W-2   Admin drafts the menu for service week W          (DRAFT)
Week W-1   Mon 00:00  publish → ordering opens               (PUBLISHED)
Week W-1   Wed 17:00  cutoff → ordering closes               (CLOSED)
Week W     Mon–Fri    food served                            (FULFILLED)
```

- A cycle is identified by the **Monday of the week the food is served**.
- The cutoff weekday and time are configurable (`ORDER_CUTOFF_*`) and can be
  overridden per cycle in the admin UI.
- All wall-clock reasoning happens in `APP_TIMEZONE` (default
  `Asia/Kuala_Lumpur`).
- Once a menu is published, dishes and prices are locked. Unpublishing is only
  allowed while no order has been committed.

## Roles

Access is capability-based (`src/lib/rbac.ts`), not role-literal — adding a
role later is a one-line change to that table.

| Role | Can |
| --- | --- |
| **Administrator** | Restaurants, dishes and prices; plan and publish weekly menus; subsidy rules; users and roles; everything below |
| **Analytics** | Demand dashboards, participation, top dishes, kitchen counts |
| **Finance** | Revenue, subsidy cost, HitPay reconciliation, CSV exports; also sees analytics |
| **Employee** | Browse the open menu and order for next week |

Analytics and Finance can also place their own orders — they eat too.

## Subsidies

Rules live in **Admin → Subsidies**. Three types:

- **Fixed per item** — e.g. RM 5.00 off each dish (one meal per day, so this
  is effectively per day)
- **Percentage** — e.g. 60% off, optionally capped per item
- **Daily cap** — the company never pays more than RM X per person per day

How they combine, per order line:

1. One per-item rule is chosen: highest `priority` wins, and a `DEPARTMENT`
   rule beats an `ALL` rule at equal priority.
2. It is applied per unit and never exceeds the unit price.
3. The daily cap then limits total subsidy across every line sharing a service
   date, scaled down proportionally with exact integer conservation.

Whatever is left is what the employee pays. A fully subsidised order skips the
payment gateway entirely. The rules applied are snapshotted onto the order at
checkout, so Finance can always reconstruct why a given order was priced the
way it was.

## Money

Every monetary column is an **integer number of sen** (1 MYR = 100 sen). No
floats, no `Decimal` serialisation issues across the server/client boundary.
Format with `formatSen()` from `src/lib/money.ts`.

---

## Getting started

**Prerequisites:** Node 20+. Postgres is optional — see below.

```bash
npm install
cp .env.example .env
npm run db:push && npm run db:seed && npm run dev
```

Set `AUTH_SECRET` in `.env` before anything real (48 random bytes):

```bash
openssl rand -base64 48
```

The seed prints one sign-in per role. **Change those passwords before this
touches a real environment.**

### Postgres or SQLite

With no `DATABASE_URL` configured the app falls back to **SQLite** at
`prisma/dev.db`, so it runs with zero setup. Point it at Postgres by setting
the URL:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mrdiy_food?schema=public"
```

The provider is inferred from the URL scheme (`postgresql://` or `file:`), or
forced with `DATABASE_PROVIDER=postgresql|sqlite`.

`prisma/schema.prisma` is the single hand-edited source of truth and is
written in Postgres form. Prisma does not allow `provider = env(...)`, so
`scripts/db-config.mjs` derives `prisma/schema.sqlite.prisma` (generated,
gitignored) whenever SQLite is in use. Every `npm run db:*` script and the
dev/build scripts route through it, so this is invisible in normal use.

Prisma's SQLite connector supports enums and `Json` but not scalar lists,
`@db.Date`, `mode: 'insensitive'`, or `skipDuplicates`. Those four gaps are
the whole difference, and they are handled in one place — `src/lib/db-compat.ts`:

| Difference | Postgres | SQLite |
| --- | --- | --- |
| `Dish.tags` | `String[]` | comma-delimited `String`, via `encodeTags`/`decodeTags` |
| Date-only columns | `@db.Date` | plain `DateTime` (already stored as UTC midnight) |
| Case-insensitive search | `mode: 'insensitive'` | `LIKE`, already case-insensitive for ASCII |
| `createMany` dedupe | `skipDuplicates: true` | omitted; callers de-duplicate first |

If you add a scalar list to the schema, the SQLite generator prints a warning
telling you to add a codec.

**SQLite is for development and demos.** Use Postgres for anything with real
users — it handles concurrent writes properly, which matters when the whole
office orders lunch in the same ten minutes.

### Other commands

```bash
npm run test        # cycle arithmetic + subsidy engine (no DB needed)
npm run typecheck   # tsc --noEmit
npm run build       # production build
npm run db:studio   # browse the database
npm run db:migrate  # create a migration instead of db:push
npm run db:reset    # DESTRUCTIVE - drop everything, then re-seed
```

`db:reset` deletes the SQLite file outright, or runs `prisma migrate reset`
on Postgres (which prompts for confirmation). It does not re-seed for you -
follow it with `npm run db:seed`.

---

## Deploying to Vercel

**SQLite will not work.** Vercel's filesystem is ephemeral and per-invocation,
so you need a real Postgres database. The build fails with a clear message if
`DATABASE_URL` is missing, rather than deploying something that breaks later.

1. **Create a Postgres database** — Supabase, Neon, Vercel Postgres, or any
   managed Postgres. Copy the connection string.

   On **Supabase** it is *Project Settings → Database → Connection string →
   URI*. Put it in `DATABASE_URL`. Supabase also shows a variable called
   `DIRECT_URL`; this app does not use that name, and setting only `DIRECT_URL`
   is the most common way to hit the "DATABASE_URL is not set" build error.
   If you pick the transaction pooler (port `6543`) rather than the session
   pooler (`5432`), append `?pgbouncer=true` to the URL.

2. **Set environment variables** in Vercel → Settings → Environment Variables:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | your Postgres connection string |
   | `AUTH_SECRET` | 48 random bytes (`openssl rand -base64 48`) |
   | `APP_URL` | `https://<your-project>.vercel.app` |
   | `HITPAY_API_KEY` | from the HitPay dashboard |
   | `HITPAY_SALT` | from the HitPay dashboard |
   | `HITPAY_MODE` | `sandbox` until you are ready for real money |
   | `APP_TIMEZONE` | `Asia/Kuala_Lumpur` |

   `APP_URL` must be the real public URL. HitPay rejects `localhost` outright
   (`"localhost not work for this field"`), so the webhook cannot be
   registered from a local machine — use a tunnel for local testing.

3. **Create the schema.** Vercel's build does not migrate for you. From your
   machine, pointed at the production database:

   ```bash
   DATABASE_URL="<your postgres url>" npx prisma db push --schema prisma/schema.prisma
   ```

4. **Seed, or create the first admin.** `npm run db:seed` loads demo data and
   is **not** appropriate for production — it creates accounts with a shared
   known password. For a real deployment, insert one admin user with a bcrypt
   hash you generate yourself, then use the in-app **Users & roles** screen.

5. **Deploy.** `npm run build` runs `prisma generate` against the Postgres
   schema automatically.

### Before real money

- Switch `HITPAY_MODE` to `live` and swap in live API keys.
- Confirm the webhook reaches `https://<your-app>/api/webhooks/hitpay`.
- Change every seeded password.
- Re-read the data-protection notes below — the CSV exports contain staff
  names and IDs.

---

## HitPay

Get the API key and salt from **HitPay dashboard → Settings → Payment Gateway
→ API Keys**, then:

```
HITPAY_API_KEY="..."
HITPAY_SALT="..."
HITPAY_MODE="sandbox"     # "live" when you go live
APP_URL="https://food.example.com"
```

`APP_URL` must be reachable by HitPay — the webhook is registered as
`{APP_URL}/api/webhooks/hitpay`. For local testing, tunnel it (ngrok,
Cloudflare Tunnel) and set `APP_URL` to the tunnel URL.

**The webhook is the only thing that marks an order paid.** The browser
redirect is cosmetic and can be forged. The handler:

- verifies the HMAC signature before trusting any field,
- rejects an underpayment rather than confirming the order,
- is idempotent, because HitPay retries until it gets a `200`,
- returns a failed order to `CART` so the employee can retry while the window
  is still open.

Sandbox and live use different base URLs and different keys — `HITPAY_MODE`
picks the right one.

---

## Authentication

Local email + password is always available. Two directory options layer on top,
both off by default.

**LDAP / Active Directory** — set `AUTH_LDAP_ENABLED=true` plus the `LDAP_*`
variables. Flow: bind as the service account → search by email → re-bind as
that user's DN with their password. A matching directory user is provisioned on
first sign-in as an `Employee`; an admin promotes them afterwards. Requires the
optional `ldapts` package (installed by default; the provider reports itself
disabled if it is missing).

**OIDC / SSO** — set `AUTH_OIDC_ENABLED=true` plus `OIDC_ISSUER`,
`OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`. Standard Authorization Code flow with
PKCE, endpoints read from the issuer's discovery document. Register the
redirect URI `{APP_URL}/api/auth/oidc/callback`. Works with Entra ID / Azure AD.

Notes:

- A **local password wins if one is set**, so break-glass admin accounts keep
  working when the directory is unreachable.
- Roles are assigned on creation and never overwritten by the directory — an
  admin's role change sticks.
- The session JWT is only a pointer; role and active status are re-read from
  the database on every request, so revoking an account takes effect
  immediately.

---

## Data protection

The Finance exports contain **employee names, staff IDs and departments**.
That is personal data:

- Only `finance:export` (Admin, Finance) can download them.
- Every export is written to the audit log.
- Keep the files on approved systems; share only within Finance and HR.

Other handling notes:

- Passwords are bcrypt-hashed at cost 12 and never logged.
- Never send a temporary password by email or chat — hand it over in person or
  through a password manager.
- Raw HitPay webhook payloads are stored on `Payment.rawPayload` for dispute
  handling. They contain no card data, but treat them as sensitive.
- Do not put real employee records into a shared or public deployment without
  approval.

---

## Project layout

```
prisma/
  schema.prisma          data model (Postgres form); money is integer sen
  seed.ts                demo users, catalogue, 5 service weeks

scripts/
  db-config.mjs          provider resolution + SQLite schema derivation
  prisma.mjs             runs the Prisma CLI against the right schema
  seed.mjs, reset.mjs    seed / destructive reset

src/lib/
  cycle.ts               week arithmetic, ordering windows, phases
  subsidy.ts             the subsidy engine (pure, fully tested)
  orders.ts              cart, capacity, repricing, checkout guards
  hitpay.ts              gateway client + webhook signature verification
  rbac.ts                capability table
  session.ts             JWT cookie session
  auth.ts                provider chain: local → LDAP
  auth/oidc.ts           OIDC Authorization Code + PKCE
  reporting.ts           aggregates for Analytics / Finance / Kitchen
  money.ts, csv.ts       formatting and safe CSV output
  db-compat.ts           the four Postgres/SQLite differences, in one file

src/app/(app)/
  menu/                  employee: browse and order
  orders/                employee: history and order detail
  admin/cycles/          plan, publish, close weekly menus
  admin/restaurants/     vendors
  admin/dishes/          catalogue and prices
  admin/subsidies/       company contribution rules
  admin/users/           accounts and roles
  analytics/             demand, participation, popularity
  finance/               spend, subsidy cost, reconciliation, exports
  kitchen/               production counts per restaurant per day

src/app/api/
  webhooks/hitpay/       payment confirmation (HMAC verified)
  auth/oidc/             SSO start + callback
  exports/[type]/        CSV downloads
```

## Design decisions worth knowing

- **Prices are snapshotted.** A `MenuItem` copies the dish price when it is
  added to a week. Editing the catalogue later never changes a published menu
  or a placed order.
- **Deactivate, don't delete.** Anything with order history is deactivated
  instead of deleted, so reports stay correct.
- **One order per employee per week.** It starts as a `CART` and is checked out
  once; the unique index on `(userId, cycleId)` arbitrates concurrent tabs.
- **Capacity is held by committed orders only** (`AWAITING_PAYMENT` + `PAID`).
  A cart does not reserve a portion, and capacity is re-checked at checkout.
- **Order line items are denormalised** (dish name, restaurant name, service
  date) so historical reports survive catalogue changes.
- **The last active administrator cannot be demoted or deactivated.**
- **One meal per person per service day.** Enforced in `selectMeal()`, not
  just the UI: choosing a dish deletes whatever else was chosen for that date
  in the same transaction. `validateForCheckout()` re-checks it before any
  money moves, so a cart built by any other route still cannot get through.
  The constant is `MEALS_PER_DAY` in `src/lib/orders.ts`; note that raising it
  alone will not enable multi-meal ordering, because the ordering screen is a
  single-choice control by design.
- **One day at a time.** Both the ordering page and the admin planner load a
  single service day per request, selected by `?day=YYYY-MM-DD`. The tab bar
  needs only per-day counts, and tab prefetch is off — hovering five tabs
  should not run five days of queries. The cart summary still spans the whole
  week because it comes from the order rows, not the menu.
- **The cart row is created on first add, not on first view**, so browsing the
  menu does not litter the table with empty orders.
- **The payment gateway is not named in employee-facing screens.** Staff see
  "Pay RM 12.50"; Finance sees the HitPay references it needs to reconcile.
- **Employees never see the company's contribution.** Menu rows show the price
  *that employee* pays (`employeePriceFor()`), and the order summary, order
  list and receipt omit gross and subsidy entirely. Showing a list price
  alongside "you pay" would leak the subsidy by subtraction, so the list price
  is not sent to the browser at all. Everything behind `finance:view` still
  shows the full split. Note this per-dish price is exact only because it is
  one meal per day - see `employeePriceFor()` for why.
- **Submitted orders reuse the ordering screen, read-only.** Rather than a
  separate receipt layout, the same day tabs and dish rows render with the
  chosen dish marked and the controls removed, so people recognise what they
  are looking at.
- **Create forms live in dialogs**, behind an "Add ..." button in the page
  header, not in a permanent side panel. The list gets the full width, and
  `ActionForm`'s `onSuccess` closes the dialog once the record is saved.

## Not built

Deliberately out of scope for this version — flag if you want any of them:

- Automated refunds. Cancelling a week marks paid orders for refund but the
  money is returned manually in the HitPay dashboard.
- Email or push notifications (publish announcements, cutoff reminders,
  collection reminders).
- Per-restaurant vendor logins.
- Automatic cycle transitions. `CLOSED` and `FULFILLED` are set by admin
  action; add a scheduled job if you want them to advance on their own.
- Dietary preference matching and allergen warnings beyond free-text tags.
