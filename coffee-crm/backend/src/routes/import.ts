import type { FastifyInstance } from "fastify";
import { parse } from "csv-parse/sync";
import { prisma } from "../lib/prisma.js";

interface CsvRow {
  type: string;
  name: string;
  company?: string;
  country?: string;
  region?: string;
  email?: string;
  phone?: string;
  whatsapp_enabled?: string;
  classification?: string;
  tier?: string;
  lead_status?: string;
  source?: string;
  preferred_currency?: string;
  incoterm_default?: string;
  notes?: string;
}

function splitList(value?: string): string[] {
  if (!value) return [];
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

export async function importRoutes(app: FastifyInstance) {
  // Matches coffee-crm/data/contacts_import_template.csv layout.
  // Idempotent on the first listed email: re-importing the same file updates
  // existing contacts rather than duplicating them.
  app.post("/import/contacts", async (req, reply) => {
    const data = await (req as any).file();
    if (!data) return reply.code(400).send({ error: "no_file" });
    const buffer = await data.toBuffer();

    const rows: CsvRow[] = parse(buffer, { columns: true, skip_empty_lines: true, trim: true });

    const results = { created: 0, updated: 0, skipped: 0 };

    for (const row of rows) {
      const emails = splitList(row.email);
      const phones = splitList(row.phone);
      const primaryEmail = emails[0];

      if (!row.name || !row.type) {
        results.skipped++;
        continue;
      }

      const tier = (row.tier as any) || (row.type === "supplier" ? "B" : "prospect");
      const leadStatus = (row.lead_status as any) || (row.type === "client" || row.type === "both" ? "cold" : null);

      const payload = {
        type: row.type as any,
        name: row.name,
        company: row.company || null,
        country: row.country || null,
        region: row.region || null,
        emails,
        phones,
        whatsappEnabledPhone: row.whatsapp_enabled === "true" ? phones[0] ?? null : null,
        tier,
        leadStatus,
        source: row.source || null,
        preferredCurrency: row.preferred_currency || null,
        incotermDefault: row.incoterm_default || null,
        notes: row.notes || null,
      };

      const existing = primaryEmail
        ? await prisma.contact.findFirst({ where: { emails: { has: primaryEmail } } })
        : null;

      if (existing) {
        await prisma.contact.update({ where: { id: existing.id }, data: payload });
        results.updated++;
      } else {
        await prisma.contact.create({ data: payload });
        results.created++;
      }
    }

    return results;
  });
}
