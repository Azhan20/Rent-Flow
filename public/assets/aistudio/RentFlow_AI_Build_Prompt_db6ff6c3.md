# Master AI Build Prompt — RentFlow Equipment Rental SaaS

Copy the prompt below into your preferred AI coding tool. Attach the RentFlow demo project if the tool supports project uploads. Ask the AI to inspect the existing code first and enhance it instead of throwing away the design or workflows.

---

You are a senior SaaS product architect, UI/UX designer, and full-stack engineer. Build a polished, production-oriented multi-tenant Equipment Rental Management SaaS called **RentFlow**. Its target customers are small and medium equipment rental businesses, starting with construction equipment, plant hire, tools, generators, lifting equipment, and machinery rental. Later it should support event, AV, camera, and party rentals.

## Product goal

RentFlow helps equipment rental companies manage their entire rental workflow in one place: equipment inventory, availability, customer records, booking requests, quotes, reservations, check-out, returns, inspections, deposits, invoices, payments, maintenance, reporting, staff, and a public customer-facing rental storefront.

It is a multi-tenant SaaS: one deployed application serves many rental companies. Each company has a separate organization/workspace, separate users and roles, equipment, customers, bookings, invoices, and storefront settings. Tenant data must never leak across organizations.

## Preferred technology

- Frontend: React + Vite + TypeScript (or preserve JavaScript if extending the supplied demo), Tailwind CSS, accessible component patterns, Lucide icons.
- Backend: Node.js + Express + TypeScript.
- Database: PostgreSQL.
- ORM and migrations: Prisma.
- Validation: Zod on both API boundaries and forms.
- Authentication: secure email/password authentication with Argon2id or bcrypt, short-lived access tokens or secure server sessions, refresh-token rotation, email verification, password reset, and optional MFA-ready architecture. Use HttpOnly, Secure, SameSite cookies where appropriate; do not store sensitive auth tokens in localStorage.
- File storage: S3-compatible object storage for equipment photos, signed agreements, and inspection photos.
- Email: an email provider adapter for booking notifications, invoices, verification, password reset, and reminders.
- Payments: a provider abstraction for SaaS subscriptions and (separately) rental-business customer payments. Confirm provider country eligibility before implementation. Never store raw card details.
- PDF: server-side invoice and rental agreement generation.
- Testing: Vitest/Jest for unit tests, API integration tests, and Playwright for important end-to-end flows.
- Deployment: environment-based configuration, Docker-ready backend, managed PostgreSQL, HTTPS, logging, error monitoring, and automated backups.

If the supplied RentFlow demo project is attached, preserve its visual language, pages, component structure, and useful interactions. Refactor carefully, add tests, and keep the app runnable at each milestone. Do not remove working demo features without an equivalent or better implementation.

## Design direction

Create a premium, trustworthy B2B SaaS interface:
- Deep navy sidebar, restrained blue primary actions, generous white space, light neutral canvas, subtle borders, and crisp typography.
- Responsive desktop, tablet, and mobile layouts.
- Consistent page titles, status pills, tables, search/filter bars, empty states, skeleton states, confirmation dialogs, toasts, and accessible form validation.
- No emoji-based interface icons. Use Lucide icons.
- Support keyboard navigation and WCAG-friendly contrast/focus states.
- Make the business dashboard feel professional enough to show a rental-company owner.
- Provide a separate customer-facing storefront preview and tenant-configurable branding.

## Product roles

1. SaaS Super Admin: manages tenants, plans, trials, subscription status, support, platform usage, and platform-level configuration. Super Admin access must be highly restricted and audited.
2. Organization Owner: owns a rental workspace, billing, locations, users, settings, and all organization data.
3. Admin/Manager: manages inventory, rates, bookings, customers, invoices, and reports according to permissions.
4. Rental Staff: handles bookings, pickup, check-out, returns, and inspections with limited permissions.
5. Customer: browses a business's public catalog, submits quote/booking requests, and optionally views their own reservations through a customer portal.

Use role-based access control with organization membership. A user may belong to more than one organization in future; model memberships explicitly.

## Required application areas

### A. Public SaaS marketing website
- Home page with clear value proposition and product screenshots.
- Feature pages for inventory, availability, bookings, online storefront, invoices, maintenance, and reporting.
- Industry pages for construction/plant hire, tools, generators, event equipment, and AV/camera rental.
- Pricing page with feature comparison and monthly/yearly billing toggle.
- Demo request and free-trial CTAs.
- FAQ, contact, terms, privacy, and status/help links.
- Do not claim testimonials, customer counts, security certifications, or integrations unless real and verified. Use clearly labelled illustrative content during development.

### B. Tenant onboarding and account setup
- Sign up, verify email, sign in, forgot/reset password, logout, and session expiry.
- Create organization/workspace, business details, country, timezone, currency, tax settings, address, phone, logo, and primary contact.
- Choose a plan or start a time-limited trial with clear limits.
- Optional CSV import for equipment and customers with validation, preview, duplicate detection, and error report.
- Guided checklist to add first equipment, define rental rates, add a customer, and publish storefront.

### C. Tenant dashboard
- Total equipment/units, available now, rented, reserved, overdue, in maintenance, upcoming pickups/returns, bookings, revenue, outstanding invoices, utilization, and recent activity.
- Date-range filters and accurate metrics derived from database records.
- Quick actions for create booking, add equipment, add customer, create quote, and issue invoice.
- Empty states that guide new tenants through initial setup.

### D. Inventory and asset management
- Equipment categories, item/product models, individual serialized assets, and bulk quantity items.
- Fields: name, description, SKU, category, make/model, serial number, photos, condition, purchase date/cost, replacement value, branch/location, rental rates, availability, deposit, delivery needs, usage meter, maintenance interval, and status.
- Individual asset states: Available, Reserved, Checked Out, Maintenance, Retired, Lost/Damaged.
- Bulk inventory with total quantity and per-location quantity.
- Multiple rate types: hourly, daily, weekly, monthly, weekend, and custom duration. Define clear rounding and minimum-rental rules.
- Pricing calendars and seasonal/contract pricing can be phase 2.
- Inventory search, filters, tags, CSV import/export, bulk updates, and asset history.

### E. Availability and booking engine
- Availability query by location, equipment, quantity, and date/time interval.
- Prevent overbooking under concurrent requests. Use database transactions and suitable row-level locking or an equivalent safe reservation strategy. A client-side availability check is never sufficient.
- Correctly handle overlapping date intervals, pickup/return times, timezone boundaries, buffers/cleaning time, maintenance blocks, canceled reservations, and partial quantities.
- Use a well-documented interval convention. Define whether return date/time is exclusive or inclusive and apply consistently.
- Quote → Request → Pending Approval → Confirmed → Checked Out → Returned → Closed workflow, with Cancelled and Overdue states.
- Support quote expiry, booking notes, internal notes, delivery/pickup, discounts, tax, deposits, partial payment, refunds, late fees, extensions, and cancellations.
- Require an owner/staff approval option before auto-confirming public requests.
- Maintain booking-item records separately from booking headers; one booking may contain multiple different equipment items and quantities.

### F. Customer CRM
- Customer person/company profile, phone, email, billing/shipping address, tax/business identifiers where lawful, notes, tags, rental history, open balances, credit/approval state, and documents.
- Duplicate checks and searchable customer directory.
- Do not expose customer data across organizations.

### G. Pickup, check-out, returns, and inspections
- Check-out workflow with equipment condition, accessories, meter reading, timestamp, staff member, customer acknowledgement, and photo evidence.
- Return workflow with condition comparison, missing parts, damage notes, photos, meter reading, cleaning, fuel, late fee, damage charge, and deposit refund/retention review.
- Require inspection completion or an explicit manager override before returning an asset to Available.
- Maintain immutable event history for key handover and return actions.

### H. Quotes, invoices, rental contracts, and payments
- Branded quote and invoice PDFs with sequential, organization-specific numbering.
- Itemized rental periods, quantities, rates, discounts, tax, delivery, fees, deposits, payments, and balance due.
- Invoice states: Draft, Sent, Partially Paid, Paid, Overdue, Void, Refunded.
- Rental agreement templates with organization-specific terms and signature-provider integration as a separate adapter.
- Track deposits as refundable liabilities, not revenue. Track charges and refunds distinctly.
- Separate the SaaS subscription revenue (paid by rental businesses to RentFlow) from rental revenue (paid by the rental business's customers to the rental business). Never mix the two ledgers.
- Support manual payments (cash/bank transfer/card terminal) with verified recording, plus online checkout only through an eligible, configured payment provider.
- Include webhook signature validation, idempotency keys, reconciliation, refund flows, and payment audit logs.

### I. Public rental storefront per tenant
- Each business receives a public, mobile-friendly storefront with a unique subdomain such as `business.rentflow.example` and optional custom domain later.
- Catalog listing with categories, photos, descriptions, rate ranges, branch/location, and availability request.
- Date/time and quantity enquiry; do not promise confirmed real-time availability until the backend availability check succeeds.
- Customer details, terms acceptance, quote request, and confirmation reference.
- Configurable brand name, logo, colors, contact details, hours, service area, delivery/pickup instructions, and SEO metadata.
- Protect private customer, rate, and internal inventory data from public endpoints.

### J. Calendar, dispatch, and locations
- Calendar views for bookings, pickups, returns, maintenance, and unavailable blocks.
- Multiple branches/warehouses and transfers between locations.
- Optional delivery/collection scheduling and dispatch assignment.
- Ensure an asset cannot be allocated from two locations simultaneously.

### K. Maintenance and utilization
- Preventive maintenance schedule based on date, hours, cycles, or usage meter.
- Maintenance work orders, assigned technician, tasks, parts/costs, downtime, photos, service history, and completion checklist.
- Equipment in maintenance must not appear available for conflicting booking periods.
- Reports for utilization, revenue per asset, downtime, maintenance cost, and asset profitability.

### L. Reports and exports
- Revenue by date, location, category, item, and customer.
- Bookings, cancellation rate, average booking value, overdue returns, outstanding balances, deposits held, tax summary, utilization, fleet downtime, and popular items.
- Date filters, CSV export, and print/PDF summaries.
- Metrics must reconcile with invoice/payment records and clearly distinguish booked value, invoiced value, collected revenue, and refundable deposits.

### M. Subscription and SaaS Super Admin
- Plans: Starter, Growth, Business, Enterprise with configurable limits/features.
- Trial start/end, billing cycle, renewal, cancellation, grace period, failed payment, upgrade/downgrade, proration policy, and subscription status.
- Entitlements enforced server-side (users, asset count, locations, storefront, exports, etc.).
- Billing history and receipts for SaaS subscriptions.
- Super Admin dashboard: tenants, MRR, active trials, churn, plan mix, usage, failed renewals, support queue, and audit events.
- Do not silently lock tenants out or delete their data after expiry. Define read-only/grace-period and export policy, communicate clearly, and comply with relevant law/contract.

### N. Notifications and integrations
- Email events: verification, password reset, new booking request, booking approved/rejected, pickup/return reminder, overdue alert, quote, invoice, payment receipt, and subscription billing.
- Queue/retry delivery and log message status. Make email content tenant-branded where appropriate.
- WhatsApp/SMS and accounting integrations should be optional adapters, not hard dependencies.
- Never claim a notification was sent unless the provider confirms it.

## Minimum data model

Design and document normalized PostgreSQL/Prisma entities for at least:
- User, Session/RefreshToken, Organization, Membership, Role/Permission, Invitation
- Location, Category, EquipmentModel/EquipmentItem, AssetUnit, StockBalance, EquipmentPhoto, RatePlan, AvailabilityBlock
- Customer, CustomerAddress, Booking, BookingItem, BookingEvent, Quote, QuoteItem
- CheckoutInspection, ReturnInspection, InspectionPhoto, DamageCharge
- Invoice, InvoiceLine, Payment, Refund, DepositLedgerEntry, RentalAgreement, SignatureEvent
- MaintenanceWorkOrder, MaintenanceTask, MaintenancePart, UsageReading
- SubscriptionPlan, PlanEntitlement, Subscription, SubscriptionEvent, UsageCounter
- Notification, WebhookEvent, AuditLog, FileObject

Every tenant-owned row must include organization ownership (directly or through a guaranteed tenant-owned parent). Use composite unique constraints and foreign keys where appropriate. Add indexes for organization_id, equipment/status, booking start/end, customer, invoice status, and other query paths.

## API requirements

Design a versioned REST API under `/api/v1` (or document a clear equivalent). Include route schemas, validation, authentication, authorization, pagination, filtering, sorting, consistent error shapes, idempotency where required, and OpenAPI documentation. At minimum cover:
- `/auth/*`
- `/organizations/*`, `/members/*`, `/invitations/*`
- `/equipment/*`, `/categories/*`, `/locations/*`, `/availability/*`
- `/customers/*`, `/bookings/*`, `/quotes/*`
- `/checkouts/*`, `/returns/*`, `/inspections/*`
- `/invoices/*`, `/payments/*`, `/refunds/*`, `/agreements/*`
- `/maintenance/*`, `/reports/*`, `/storefront/*`
- `/subscriptions/*`, `/webhooks/*`, `/admin/*`

For every endpoint, verify the authenticated membership and organization scope on the server. Never trust a client-supplied organization_id without validating membership and permission.

## Security, privacy, and reliability

- Apply tenant isolation at service/repository level and consider PostgreSQL Row-Level Security as defense in depth.
- Validate and sanitize all input; protect against SQL injection, XSS, CSRF, SSRF, path traversal, file upload abuse, and brute force.
- Use secure cookies, CSRF defenses for cookie sessions, rate limits, password policy, secure headers, and least-privilege roles.
- Use signed, short-lived file URLs and validate MIME type, extension, size, and scanning policy.
- Keep secrets out of source control. Provide `.env.example` with placeholders only.
- Add audit logs for sensitive actions (permissions, payments, refunds, data export, user access, status overrides).
- Backups, restore drills, database migration safety, structured logs, alerting, and graceful error handling.
- Implement data export and tenant deletion workflows, retention rules, and privacy policy needs appropriate to launch markets.
- Do not fabricate PCI compliance, SOC 2, ISO certification, or other security claims.

## User experience and acceptance criteria

- A new owner can sign up, create an organization, add equipment and a customer, create a quote/booking, issue an invoice, and publish a storefront without developer help.
- Staff permissions are respected on every protected API call.
- Tenant A cannot read, mutate, or infer Tenant B data, including via IDs, exports, file URLs, search, reports, calendar, and public storefront endpoints.
- Concurrent booking requests cannot over-reserve individual assets or bulk quantity.
- Equipment under maintenance or checked out cannot be booked for an overlapping interval.
- A return is not complete until required inspection/condition steps are recorded or an authorized override exists.
- Invoice/payment balances reconcile; deposits are separately tracked and refundable.
- Subscription feature limits are checked server-side and tests cover plan boundaries.
- UI is responsive, accessible, localized-ready, and has complete loading, empty, error, and success states.

## Delivery process

Work incrementally. Before coding, provide:
1. Product Requirements Document (PRD) and explicit out-of-scope list.
2. Architecture diagram and explanation of tenant isolation.
3. Database ERD and Prisma schema.
4. API specification and role/permission matrix.
5. UI route map and key user journeys.
6. Milestone plan with test strategy.

Then implement in milestones:
- Milestone 1: auth, organizations, memberships, seed demo tenant, dashboard shell.
- Milestone 2: equipment, categories, locations, customers, CSV import/export.
- Milestone 3: availability, booking engine, calendar, checkout/return.
- Milestone 4: quotes, invoices, deposits, manual payments, agreements.
- Milestone 5: maintenance, analytics, storefront.
- Milestone 6: subscription billing, Super Admin, emails, audit logs.
- Milestone 7: hardening, security tests, performance, deployment, docs.

At the end of every milestone: run lint, type-check, migrations, unit/integration tests, and production build; report exactly what passed, failed, and remains mocked. Include setup instructions and sample `.env.example`. Seed only fictional demonstration data. Never present mocked payments, emails, authentication, or inventory as live integrations.

Do not attempt to build all features in one giant untested code dump. Prioritize a reliable MVP, preserve clean architecture, and clearly separate shipped functionality from roadmap items.

---
