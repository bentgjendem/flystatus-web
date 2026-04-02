"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { hentVaer, WeatherInfo } from "@/lib/weather";

type Message = { role: "user" | "assistant"; content: string };
type Weather = { oslo: WeatherInfo; bergen: WeatherInfo };
type Retning = "OSL-BGO" | "BGO-OSL";

const HINTS: Record<Retning, string[]> = {
  "OSL-BGO": [
    "Er flyet fra Oslo til Bergen i rute?",
    "Er SAS-flyet i rute?",
    "Hva med Norwegian?",
    "Alle SAS",
    "Er Widerøe-flyet i rute?",
  ],
  "BGO-OSL": [
    "Er flyet fra Bergen til Oslo i rute?",
    "Er SAS-flyet i rute?",
    "Hva med Norwegian?",
    "Alle SAS",
    "Er Widerøe-flyet i rute?",
  ],
};

function FlightRouteHeader({
  weather,
  retning,
  onSwap,
}: {
  weather: Weather | null;
  retning: Retning;
  onSwap: () => void;
}) {
  const venstreKode = retning === "OSL-BGO" ? "OSL" : "BGO";
  const venstreNavn = retning === "OSL-BGO" ? "Oslo" : "Bergen";
  const venstreVaer = retning === "OSL-BGO" ? weather?.oslo : weather?.bergen;

  const hoyreKode = retning === "OSL-BGO" ? "BGO" : "OSL";
  const hoyreNavn = retning === "OSL-BGO" ? "Bergen" : "Oslo";
  const hoyreVaer = retning === "OSL-BGO" ? weather?.bergen : weather?.oslo;

  return (
    <div className="route-header">
      <div className="airport airport-left">
        <div className="airport-code">{venstreKode}</div>
        <div className="airport-name">{venstreNavn}</div>
        <div className="airport-weather">
          {venstreVaer ? `${venstreVaer.icon} ${venstreVaer.temp}°` : "…"}
        </div>
      </div>

      <div className="route-middle">
        <svg className="route-svg" viewBox="0 0 300 80" preserveAspectRatio="none">
          <path
            d="M 20 60 Q 150 -10 280 60"
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1.5"
            strokeDasharray="6 5"
          />
          <text fontSize="22" textAnchor="middle" fill="white" style={{ filter: "drop-shadow(0 0 5px rgba(255,200,50,0.8))" }}>
            ✈
            <animateMotion
              dur="5s"
              repeatCount="indefinite"
              path="M 20 60 Q 150 -10 280 60"
              rotate="auto"
            />
          </text>
        </svg>
        <button className="swap-btn" onClick={onSwap} title="Bytt retning">
          ⇄
        </button>
      </div>

      <div className="airport airport-right">
        <div className="airport-code">{hoyreKode}</div>
        <div className="airport-name">{hoyreNavn}</div>
        <div className="airport-weather">
          {hoyreVaer ? `${hoyreVaer.icon} ${hoyreVaer.temp}°` : "…"}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [retning, setRetning] = useState<Retning>("OSL-BGO");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hentVaer().then(setWeather).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function byttRetning() {
    setRetning((r) => (r === "OSL-BGO" ? "BGO-OSL" : "OSL-BGO"));
    setMessages([]);
  }

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages, retning }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.answer ?? "Noe gikk galt." }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Kunne ikke koble til serveren." }]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  const fra = retning === "OSL-BGO" ? "Oslo" : "Bergen";
  const til = retning === "OSL-BGO" ? "Bergen" : "Oslo";

  return (
    <div className="card">
      <FlightRouteHeader weather={weather} retning={retning} onSwap={byttRetning} />
      <div className="card-header">
        <h1>✈️ Flystatus {fra} → {til}</h1>
        <p>Viser fly 30 min tilbake og 90 min frem</p>
      </div>

      <div className="messages">
        {messages.length === 0 && (
          <div className="bubble assistant">
            Hei! Spør meg om fly fra {fra} til {til} er i rute. 👇
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="bubble assistant loading">Sjekker flydata …</div>}
        <div ref={bottomRef} />
      </div>

      <div className="hints">
        {HINTS[retning].map((h) => (
          <button key={h} className="hint" onClick={() => send(h)} disabled={loading}>
            {h}
          </button>
        ))}
      </div>

      <form className="input-row" onSubmit={onSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Skriv et spørsmål …"
          disabled={loading}
          autoFocus
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send ✈
        </button>
      </form>
    </div>
  );
}
