# Coffee Trader CRM

See [`DESIGN.md`](./DESIGN.md) for the full design doc, data model, and roadmap.

## Phase 1 status

Backend scaffold in [`backend/`](./backend) covers:

- Contacts CRUD (`/contacts`)
- CSV contact import (`/import/contacts`, file field `file`) — template at [`data/contacts_import_template.csv`](./data/contacts_import_template.csv)
- Business-card capture flow (`/business-card/scan`, `/business-card/confirm`) — OCR via Mistral (Pixtral) vision, EU-hosted, see `src/services/cardParser.ts`
- Manual price entry + arbitrage calc (`/prices`, `/prices/arbitrage`)
- WhatsApp via Twilio: inbound webhook + outbound send (`/whatsapp/webhook`, `/whatsapp/send`)

## Running locally

```bash
cd backend
cp .env.example .env   # point DATABASE_URL at a local Postgres
npm install
npm run prisma:migrate
npm run dev
```

## Data residency

Hosting target is **Hetzner Cloud** (Germany/Finland) for the VM, Postgres, and object storage — see [`DESIGN.md` §14](./DESIGN.md#14-data-residency-policy) for the full EU-data-residency policy and the accepted exceptions (M365 email, Twilio/WhatsApp).

## Frontend

Mobile-first Next.js app in [`frontend/`](./frontend) — warm/human UX per `DESIGN.md` §11, not a generic SaaS dashboard. Three screens so far: Home ("who needs you today"), People (contact list/detail with timeline), and Capture (business-card scan → confirm → suggested next action).

```bash
cd frontend
cp .env.example .env   # point NEXT_PUBLIC_API_URL at the backend
npm install
npm run dev
```
