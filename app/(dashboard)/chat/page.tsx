"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Bot, User, Car, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Car as CarType } from "@/lib/supabase/types";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "What mods should I prioritize for more power?",
  "How do I improve my car's handling?",
  "What's the best bang-for-buck mod?",
  "How much HP can I safely tune my engine?",
  "What should I know before doing a turbo swap?",
];

function ChatContent() {
  const searchParams = useSearchParams();
  const preselectedCarId = searchParams.get("carId");

  const [cars, setCars] = useState<CarType[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string>(preselectedCarId ?? "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showCarPicker, setShowCarPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("cars")
        .select("id, make, model, year, nickname, cover_image_url")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const carList = (data ?? []) as CarType[];
      setCars(carList);
      if (!selectedCarId && carList[0]) setSelectedCarId(carList[0].id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedCar = cars.find((c) => c.id === selectedCarId);

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;

    const userMessage: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Add empty assistant message for streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          car_id: selectedCarId || undefined,
          history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: json.error ?? "Something went wrong. Please try again." },
        ]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: fullText },
        ]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "Connection error. Please try again." },
      ]);
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-130px)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-[var(--color-accent)] flex items-center justify-center glow-accent-sm">
            <Bot size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold">VAULT AI</h1>
            <p className="text-[11px] text-[var(--color-text-muted)]">Your automotive advisor</p>
          </div>
        </div>

        {/* Car selector */}
        {cars.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowCarPicker((v) => !v)}
              className="flex items-center gap-2 h-8 px-3 rounded-[10px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-bright)] transition-colors text-xs font-medium cursor-pointer"
            >
              <Car size={12} className="text-[var(--color-accent)]" />
              <span className="max-w-[90px] truncate text-[var(--color-text-secondary)]">
                {selectedCar ? `${selectedCar.year} ${selectedCar.make}` : "Select car"}
              </span>
              <ChevronDown size={11} className="text-[var(--color-text-muted)]" />
            </button>

            {showCarPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowCarPicker(false)} />
                <div className="absolute right-0 top-10 z-20 w-56 rounded-[14px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] shadow-2xl overflow-hidden animate-scale-in">
                  <p className="px-3 py-2 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider border-b border-[var(--color-border)]">
                    Select vehicle
                  </p>
                  {cars.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCarId(c.id); setShowCarPicker(false); }}
                      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer ${
                        c.id === selectedCarId ? "text-[var(--color-accent)]" : "text-[var(--color-text-secondary)]"
                      }`}
                    >
                      <Car size={13} className={c.id === selectedCarId ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"} />
                      <span className="truncate">{c.year} {c.make} {c.model}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => { setSelectedCarId(""); setShowCarPicker(false); }}
                    className="w-full text-left flex items-center gap-3 px-3 py-2.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer border-t border-[var(--color-border)]"
                  >
                    No specific car
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 space-y-4 py-2">
        {messages.length === 0 && (
          <div className="pt-4 space-y-6">
            {/* Welcome */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center flex-shrink-0">
                <Bot size={14} className="text-white" />
              </div>
              <div className="chat-bubble-ai px-4 py-3 max-w-[85%]">
                <p className="text-sm leading-relaxed">
                  Hey! I&apos;m VAULT AI — your expert automotive advisor.
                  {selectedCar
                    ? ` I can see you're asking about your ${selectedCar.year} ${selectedCar.make} ${selectedCar.model}. What would you like to know?`
                    : " Ask me anything about mods, performance, maintenance, or car builds."}
                </p>
              </div>
            </div>

            {/* Suggested questions */}
            <div className="space-y-2">
              <p className="text-[11px] text-[var(--color-text-muted)] font-medium px-1">Suggested questions</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-xs px-3 py-2 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:border-[var(--color-border-bright)] hover:bg-[var(--color-bg-hover)] transition-all text-[var(--color-text-secondary)] text-left cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                msg.role === "user"
                  ? "bg-[var(--color-bg-elevated)] border border-[var(--color-border)]"
                  : "bg-[var(--color-accent)]"
              }`}
            >
              {msg.role === "user" ? (
                <User size={13} className="text-[var(--color-text-secondary)]" />
              ) : (
                <Bot size={13} className="text-white" />
              )}
            </div>
            <div
              className={`max-w-[82%] px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"
              }`}
            >
              {msg.content ? (
                <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
              ) : (
                <span className="flex gap-1 items-center h-4">
                  {[0, 1, 2].map((j) => (
                    <span
                      key={j}
                      className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)]"
                      style={{ animation: `typing-dot 1.2s ease ${j * 0.15}s infinite` }}
                    />
                  ))}
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 flex-shrink-0 border-t border-[var(--color-border)]">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about mods, performance, builds…"
              rows={1}
              disabled={streaming}
              className="w-full resize-none rounded-[14px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] focus:border-[var(--color-accent)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none transition-all disabled:opacity-50 max-h-32 overflow-y-auto"
              style={{ minHeight: "46px" }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 128) + "px";
              }}
            />
          </div>
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            className="w-11 h-11 rounded-[12px] bg-[var(--color-accent)] flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none hover:bg-[var(--color-accent-hover)] transition-all active:scale-95 flex-shrink-0 cursor-pointer"
            aria-label="Send message"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] text-center mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatContent />
    </Suspense>
  );
}
