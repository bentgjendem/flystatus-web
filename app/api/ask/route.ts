import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { hentFlystatus } from "@/lib/avinor";

const client = new Anthropic();

const TOOLS: Anthropic.Tool[] = [
  {
    name: "hent_flystatus_osl_bgo",
    description:
      "Henter aktuell flystatus for avganger fra Oslo (OSL) til Bergen (BGO). " +
      "Returnerer alle fly i tidsvinduet 30 minutter tilbake og 90 minutter frem. " +
      "Kan filtrere på ett flyselskap (SAS, Norwegian, Widerøe). " +
      "Bruk dette verktøyet alltid når brukeren spør om flystatus.",
    input_schema: {
      type: "object" as const,
      properties: {
        flyselskap: {
          type: "string",
          description:
            "Valgfritt. Filtrer på ett flyselskap: 'SAS', 'Norwegian' eller 'Widerøe'. Utelat for å hente alle.",
        },
      },
      required: [],
    },
  },
];

const SYSTEM_PROMPT = `Du er en norsk flyinformasjonsassistent som hjelper med flystatus mellom Oslo (OSL) og Bergen (BGO).

Regler:
- Svar alltid på norsk.
- Bruk alltid verktøyet hent_flystatus_osl_bgo for å hente data – aldri gjett eller dikter opp flyinformasjon.
- Hvis brukeren spør uten å nevne flyselskap, og det er fly fra flere selskaper, spør hvem de mener.
- Hvis brukeren svarer med et flyselskap (f.eks. "SAS"), hent data filtrert på det selskapet.
- Presenter alltid: flyselskap, rutenummer, status (i rute/forsinket/kansellert), og planlagt landing i Bergen.
- Eksempel i rute: "SAS SK257 er i rute og lander i Bergen kl. 12:25."
- Eksempel forsinket: "Norwegian DY608 er forsinket 15 minutter og lander i Bergen kl. 10:50."
- Eksempel kansellert: "Widerøe WF163 er kansellert."
- Avgangstid fra Oslo: nevn kun hvis brukeren spør eller ved forsinkelse.
- Vær konkret og kortfattet. Unngå unødvendig prating.
- Kun OSL→BGO støttes foreløpig.`;

type Message = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const { message, history = [] }: { message: string; history: Message[] } =
    await req.json();

  if (!message?.trim()) {
    return NextResponse.json({ error: "Tomt spørsmål" }, { status: 400 });
  }

  // Build Anthropic message list from text history + new user message
  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  // Agentic loop
  while (true) {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          const input = block.input as { flyselskap?: string };
          const result = await hentFlystatus(input.flyselskap);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
    } else {
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as Anthropic.TextBlock).text)
        .join("");

      return NextResponse.json({ answer: text });
    }
  }
}
