import twilio from "twilio";

// §3 of DESIGN.md, Twilio variant: Twilio's WhatsApp sandbox is free for
// testing (your number joins via a join code); production sending uses a
// real WhatsApp sender and is billed per message by both Twilio and Meta —
// it is not free at that point, just simpler to operate than raw Cloud API.
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER; // e.g. "whatsapp:+14155238886"

export async function sendWhatsAppMessage(toPhone: string, body: string) {
  return client.messages.create({
    from: fromNumber,
    to: `whatsapp:${toPhone}`,
    body,
  });
}
