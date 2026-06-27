import { Mistral } from "@mistralai/mistralai";

export interface ParsedCard {
  name?: string;
  company?: string;
  emails: string[];
  phones: string[];
  country?: string;
}

export interface CardParserService {
  parse(imageBuffer: Buffer, mediaType: string): Promise<ParsedCard>;
}

const SYSTEM_PROMPT =
  "You extract contact details from a photo of a business card. " +
  "Respond with ONLY a JSON object: " +
  '{"name": string|null, "company": string|null, "emails": string[], "phones": string[], "country": string|null}. ' +
  "Phones should include country code if printed on the card. If a field isn't visible, use null/empty array. No prose, no markdown fences.";

// EU-hosted vision call for §11 of DESIGN.md (Mistral is a French company;
// La Plateforme processes requests in the EU, which Anthropic/Claude does
// not guarantee — required given the strict no-data-leaves-Europe policy).
export class MistralCardParserService implements CardParserService {
  private client: Mistral;
  private model: string;

  constructor() {
    this.client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
    this.model = process.env.MISTRAL_MODEL ?? "pixtral-large-latest";
  }

  async parse(imageBuffer: Buffer, mediaType = "image/jpeg"): Promise<ParsedCard> {
    const dataUrl = `data:${mediaType};base64,${imageBuffer.toString("base64")}`;

    const response = await this.client.chat.complete({
      model: this.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the contact details from this business card." },
            { type: "image_url", imageUrl: dataUrl },
          ],
        },
      ],
    });

    const text = response.choices?.[0]?.message?.content;
    if (typeof text !== "string") return { emails: [], phones: [] };

    try {
      const parsed = JSON.parse(text);
      return {
        name: parsed.name ?? undefined,
        company: parsed.company ?? undefined,
        emails: Array.isArray(parsed.emails) ? parsed.emails : [],
        phones: Array.isArray(parsed.phones) ? parsed.phones : [],
        country: parsed.country ?? undefined,
      };
    } catch {
      return { emails: [], phones: [] };
    }
  }
}

export const cardParserService: CardParserService = new MistralCardParserService();
