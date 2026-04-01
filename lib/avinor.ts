import { XMLParser } from "fast-xml-parser";

const AVINOR_URL = "https://asrv.avinor.no/XmlFeed/v1.0";
const OSLO_TZ = "Europe/Oslo";

const AIRLINE_NAMES: Record<string, string> = {
  SK: "SAS",
  DY: "Norwegian",
  WF: "Widerøe",
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

function parseUtc(value: string | undefined): Date | null {
  if (!value) return null;
  return new Date(value.endsWith("Z") ? value : value + "Z");
}

function fmtOslo(date: Date | null): string {
  if (!date) return "-";
  return date.toLocaleTimeString("no-NO", {
    timeZone: OSLO_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

async function fetchXml(params: Record<string, string>) {
  const url = new URL(AVINOR_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Avinor svarte ${res.status}`);
  return parser.parse(await res.text());
}

function toArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

async function hentBgoAnkomsttider(): Promise<Record<string, string>> {
  const data = await fetchXml({ airport: "BGO", TimeFrom: "1", TimeTo: "6", direction: "A" });
  const map: Record<string, string> = {};
  for (const f of toArray(data?.airport?.flights?.flight)) {
    if (f?.airport === "OSL" && f?.flight_id && f?.schedule_time) {
      map[f.flight_id] = f.schedule_time;
    }
  }
  return map;
}

export interface FlightInfo {
  rutenummer: string;
  flyselskap: string;
  planlagt_avgang: string;
  planlagt_landing_bgo: string;
  kansellert: boolean;
  forsinket: boolean;
  forsinkelse_minutter: number | null;
  ny_tid: string | null;
  via: string | null;
  gate: string | null;
}

export interface FlightResult {
  antall: number;
  fly: FlightInfo[];
  tilgjengelige_flyselskaper: string[];
  tidspunkt: string;
  vindu: string;
  feil?: string;
}

export async function hentFlystatus(flyselskap?: string): Promise<FlightResult> {
  const now = new Date();
  const vinduStart = new Date(now.getTime() - 30 * 60 * 1000);
  const vinduSlutt = new Date(now.getTime() + 90 * 60 * 1000);

  let bgoAnkomster: Record<string, string> = {};
  let departures;

  try {
    [bgoAnkomster, departures] = await Promise.all([
      hentBgoAnkomsttider(),
      fetchXml({ airport: "OSL", TimeFrom: "1", TimeTo: "6", direction: "D" }),
    ]);
  } catch (e) {
    return {
      antall: 0,
      fly: [],
      tilgjengelige_flyselskaper: [],
      tidspunkt: fmtOslo(now),
      vindu: "",
      feil: `Kunne ikke hente data fra Avinor: ${e}`,
    };
  }

  const flights: FlightInfo[] = [];

  for (const f of toArray(departures?.airport?.flights?.flight)) {
    if (f?.airport !== "BGO") continue;

    const airlineCode: string = f?.airline ?? "";
    if (!AIRLINE_NAMES[airlineCode]) continue;

    const schedDt = parseUtc(f?.schedule_time);
    if (!schedDt || schedDt < vinduStart || schedDt > vinduSlutt) continue;

    const statusCode: string = f?.status?.["@_code"] ?? "";
    const statusTimeRaw: string | undefined = f?.status?.["@_time"];
    const statusDt = parseUtc(statusTimeRaw);
    const delayed: string = f?.delayed ?? "";

    const delayMin =
      schedDt && statusDt
        ? Math.round((statusDt.getTime() - schedDt.getTime()) / 60000)
        : null;

    const ankomstRaw = f?.flight_id ? bgoAnkomster[f.flight_id] : undefined;

    flights.push({
      rutenummer: f?.flight_id ?? "-",
      flyselskap: AIRLINE_NAMES[airlineCode],
      planlagt_avgang: fmtOslo(schedDt),
      planlagt_landing_bgo: fmtOslo(parseUtc(ankomstRaw)),
      kansellert: statusCode === "C",
      forsinket: delayed === "Y" || (delayMin !== null && delayMin > 0),
      forsinkelse_minutter: delayMin && delayMin > 0 ? delayMin : null,
      ny_tid: statusDt && statusDt.getTime() !== schedDt?.getTime() ? fmtOslo(statusDt) : null,
      via: f?.via_airport ?? null,
      gate: f?.gate ?? null,
    });
  }

  flights.sort((a, b) => a.planlagt_avgang.localeCompare(b.planlagt_avgang));

  const filtered = flyselskap
    ? flights.filter((f) => f.flyselskap.toLowerCase() === flyselskap.toLowerCase())
    : flights;

  const tilgjengelige = [...new Set(flights.map((f) => f.flyselskap))].sort();

  return {
    antall: filtered.length,
    fly: filtered,
    tilgjengelige_flyselskaper: tilgjengelige,
    tidspunkt: fmtOslo(now),
    vindu: `${fmtOslo(vinduStart)}–${fmtOslo(vinduSlutt)}`,
  };
}
