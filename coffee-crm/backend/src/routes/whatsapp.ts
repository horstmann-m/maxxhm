import type { FastifyInstance } from "fastify";
import twilio from "twilio";
import { prisma } from "../lib/prisma.js";
import { sendWhatsAppMessage } from "../services/whatsapp.js";

// The webhook is the one route exempt from our own JWT auth (Twilio can't
// carry a bearer token), so it must verify Twilio's request signature
// instead — this replaces auth here, it doesn't skip it (Art. 32 GDPR).
function isValidTwilioRequest(req: { headers: Record<string, unknown>; body: unknown; protocol: string; hostname: string; url: string }): boolean {
  const signature = req.headers["x-twilio-signature"] as string | undefined;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!signature || !authToken) return false;
  const url = `${req.protocol}://${req.hostname}${req.url}`;
  return twilio.validateRequest(authToken, signature, url, req.body as Record<string, string>);
}

interface TwilioInboundBody {
  From: string; // "whatsapp:+1234567890"
  Body: string;
  MessageSid: string;
  NumMedia?: string;
  [key: string]: unknown; // MediaUrl0, MediaUrl1, ...
}

async function findOrCreateConversation(contactId: string) {
  const existing = await prisma.conversation.findFirst({
    where: { contactId, channel: "whatsapp" },
  });
  if (existing) return existing;
  return prisma.conversation.create({ data: { contactId, channel: "whatsapp" } });
}

export async function whatsappRoutes(app: FastifyInstance) {
  // Twilio webhook: configure this URL as the WhatsApp sandbox/sender's
  // "when a message comes in" callback (form-encoded POST).
  app.post("/whatsapp/webhook", async (req, reply) => {
    if (!isValidTwilioRequest(req as any)) {
      return reply.code(403).send({ error: "invalid_signature" });
    }
    const body = req.body as TwilioInboundBody;
    const phone = body.From.replace("whatsapp:", "");

    const contact = await prisma.contact.findFirst({ where: { phones: { has: phone } } });
    if (!contact) {
      app.log.warn(`Inbound WhatsApp from unknown number ${phone}`);
      return reply.code(200).send(""); // ack anyway, Twilio retries on non-2xx
    }

    const conversation = await findOrCreateConversation(contact.id);

    const mediaCount = Number(body.NumMedia ?? "0");
    const mediaUrls = Array.from({ length: mediaCount }, (_, i) => body[`MediaUrl${i}`] as string).filter(Boolean);

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "in",
        channel: "whatsapp",
        body: body.Body ?? "",
        mediaUrls,
        externalId: body.MessageSid,
      },
    });

    await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });
    await prisma.contact.update({ where: { id: contact.id }, data: { lastContactedAt: new Date() } });

    return reply.code(200).send("");
  });

  // Freeform send — only valid within Twilio/Meta's 24h customer-service
  // window; use an approved template outside that window (not yet wired up).
  app.post("/whatsapp/send", async (req, reply) => {
    const { contactId, body } = req.body as { contactId: string; body: string };
    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact || contact.phones.length === 0) {
      return reply.code(404).send({ error: "contact_or_phone_not_found" });
    }

    const conversation = await findOrCreateConversation(contact.id);
    const sent = await sendWhatsAppMessage(contact.phones[0], body);

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "out",
        channel: "whatsapp",
        body,
        externalId: sent.sid,
      },
    });
    await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });

    return reply.code(201).send({ sid: sent.sid });
  });
}
