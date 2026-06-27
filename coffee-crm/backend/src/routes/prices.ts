import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

// §10: manual daily entry ships first; same model swaps in a delayed feed
// later without changing the API shape.
export async function pricesRoutes(app: FastifyInstance) {
  app.get("/prices", async (req) => {
    const { from, to } = req.query as { from?: string; to?: string };
    return prisma.priceQuote.findMany({
      where: {
        quoteDate: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      orderBy: { quoteDate: "asc" },
    });
  });

  app.post("/prices", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const quote = await prisma.priceQuote.upsert({
      where: {
        market_contractMonth_quoteDate: {
          market: body.market as any,
          contractMonth: (body.contractMonth as string) ?? "",
          quoteDate: new Date(body.quoteDate as string),
        },
      },
      update: { price: body.price as number, currency: body.currency as string, source: body.source as string },
      create: {
        market: body.market as any,
        contractMonth: (body.contractMonth as string) ?? null,
        price: body.price as number,
        currency: body.currency as string,
        quoteDate: new Date(body.quoteDate as string),
        source: (body.source as string) ?? "manual",
        isDelayed: true,
      },
    });
    return reply.code(201).send(quote);
  });

  // Arbitrage = Arabica ($/lb -> $/tonne) - Robusta ($/tonne), for the most
  // recent date where both legs exist.
  app.get("/prices/arbitrage", async (_req, reply) => {
    const [arabica, robusta] = await Promise.all([
      prisma.priceQuote.findFirst({ where: { market: "arabica" }, orderBy: { quoteDate: "desc" } }),
      prisma.priceQuote.findFirst({ where: { market: "robusta" }, orderBy: { quoteDate: "desc" } }),
    ]);

    if (!arabica || !robusta) {
      return reply.code(404).send({ error: "insufficient_data" });
    }

    const arabicaPerTonne = arabica.price * 22.0462; // cents/lb -> USD/tonne
    const spread = arabicaPerTonne - robusta.price;

    return {
      arabica: { price: arabica.price, quoteDate: arabica.quoteDate },
      robusta: { price: robusta.price, quoteDate: robusta.quoteDate },
      arabicaPerTonneUsd: arabicaPerTonne,
      spreadUsdPerTonne: spread,
    };
  });
}
