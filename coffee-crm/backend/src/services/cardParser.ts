export interface ParsedCard {
  name?: string;
  company?: string;
  emails: string[];
  phones: string[];
  country?: string;
}

export interface CardParserService {
  parse(imageBuffer: Buffer): Promise<ParsedCard>;
}

// Swap this for a real provider (Vision API / multimodal LLM call) once one
// is wired up. Phase 1.5 ships with manual confirmation either way, so a stub
// that returns nothing still produces a usable empty draft contact.
export class StubCardParserService implements CardParserService {
  async parse(_imageBuffer: Buffer): Promise<ParsedCard> {
    return { emails: [], phones: [] };
  }
}

export const cardParserService: CardParserService = new StubCardParserService();
