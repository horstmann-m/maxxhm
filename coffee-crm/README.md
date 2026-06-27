# Coffee Trader CRM

See [`DESIGN.md`](./DESIGN.md) for the full design doc, data model, and roadmap.

## Phase 1 status

Backend scaffold in [`backend/`](./backend) covers:

- Contacts CRUD (`/contacts`)
- CSV contact import (`/import/contacts`, file field `file`) — template at [`data/contacts_import_template.csv`](./data/contacts_import_template.csv)
- Business-card capture flow (`/business-card/scan`, `/business-card/confirm`) — OCR via Claude (Sonnet) vision, see `src/services/cardParser.ts`
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
