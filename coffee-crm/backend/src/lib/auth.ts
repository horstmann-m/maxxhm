import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

// Single-user (solo trader) auth: one owner account, JWT bearer tokens.
// Every route is protected by default (Art. 32 GDPR — confidentiality of
// processing) except the ones explicitly listed in PUBLIC_PATHS.
const PUBLIC_PATHS = new Set(["/health", "/auth/login", "/whatsapp/webhook"]);

export async function registerAuth(app: FastifyInstance) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET must be set — refusing to start without it.");
  }
  await app.register(fastifyJwt, { secret });

  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    if (PUBLIC_PATHS.has(req.routerPath ?? req.url.split("?")[0])) return;
    try {
      await req.jwtVerify();
    } catch {
      reply.code(401).send({ error: "unauthorized" });
    }
  });
}
