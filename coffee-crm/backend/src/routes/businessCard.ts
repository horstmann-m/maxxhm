import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { cardParserService } from "../services/cardParser.js";
import { suggestNextAction } from "../services/nextAction.js";

// §11 trade-fair flow: photo -> draft contact -> editable form -> confirm ->
// auto-suggested next action. Storage upload (S3/R2) is a TODO once a bucket
// is provisioned; for now the image is held in memory only for parsing.
export async function businessCardRoutes(app: FastifyInstance) {
  app.post("/business-card/scan", async (req, reply) => {
    const data = await (req as any).file();
    if (!data) return reply.code(400).send({ error: "no_file" });
    const buffer = await data.toBuffer();

    const parsed = await cardParserService.parse(buffer);

    return reply.send({
      draft: {
        type: "client",
        name: parsed.name ?? "",
        company: parsed.company ?? "",
        country: parsed.country ?? "",
        emails: parsed.emails,
        phones: parsed.phones,
      },
    });
  });

  app.post("/business-card/confirm", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const contact = await prisma.contact.create({
      data: {
        type: (body.type as any) ?? "client",
        name: body.name as string,
        company: (body.company as string) ?? null,
        country: (body.country as string) ?? null,
        emails: (body.emails as string[]) ?? [],
        phones: (body.phones as string[]) ?? [],
        leadStatus: "cold",
        source: "trade_fair",
        businessCardImageUrl: (body.businessCardImageUrl as string) ?? null,
      },
    });

    const nextAction = await suggestNextAction(contact.id);
    await prisma.activity.create({
      data: { contactId: contact.id, type: "next_action", body: nextAction },
    });

    return reply.code(201).send({ contact, nextAction });
  });
}
