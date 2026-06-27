import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function contactsRoutes(app: FastifyInstance) {
  app.get("/contacts", async () => {
    return prisma.contact.findMany({ orderBy: { createdAt: "desc" } });
  });

  app.get("/contacts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: { activities: { orderBy: { createdAt: "desc" } } },
    });
    if (!contact) return reply.code(404).send({ error: "not_found" });
    return contact;
  });

  app.post("/contacts", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const contact = await prisma.contact.create({
      data: {
        type: body.type as any,
        name: body.name as string,
        company: (body.company as string) ?? null,
        country: (body.country as string) ?? null,
        region: (body.region as string) ?? null,
        emails: (body.emails as string[]) ?? [],
        phones: (body.phones as string[]) ?? [],
        whatsappEnabledPhone: (body.whatsappEnabledPhone as string) ?? null,
        tier: (body.tier as any) ?? null,
        leadStatus: (body.leadStatus as any) ?? null,
        source: (body.source as string) ?? null,
        preferredCurrency: (body.preferredCurrency as string) ?? null,
        incotermDefault: (body.incotermDefault as string) ?? null,
        notes: (body.notes as string) ?? null,
        businessCardImageUrl: (body.businessCardImageUrl as string) ?? null,
      },
    });
    return reply.code(201).send(contact);
  });

  app.patch("/contacts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    try {
      const contact = await prisma.contact.update({ where: { id }, data: body as any });
      return contact;
    } catch {
      return reply.code(404).send({ error: "not_found" });
    }
  });
}
