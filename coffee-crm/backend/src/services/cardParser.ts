import Anthropic from "@anthropic-ai/sdk";

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

// Real implementation for §11 of DESIGN.md. Cheap and good enough for OCR-style
// extraction from a single photo; swap ANTHROPIC_MODEL via env if a newer
// Claude model id supersedes the default.
export class ClaudeCardParserService implements CardParserService {
  private client: Anthropic;
  private model: string;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929";
  }

  async parse(imageBuffer: Buffer, mediaType = "image/jpeg"): Promise<ParsedCard> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                data: imageBuffer.toString("base64"),
              },
            },
            { type: "text", text: "Extract the contact details from this business card." },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return { emails: [], phones: [] };

    try {
      const parsed = JSON.parse(textBlock.text);
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

export const cardParserService: CardParserService = new ClaudeCardParserService();
