# Coffee Trader CRM — Design Document

## 1. Context & Goals

A CRM purpose-built for a specialty coffee trader, run solo, with a small book (<200 contacts: roasters, importers, exporters/co-ops/mills, logistics partners). Must be:

- **Portable**: one backend, accessible from phone/laptop/tablet — not a desktop-only spreadsheet.
- **Communication-centric**: WhatsApp (official Business API) and email are the primary channels with clients and suppliers; the CRM should ingest and log these conversations against contacts, not live as a separate silo.
- **Funnel-aware**: classify customers/leads and track them through a sales funnel with analytics.
- **Coffee-specific**: model the things generic CRMs don't — origin, lots/crops, contracts, samples, cupping scores, shipping/Incoterms, pricing (differential vs. C-market), currency.
- **Field-ready**: usable one-handed at a trade fair — fast contact capture from a business card photo, with a recommended next action surfaced immediately.

## 2. Tech Stack

- **Backend**: Node.js + TypeScript, Fastify (lighter than Nest/Express middleware stacks, good fit for a small single-tenant service).
- **DB**: PostgreSQL (Docker locally, managed instance e.g. Neon/Render/Fly Postgres in prod). Single tenant — no need for multi-tenant schemas at this scale.
- **ORM**: Prisma — fast to iterate on schema, good migration story.
- **Auth**: simple email+password / passkey for a single user (+ optional 2nd login if you bring in a partner/assistant later). JWT session, refresh token. No need for full multi-tenant RBAC yet — just a `users` table with roles (`owner`, `staff`) for future-proofing.
- **Frontend** (separate concern, not detailed here): a responsive web app (React/Next.js) is the most "portable across devices" answer — works on phone browser, tablet, laptop, no app store needed. Built mobile-first per §11; PWA wrapper later if you want home-screen install + push notifications + offline camera capture.
- **Hosting**: single small VM or PaaS (Fly.io/Render) running API + Postgres + a background worker for WhatsApp/email/price sync jobs.
- **Background jobs**: BullMQ + Redis (or Postgres-based queue like `pg-boss` to avoid an extra Redis instance at this scale) for polling email, processing WhatsApp webhooks/template sends, and the daily price-feed pull (§10).

## 3. WhatsApp Integration — Official Business API

Given the ToS/reliability concerns with unofficial bridges (account ban risk is unacceptable for a trading business), use the official Cloud API via a BSP rather than an unofficial bridge. **Decision: Twilio**, chosen for EU availability and a more usable dashboard/support than raw Meta Cloud API integration.

Cost note: Twilio's WhatsApp **sandbox** is free for development/testing (your test number joins via a join code, shared sandbox number) but is not suitable for real customers. Moving to production requires your own WhatsApp sender, Meta business verification, and per-conversation billing from both Twilio and Meta — it is not free at that point, just simpler to operate day-to-day than direct Cloud API integration. Start on the sandbox, budget for production fees before going live with real contacts.

You confirmed you already have a phone number you intend to use — note that registering it as a WhatsApp Business sender locks it out of the regular WhatsApp Business app, so register it deliberately (not your personal number, and not one you need dual access to).

Mechanics:

- **Inbound**: Meta sends webhooks to your backend for every message, delivery receipt, and read receipt. You match the sender's phone number to a `Contact`, store the message in `Message` table, and surface it in a unified "conversation" timeline per contact (merged with email).
- **Outbound, freeform**: only allowed within a 24h window after the contact last messaged you.
- **Outbound, cold/proactive**: requires a pre-approved message template (e.g. "Hi {{1}}, the {{2}} lot from {{3}} just landed, cupping notes attached — want a sample?"). Templates must be submitted to Meta for approval (usually <24h). Plan a small library of templates for: new-crop announcement, sample follow-up, contract/invoice reminder, shipment update.
- **Media**: cupping sheets, COAs, photos of green coffee, shipping docs — Cloud API supports media messages; store media in S3-compatible storage (Backblaze B2/Cloudflare R2) and link from `Message`.
- **Numbers**: dedicated WhatsApp Business number — confirmed available, registration approach TBD.

## 4. Email Integration

You confirmed your business mailbox runs on **Microsoft 365**, so:

- Use **Microsoft Graph API** with OAuth (app registration in Entra ID, `Mail.Read`/`Mail.Send` delegated or app permissions). Preferred over raw IMAP/SMTP — better threading metadata, push notifications, no app-password management.
- **Sync strategy**: Graph webhook subscriptions (push) for new mail, with a fallback polling job (subscriptions expire after ~3 days and need renewal — schedule a renewal job).
- Match incoming emails to `Contact` by sender address; thread by `conversationId` (Graph gives this natively, simpler than parsing `Message-ID`/`References` headers yourself).
- **Outbound**: send via Graph `sendMail` from the same M365 account so replies land in your normal Sent folder too (avoid a parallel "CRM-only" mailbox that fragments your real inbox).

## 5. Core Data Model

```
Contact
  id, type[client|supplier|both], name, company,
  country, region (origin region if supplier),
  emails[], phones[] (WhatsApp-enabled flag per phone),
  classification (see §6), lead_status, source,
  preferred_currency, incoterm_default,
  notes, business_card_image_url, created_at, last_contacted_at

Conversation
  id, contact_id, channel[whatsapp|email], subject (email only),
  last_message_at

Message
  id, conversation_id, direction[in|out], channel,
  body, media_url[], sent_at, external_id (whatsapp msg id / email conversationId)

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
  id, contact_id, deal_id?, type[call|meeting|note|status_change|next_action],
  body, due_at?, created_at

PriceQuote  (see §10)
  id, market[robusta|arabica|usd_index], contract_month, price,
  currency, quote_date, source, is_delayed
```

## 6. Customer/Supplier Classification

Two independent axes, both computed + manually overridable:

**A. Relationship type & tier**

- `client` vs `supplier` vs `both` (some roaster-importers are both).
- Tier by trailing-12-month volume or revenue: `A` (top, >X kg/€), `B`, `C`, `prospect`. Auto-recompute monthly from `Deal`/`Contract` data; flag tier changes.

**B. Lead status** (for prospects specifically)

- `cold` → `contacted` → `sample_sent` → `negotiating` → `customer` → `dormant` (no activity in N months) → `churned`.
- Auto-flag `dormant` when `last_contacted_at` exceeds a threshold (e.g. 60 days for active clients, 120 for suppliers) — this is the single highest-value automation for a solo trader: it tells you who you're about to drop without noticing.

## 7. Sales Funnel

Stages tuned to coffee trading rather than generic SaaS funnel:

1. **Lead** — identified roaster/buyer or new-origin contact, no conversation yet.
2. **Engaged** — first WhatsApp/email exchange logged.
3. **Sample sent** — `SampleRequest` created and linked to a `Lot`.
4. **Sample feedback** — cupping/feedback received, interest confirmed or lost.
5. **Offer/negotiation** — price, quantity, Incoterm being discussed (`Deal` created).
6. **Contracted** — `Contract` signed.
7. **Shipped** — `Shipment` in transit.
8. **Closed-won** (delivered, invoiced, paid) / **Closed-lost** (with `lost_reason`: price, quality, timing, competitor, no-response).

Funnel analytics to build:

- Conversion rate sample→contract, by origin/supplier and by buyer segment (roaster size, region).
- Average days-in-stage, to spot deals stalling (e.g. stuck in "sample feedback" >30 days → auto-reminder task).
- Win rate and average deal size by lead source (referral, trade show, cold outreach, inbound).
- Supplier-side mirror: which origins/lots get sampled often but never sold (dead stock signal), repeat-buy rate per supplier relationship.

## 8. Coffee-Specific Feature Ideas (beyond generic CRM)

- **Crop calendar view**: timeline of expected harvest/availability windows per origin/supplier, so outreach to buyers can be timed ahead of crop arrival.
- **Cupping log linked to deals**: every sample sent ties to a cupping score; over time, build a "what scores get bought" feedback loop per buyer.
- **Price exposure dashboard**: see §10.
- **Document vault** per contract/shipment: COA, phytosanitary certificate, bill of lading, ICO certificate of origin, invoice — attached to `Shipment`, with expiry/reminder for time-sensitive docs.
- **Certifications tracker**: organic/Fair Trade/Rainforest Alliance certs expire and need renewal — track expiry per supplier/lot, with reminders before they lapse.
- **Currency & Incoterm defaults per contact**: avoid re-asking same buyer their preferred terms each deal.
- **WhatsApp template**: new-crop blast with photo/cupping sheet — when a new `Lot` is marked `available`, generate a templated WhatsApp blast (pre-approved template) to all clients tagged with matching origin/process interest.
- **Quality complaint log**: linked to `Shipment`/`Contract`, tracks defects/claims separately from general notes.
- **Sample inventory**: track which physical samples you have on hand (roasted/green).

## 9. Roadmap (incremental, solo-trader pace)

- **Phase 1 — Foundation**: Contacts + classification, manual activity log, basic auth, CSV import of existing contacts (§12), deployed backend reachable from any device (web UI, mobile-first per §11). No integrations yet — this alone replaces a spreadsheet safely.
- **Phase 1.5 — Business card capture**: mobile camera capture → OCR/parse → draft `Contact` + recommended next action (§11). High field-value, ships right after core contacts.
- **Phase 2 — Email integration**: Microsoft Graph OAuth to your M365 mailbox, inbound/outbound sync, conversation threading per contact.
- **Phase 3 — WhatsApp Business API**: Cloud API setup, webhook ingestion, template library + approval, unified conversation view (email + WhatsApp merged per contact).
- **Phase 4 — Coffee domain objects**: Lots, cupping scores, sample requests, certifications tracker.
- **Phase 5 — Funnel & deals**: Deal/contract/shipment pipeline, stage automation, dormant-contact alerts.
- **Phase 6 — Price exposure & analytics**: delayed price feed ingestion (§10), funnel conversion dashboards, supplier/buyer scorecards.

## 10. Price Tracking — Robusta, Arabica, USD, Arbitrage

You currently track prices manually and want an integrated view — delayed quotes only, no paid live feed.

- **Markets to track**: ICE Arabica (KC) front + next contract months, ICE Robusta (RM, London) front + next contract months, USD index/FX cross relevant to your invoicing currency (e.g. EUR/USD), and the Arabica–Robusta arbitrage spread (computed: Arabica $/lb converted to $/tonne minus Robusta $/tonne).
- **Data source options** (delayed, free/cheap tier):
  - A free delayed-quote provider (e.g. Barchart, Trading Economics, or a commodities endpoint on a free-tier market-data API) pulled once daily by a background job into `PriceQuote`.
  - Fallback / day-one option: a manual entry form (you type today's prices in ~30 seconds) — ships in Phase 1 alongside Contacts, no integration dependency. Automation replaces this later without changing the data model.
- **Arbitrage calculation**: stored as a derived value, recomputed whenever a same-day Arabica + Robusta quote pair exists; displayed as a trend chart (last 30/90 days) alongside the two underlying legs.
- **Exposure dashboard** (Phase 6): for each open `Deal`/`Contract` priced as a differential to the C-market, multiply quantity × differential × latest `PriceQuote` to estimate mark-to-market exposure. Manual entry already gives you 90% of the value here; live feeds are explicitly out of scope.

## 11. Mobile & Business-Card Capture (Trade-Fair Workflow)

Primary use case: at a fair, point your phone at a business card, get a usable `Contact` in a few seconds, with a suggested next step — no typing.

- **Mobile-first UI**: the web app's contact-capture screen is the default landing view on mobile (not a buried menu item); large camera-trigger button, works one-handed.
- **Capture flow**:
  1. Photo taken via device camera (`<input type="file" accept="image/*" capture="environment">` or native camera API) — works offline, queues upload if signal is poor at a venue.
  2. Image uploaded to object storage (same bucket as WhatsApp media, §3) and stored on a draft `Contact.business_card_image_url`.
  3. OCR/parsing step extracts name, company, email(s), phone(s), country. **Decision: Claude (Sonnet) vision call** — send the card photo with a structured-JSON-extraction prompt. Implemented behind an injectable `CardParserService` so the provider can still be swapped later.
  4. Parsed fields are pre-filled into an editable `Contact` form (never auto-save unreviewed — coffee names/companies are easy to mis-OCR) with a one-tap confirm.
  5. On confirm, a `next_action` `Activity` is auto-suggested based on simple rules (extendable later with funnel data): new contact with no prior history → "Send intro WhatsApp/email within 48h"; contact matches an existing dormant record → "Reactivation: reference last contact from {date}"; company matches a known supplier origin you're short on → "Flag as sample-request candidate".
- **Offline tolerance**: capture and queue locally if there's no signal at the fair; sync (upload + OCR) resumes automatically when connectivity returns.

## 12. Data Migration — CSV Import

You have an existing contact spreadsheet to migrate. Phase 1 ships a CSV importer matching this column layout (see `coffee-crm/data/contacts_import_template.csv`):

```
type,name,company,country,region,email,phone,whatsapp_enabled,classification,tier,lead_status,source,preferred_currency,incoterm_default,notes
```

- `type`: `client` | `supplier` | `both`
- `email` / `phone`: comma-separate multiple values within the cell (e.g. `"a@x.com,b@x.com"`); the importer splits these into the `Contact.emails[]` / `phones[]` arrays.
- `whatsapp_enabled`: `true`/`false`, applies to the first listed phone (refine per-number after import if needed).
- `classification`/`tier`: optional — left blank, the importer defaults new clients to tier `prospect` and suppliers to `B` pending the first monthly recompute (§6).
- `lead_status`: optional, defaults to `cold` for clients, blank/n.a. for suppliers.
- Import is **idempotent on email** — re-running the same file updates existing contacts by matching email rather than duplicating them, so you can iteratively clean the spreadsheet and re-import.
- Deals/past transactions: not modeled in the CSV importer yet (no spreadsheet format specified) — if you have historical deal data you want migrated, it can be added as a second CSV (`deals_import_template.csv`) once the `Deal` table exists in Phase 5.

## 13. Open Questions — Resolved

- **Email provider**: Microsoft 365 → Microsoft Graph API/OAuth (§4).
- **WhatsApp number**: you have one available; integration path decided — Twilio (§3), starting on the free sandbox before registering a production sender.
- **Price feed**: tracked manually today; building an integrated delayed-quote tracker for Robusta, Arabica, USD, and the arbitrage spread, starting with manual daily entry and layering in a free delayed-data source later (§10).
- **Data migration**: CSV import for contacts, format and template provided (§12).
- **Mobile / trade-fair workflow**: business-card-photo → draft contact → suggested next action, designed in §11, scheduled as Phase 1.5.
