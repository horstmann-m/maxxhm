import { prisma } from "../lib/prisma.js";

// Simple rule-based suggestion for §11 of DESIGN.md. Extend with funnel/deal
// data once Phase 5 lands; deliberately rule-based for now, not ML.
export async function suggestNextAction(contactId: string): Promise<string> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return "Review contact details.";

  if (contact.leadStatus === "dormant") {
    return `Reactivation: reference last contact from ${
      contact.lastContactedAt?.toISOString().slice(0, 10) ?? "unknown date"
    }.`;
  }

  if (contact.type === "supplier") {
    return "Flag as sample-request candidate if origin/process matches current demand.";
  }

  return "Send intro WhatsApp/email within 48h.";
}
