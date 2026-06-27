# Coffee Trader CRM — Design Document

## 1. Context & Goals

A CRM purpose-built for a specialty coffee trader, run solo, with a small
book (<200 contacts: roasters, importers, exporters/co-ops/mills,
logistics partners). Must be:

- **Portable**: one backend, accessible from phone/laptop/tablet — not a
  desktop-only spreadsheet.
- **Communication-centric**: WhatsApp (official Business API) and email
  are the primary channels with clients and suppliers; the CRM should
  ingest and log these conversations against contacts, not live as a
  separate silo.
- **Funnel-aware**: classify customers/leads and track them through a
  sales funnel with analytics.
- **Coffee-specific**: model the things generic CRMs don't — origin,
  lots/crops, contracts, samples, cupping scores, shipping/Incoterms,
  pricing (differential vs. C-market), currency.

## 2. Tech Stack

- **Backend**: Node.js + TypeScript, Fastify (lighter than Nest/Express
  middleware stacks, good fit for a small single-tenant service).
- **DB**: PostgreSQL (Docker locally, managed instance e.g. Neon/Render/
  Fly Postgres in prod). Single tenant — no need for multi-tenant
  schemas at this scale.
- **ORM**: Prisma — fast to iterate on schema, good migration story.
- **Auth**: simple email+password / passkey for a single user (+
  optional 2nd login if you bring in a partner/assistant later). JWT
  session, refresh token. No need for full multi-tenant RBAC yet — just
  a `users` table with roles (`owner`, `staff`) for future-proofing.
- **Frontend** (separate concern, not detailed here): a responsive web
  app (React/Next.js) is the most "portable across devices" answer —
  works on phone browser, tablet, laptop, no app store needed. PWA
  wrapper later if you want home-screen install + push notifications.
- **Hosting**: single small VM or PaaS (Fly.io/Render) running API +
  Postgres + a background worker for WhatsApp/email sync jobs.
- **Background jobs**: BullMQ + Redis (or Postgres-based queue like
  `pg-boss` to avoid an extra Redis instance at this scale) for polling
  email and processing WhatsApp webhooks/template sends.

## 3. WhatsApp Integration — Official Business API

Given the ToS/reliability concerns with unofficial bridges (account ban
risk is unacceptable for a trading business), use the **Meta WhatsApp
Cloud API** directly (free tier covers low volume; no BSP markup needed
at <200 contacts) or a BSP (360dialog/Twilio) if you want a nicer
dashboard and faster support.

Mechanics:
- **Inbound**: Meta sends webhooks to your backend for every message,
  delivery receipt, and read receipt. You match the sender's phone
  number to a `Contact`, store the message in `Message` table, and
  surface it in a unified "conversation" timeline per contact (merged
  with email).
- **Outbound, freeform**: only allowed within a 24h window after the
  contact last messaged you.
- **Outbound, cold/proactive**: requires a pre-approved **message
  template** (e.g. "Hi {{1}}, the {{2}} lot from {{3}} just landed,
  cupping notes attached — want a sample?"). Templates must be submitted
  to Meta for approval (usually <24h). Plan a small library of templates
  for: new-crop announcement, sample follow-up, contract/invoice
  reminder, shipment update.
- **Media**: cupping sheets, COAs, photos of green coffee, shipping docs
  — Cloud API supports media messages; store media in S3-compatible
  storage (Backblaze B2/Cloudflare R2) and link from `Message`.
- **Numbers**: you'll need a dedicated WhatsApp Business number (can
  port your existing business number, but it gets locked into the API
  and the regular app loses access to it — plan for that).

## 4. Email Integration

- **IMAP/SMTP** via a library like `imapflow` + `nodemailer`, OR
  provider-native APIs (Gmail/Microsoft Graph) if your business email is
  Google Workspace/M365 — preferred, since OAuth is more robust than
  IMAP password/app-passwords and gives you better threading metadata.
- Sync strategy: webhook/push notifications if available (Gmail Pub/Sub,
  Graph webhooks), else poll every few minutes via background job.
- Match incoming emails to `Contact` by sender address; thread by
  `Message-ID`/`References` headers into a `Conversation`.
- Outbound: send through the same account so replies land in your normal
  sent folder too (avoid a parallel "CRM-only" mailbox that fragments
  your real inbox).

## 5. Core Data Model

```
Contact
  id, type[client|supplier|both], name, company,
  country, region (origin region if supplier),
  emails[], phones[] (WhatsApp-enabled flag per phone),
  classification (see §6), lead_status, source,
  preferred_currency, incoterm_default,
  notes, created_at, last_contacted_at

Conversation
  id, contact_id, channel[whatsapp|email], subject (email only),
  last_message_at

Message
  id, conversation_id, direction[in|out], channel,
  body, media_url[], sent_at, external_id (whatsapp msg id / email Message-ID)

Lot  (a specific coffee lot/crop you trade)
  id, supplier_id, origin_country, region, farm/coop name,
  variety, process (washed/natural/honey/etc.), altitude,
  crop_year, certifications[] (organic/FT/RFA),
  available_kg, price_basis[fixed|differential], price_value,
  currency, status[offered|sample_sent|sold_out|contracted]

CuppingScore
  id, lot_id, scored_by, date, total_score, attributes(json: acidity,
  body, sweetness, aftertaste...), notes

SampleRequest
  id, lot_id, contact_id, sent_at, feedback, outcome[interested|pass]

Deal  (sales-funnel object — links a Contact to a potential transaction)
  id, contact_id, lot_id (nullable — may be generic, not lot-specific),
  stage (see §7), value, currency, quantity_kg,
  incoterm, expected_close_date, probability, created_at, closed_at,
  lost_reason

Contract
  id, deal_id, contract_number, signed_date, quantity_kg,
  price_terms, shipment_window, payment_terms, status

Shipment
  id, contract_id, vessel/booking_ref, etd, eta, status,
  documents[] (BL, phytosanitary, ICO cert, COA)

Activity (timeline/audit log)
  id, contact_id, deal_id?, type[call|meeting|note|status_change],
  body, created_at
```

## 6. Customer/Supplier Classification

Two independent axes, both computed + manually overridable:

**A. Relationship type & tier**
- `client` vs `supplier` vs `both` (some roaster-importers are both).
- Tier by trailing-12-month volume or revenue: `A` (top, >X kg/€),
  `B`, `C`, `prospect`. Auto-recompute monthly from `Deal`/`Contract`
  data; flag tier changes.

**B. Lead status (for prospects specifically)**
- `cold` → `contacted` → `sample_sent` → `negotiating` → `customer` →
  `dormant` (no activity in N months) → `churned`.
- Auto-flag `dormant` when `last_contacted_at` exceeds a threshold
  (e.g. 60 days for active clients, 120 for suppliers) — this is the
  single highest-value automation for a solo trader: it tells you who
  you're about to drop without noticing.

## 7. Sales Funnel

Stages tuned to coffee trading rather than generic SaaS funnel:

1. **Lead** — identified roaster/buyer or new-origin contact, no
   conversation yet.
2. **Engaged** — first WhatsApp/email exchange logged.
3. **Sample sent** — `SampleRequest` created and linked to a `Lot`.
4. **Sample feedback** — cupping/feedback received, interest confirmed
   or lost.
5. **Offer/negotiation** — price, quantity, Incoterm being discussed
   (`Deal` created).
6. **Contracted** — `Contract` signed.
7. **Shipped** — `Shipment` in transit.
8. **Closed-won** (delivered, invoiced, paid) / **Closed-lost** (with
   `lost_reason`: price, quality, timing, competitor, no-response).

Funnel analytics to build:
- Conversion rate sample→contract, by origin/supplier and by buyer
  segment (roaster size, region).
- Average days-in-stage, to spot deals stalling (e.g. stuck in
  "sample feedback" >30 days → auto-reminder task).
- Win rate and average deal size by lead source (referral, trade
  show, cold outreach, inbound).
- Supplier-side mirror: which origins/lots get sampled often but never
  sold (dead stock signal), repeat-buy rate per supplier relationship.

## 8. Coffee-Specific Feature Ideas (beyond generic CRM)

- **Crop calendar view**: timeline of expected harvest/availability
  windows per origin/supplier, so outreach to buyers can be timed
  ahead of crop arrival.
- **Cupping log linked to deals**: every sample sent ties to a cupping
  score; over time, build a "what scores get bought" feedback loop per
  buyer (some buyers always reject sub-86, others care more about
  process/story than score).
- **Price exposure dashboard**: if you trade on differentials to the
  C-market (ICE Arabica futures), pull a daily price feed and show
  open positions' mark-to-market exposure per `Deal`/`Contract` — even
  a simple manual daily price entry + computed differential value is
  useful at this scale.
- **Document vault per contract/shipment**: COA, phytosanitary
  certificate, bill of lading, ICO certificate of origin, invoice —
  attached to `Shipment`, with expiry/reminder for time-sensitive docs.
- **Certifications tracker**: organic/Fair Trade/Rainforest Alliance
  certs expire and need renewal — track expiry per supplier/lot, with
  reminders before they lapse (matters for compliance and the buyers
  who require them).
- **Currency & Incoterm defaults per contact**: avoid re-asking same
  buyer their preferred terms each deal.
- **WhatsApp template: new-crop blast with photo/cupping sheet** — the
  single most useful automation: when a new `Lot` is marked
  `available`, generate a templated WhatsApp blast (within
  ToS — pre-approved template) to all clients tagged with matching
  origin/process interest.
- **Quality complaint log**: linked to `Shipment`/`Contract`, tracks
  defects/claims separately from general notes — useful both for
  supplier scorecards and for your own QC trend tracking.
- **Sample inventory**: track which physical samples you have on hand
  (roasted/green), since these get requested/shipped to multiple
  buyers and are easy to lose track of.

## 9. Roadmap (incremental, solo-trader pace)

**Phase 1 — Foundation**
Contacts + classification, manual activity log, basic auth, deployed
backend reachable from any device (web UI). No integrations yet — this
alone replaces a spreadsheet safely.

**Phase 2 — Email integration**
OAuth to your business mailbox, inbound/outbound sync, conversation
threading per contact.

**Phase 3 — WhatsApp Business API**
Cloud API setup, webhook ingestion, template library + approval,
unified conversation view (email + WhatsApp merged per contact).

**Phase 4 — Coffee domain objects**
Lots, cupping scores, sample requests, certifications tracker.

**Phase 5 — Funnel & deals**
Deal/contract/shipment pipeline, stage automation, dormant-contact
alerts.

**Phase 6 — Analytics**
Funnel conversion dashboards, price exposure dashboard, supplier/buyer
scorecards.

## 10. Open Questions To Resolve Before Building

- Which email provider/domain do you use for business mail (Google
  Workspace, Microsoft 365, other IMAP)? Determines OAuth vs IMAP
  approach.
- Do you already have a WhatsApp Business number, or do you need to
  acquire/port one for the Cloud API?
- Do you track a C-market price feed today (manually, via a broker
  terminal, or not at all)? Determines feasibility/scope of the price
  exposure dashboard.
- Any existing data to migrate (spreadsheet of contacts, past deals)?
