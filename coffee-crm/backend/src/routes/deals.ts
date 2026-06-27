import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

// 1 metric tonne = 2204.62 lb, so cents/lb * 22.0462 = USD/tonne (the /100
// cents-to-dollars conversion and the *2204.62 lb-to-tonne conversion cancel
// down to this single constant — do not divide by 100 again below).
const CENTS_LB_TO_USD_PER_TONNE = 22.0462;

interface DealInput {
  contactId: string;
  coffeeDescription?: string;
  stage?: string;
  priceType: "outright" | "differential";
  currency: "EUR" | "USD";
  outrightPrice?: number;
  market?: "robusta" | "arabica";
  differentialCents?: number;
  quantityKg?: number;
  incoterm?: string;
  expectedCloseDate?: string;
  probability?: number;
  lostReason?: string;
}

function validatePricing(body: DealInput): string | null {
  if (body.priceType === "outright") {
    if (typeof body.outrightPrice !== "number") return "outrightPrice is required for outright deals";
  } else if (body.priceType === "differential") {
    if (!body.market) return "market is required for differential deals";
    if (typeof body.differentialCents !== "number") return "differentialCents is required for differential deals";
  } else {
    return "priceType must be outright or differential";
  }
  if (body.currency !== "EUR" && body.currency !== "USD") return "currency must be EUR or USD";
  return null;
}

// Effective USD/tonne price for a deal. Outright prices are entered in
// cents/lb (the Arabica/ICE-NY convention), so they always need the
// cents/lb -> USD/tonne conversion. Differential deals add the spread to the
// latest same-market PriceQuote, but Robusta (ICE London) is quoted directly
// in USD/tonne rather than cents/lb, so only the Arabica leg needs the
// conversion — see prices/arbitrage route for the same market-specific
// handling. Currency conversion (EUR deals priced against a USD C-market) is
// out of scope until an FX rate is wired in — flagged on the response so the
// UI doesn't silently show the wrong unit.
async function priceEstimate(deal: { priceType: string; currency: string; outrightPrice: number | null; market: string | null; differentialCents: number | null }) {
  if (deal.priceType === "outright") {
    return {
      perTonne: deal.outrightPrice !== null ? deal.outrightPrice * CENTS_LB_TO_USD_PER_TONNE : null,
      basis: "outright" as const,
      fxConversionApplied: false,
    };
  }

  const latest = await prisma.priceQuote.findFirst({
    where: { market: deal.market as any },
    orderBy: { quoteDate: "desc" },
  });
  if (!latest || deal.differentialCents === null) {
    return { perTonne: null, basis: "differential" as const, fxConversionApplied: false };
  }
  const perTonne =
    deal.market === "robusta"
      ? latest.price + deal.differentialCents
      : (latest.price + deal.differentialCents) * CENTS_LB_TO_USD_PER_TONNE;
  return {
    perTonne,
    basis: "differential" as const,
    referenceQuoteDate: latest.quoteDate,
    fxConversionApplied: deal.currency !== "USD",
  };
}

export async function dealsRoutes(app: FastifyInstance) {
  app.get("/deals", async () => {
    const deals = await prisma.deal.findMany({
      orderBy: { createdAt: "desc" },
      include: { contact: { select: { id: true, name: true, company: true } } },
    });
    return Promise.all(
      deals.map(async (deal) => ({ ...deal, priceEstimate: await priceEstimate(deal) }))
    );
  });

  app.get("/deals/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const deal = await prisma.deal.findUnique({ where: { id }, include: { contact: true } });
    if (!deal) return reply.code(404).send({ error: "not_found" });
    return { ...deal, priceEstimate: await priceEstimate(deal) };
  });

  app.post("/deals", async (req, reply) => {
    const body = req.body as DealInput;
    const validationError = validatePricing(body);
    if (validationError) return reply.code(400).send({ error: validationError });

    const deal = await prisma.deal.create({
      data: {
        contactId: body.contactId,
        coffeeDescription: body.coffeeDescription ?? null,
        stage: (body.stage as any) ?? "lead",
        priceType: body.priceType,
        currency: body.currency,
        outrightPrice: body.outrightPrice ?? null,
        market: body.market ?? null,
        differentialCents: body.differentialCents ?? null,
        quantityKg: body.quantityKg ?? null,
        incoterm: body.incoterm ?? null,
        expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
        probability: body.probability ?? null,
      },
    });
    return reply.code(201).send(deal);
  });

  app.patch("/deals/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Partial<DealInput> & { stage?: string };

    if (body.priceType) {
      const validationError = validatePricing(body as DealInput);
      if (validationError) return reply.code(400).send({ error: validationError });
    }

    const closedStages = ["closed_won", "closed_lost"];
    const data: Record<string, unknown> = { ...body };
    if (body.expectedCloseDate) data.expectedCloseDate = new Date(body.expectedCloseDate);
    if (body.stage && closedStages.includes(body.stage)) data.closedAt = new Date();

    try {
      const deal = await prisma.deal.update({ where: { id }, data: data as any });
      return deal;
    } catch {
      return reply.code(404).send({ error: "not_found" });
    }
  });
}
