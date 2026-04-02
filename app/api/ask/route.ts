import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { hentFlystatus } from "@/lib/avinor";

const client = new Anthropic();

const TOOLS: Anthropic.Tool[] = [
  {
    name: "hent_flystatus",
    description:
      "Henter aktuell flystatus for avganger mellom Oslo (OSL) og Bergen (BGO). " +
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
        retning: {
          type: "string",
          description:
            "Retningen på flyvningen. 'OSL-BGO' for Oslo til Bergen, 'BGO-OSL' for Bergen til Oslo. Bruk alltid retningen brukeren har valgt.",
        },
      },
      required: [],
    },
  },
];

function byggSystemPrompt(retning: "OSL-BGO" | "BGO-OSL"): string {
  const fra = retning === "OSL-BGO" ? "Oslo (OSL)" : "Bergen (BGO)";
  const til = retning === "OSL-BGO" ? "Bergen (BGO)" : "Oslo (OSL)";
  const fraKort = retning === "OSL-BGO" ? "OSL" : "BGO";
  const tilKort = retning === "OSL-BGO" ? "BGO" : "OSL";

  return `Du er en norsk flyinformasjonsassistent som hjelper med flystatus mellom Oslo (OSL) og Bergen (BGO).

Brukeren ser nå på retningen ${fra} → ${til}. Bruk alltid retning="${retning}" når du kaller verktøyet.

Verktøyet returnerer to lister:
- fly_nå: fly innenfor tidsvinduet 30 min tilbake og 90 min frem fra nå
- alle_fly_dag: alle avganger ${fraKort}→${tilKort} den aktuelle dagen

Regler:
- Svar alltid på norsk.
- Bruk alltid verktøyet hent_flystatus for å hente data – aldri gjett eller dikter opp flyinformasjon.
- Standardsvar: bruk fly_nå (aktive fly rundt nå). Hvis fly_nå er tom, si at det ikke er noen avganger i det aktuelle tidsvinduet.
- Spørsmål om et spesifikt fly eller tidspunkt (f.eks. "SAS-flyet kl. 15:30" eller "hvilke fly er det i ettermiddag"): bruk alle_fly_dag.
- Hvis brukeren spør om alle dagens fly: list opp alle_fly_dag kronologisk.
- Hvis brukeren spør om alle fly fra ett bestemt flyselskap (f.eks. "Alle SAS" eller "alle Norwegian-fly"): filtrer på det flyselskapet og list opp alle_fly_dag kronologisk.
- Hvis brukeren spør uten å nevne flyselskap og fly_nå har fly fra flere selskaper, spør hvem de mener.
- Presenter alltid: flyselskap, rutenummer, status (i rute/forsinket/kansellert), og planlagt landing i ${til}.
- Eksempel i rute: "SAS SK257 er i rute og lander i ${til} kl. 12:25."
- Eksempel forsinket: "Norwegian DY608 er forsinket 15 minutter og lander i ${til} kl. 10:50."
- Eksempel kansellert: "Widerøe WF163 er kansellert."
- Avgangstid fra ${fra}: nevn kun hvis brukeren spør eller ved forsinkelse.
- Vær konkret og kortfattet. Unngå unødvendig prating.
- Bruk aldri markdown-formatering (ingen stjerner, ingen fet skrift, ingen lister med bindestrek).`;
}

type Message = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const {
    message,
    history = [],
    retning = "OSL-BGO",
  }: { message: string; history: Message[]; retning?: "OSL-BGO" | "BGO-OSL" } =
    await req.json();

  if (!message?.trim()) {
    return NextResponse.json({ error: "Tomt spørsmål" }, { status: 400 });
  }

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  // Agentic loop
  while (true) {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: byggSystemPrompt(retning),
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          const input = block.input as { flyselskap?: string; retning?: "OSL-BGO" | "BGO-OSL" };
          const result = await hentFlystatus(input.flyselskap, input.retning ?? retning);
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
