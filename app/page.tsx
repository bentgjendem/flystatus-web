"use client";

import { useState, useRef, useEffect, FormEvent } from "react";

type Message = { role: "user" | "assistant"; content: string };

const HINTS = [
  "Er flyet fra Oslo til Bergen i rute?",
  "Er SAS-flyet i rute?",
  "Hva med Norwegian?",
  "Er Widerøe-flyet i rute?",
];

function FlightRouteHeader() {
  return (
    <div className="route-header">
      <div className="airport airport-left">
        <div className="airport-icon">🏙️</div>
        <div className="airport-code">OSL</div>
        <div className="airport-name">Oslo</div>
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
          <text fontSize="22" textAnchor="middle" fill="white" style={{filter:"drop-shadow(0 0 5px rgba(255,200,50,0.8))"}}>
            ✈
            <animateMotion
              dur="5s"
              repeatCount="indefinite"
              path="M 20 60 Q 150 -10 280 60"
              rotate="auto"
            />
          </text>
        </svg>
        <div className="route-label">ca. 45 min</div>
      </div>

      <div className="airport airport-right">
        <div className="airport-icon">🏔️</div>
        <div className="airport-code">BGO</div>
        <div className="airport-name">Bergen</div>
      </div>
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
        body: JSON.stringify({ message: text, history: messages }),
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

  return (
    <div className="card">
      <FlightRouteHeader />
      <div className="card-header">
        <h1>✈️ Flystatus Oslo → Bergen</h1>
        <p>Viser fly 30 min tilbake og 90 min frem</p>
      </div>

      <div className="messages">
        {messages.length === 0 && (
          <div className="bubble assistant">
            Hei! Spør meg om fly fra Oslo til Bergen er i rute. 👇
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
        {HINTS.map((h) => (
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
