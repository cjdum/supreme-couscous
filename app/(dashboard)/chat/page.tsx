"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Bot, User, Car, ChevronDown, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Car as CarType } from "@/lib/supabase/types";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface CarWithMods extends CarType {
  modCount: number;
  topMods: string[];
}

function getCarSpecificPrompts(car: CarWithMods | null): string[] {
  if (!car) {
    return [
      "What are the best bang-for-buck mods for any car?",
      "How do I improve handling without breaking the bank?",
      "What should I know before doing a turbo swap?",
      "How do I read a dyno chart?",
      "What's the difference between coilovers and lowering springs?",
    ];
  }
  const name = `${car.year} ${car.make} ${car.model}`;
  return [
    `What are the best power mods for my ${name}?`,
    `What suspension upgrades should I do first on my ${name}?`,
    `What are common issues I should watch out for on my ${name}?`,
    `How much HP can a stock ${car.make} ${car.model} engine handle before needing internals?`,
    `What's a realistic timeline and budget to turn my ${name} into a track car?`,
    car.modCount > 0
      ? `What should I add next to my ${name} build?`
      : `Where should I start modding my ${name}?`,
  ];
}

function ChatContent() {
  const searchParams = useSearchParams();
  const preselectedCarId = searchParams.get("carId");

  const [cars, setCars] = useState<CarWithMods[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string>(preselectedCarId ?? "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showCarPicker, setShowCarPicker] = useState(false);
  const [loadingCars, setLoadingCars] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: carsRaw } = await supabase
        .from("cars")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const carList = (carsRaw ?? []) as CarType[];

      // Fetch mod counts for each car
      const carsWithMods: CarWithMods[] = await Promise.all(
        carList.map(async (car) => {
          const { data: modsRaw } = await supabase
            .from("mods")
            .select("name, status")
            .eq("car_id", car.id)
            .eq("status", "installed")
            .limit(5);
          return {
            ...car,
            modCount: modsRaw?.length ?? 0,
            topMods: (modsRaw ?? []).map((m) => m.name).slice(0, 3),
          };
        })
      );

      setCars(carsWithMods);
      if (!selectedCarId && carsWithMods[0]) {
        setSelectedCarId(carsWithMods[0].id);
      }
      setLoadingCars(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedCar = cars.find((c) => c.id === selectedCarId) ?? null;
  const suggestedPrompts = getCarSpecificPrompts(selectedCar);

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;

    const userMessage: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);
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
        fullText += decoder.decode(value, { stream: true });
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
      <div className="px-4 pt-4 pb-3 flex items-center justify-between flex-shrink-0 border-b border-[rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-[#3B82F6] flex items-center justify-center glow-accent-sm">
            <Bot size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold">VAULT AI</h1>
            <p className="text-[11px] text-[rgba(255,255,255,0.28)]">Automotive advisor</p>
          </div>
        </div>

        {/* Car selector */}
        {!loadingCars && cars.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowCarPicker((v) => !v)}
              className="flex items-center gap-2 h-8 px-3 rounded-[10px] bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.15)] transition-colors text-xs font-medium cursor-pointer"
            >
              <Car size={12} className="text-[#3B82F6]" />
              <span className="max-w-[90px] truncate text-[rgba(255,255,255,0.6)]">
                {selectedCar ? `${selectedCar.year} ${selectedCar.make}` : "Select car"}
              </span>
              <ChevronDown size={11} className="text-[rgba(255,255,255,0.28)]" />
            </button>

            {showCarPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowCarPicker(false)} />
                <div className="absolute right-0 top-10 z-20 w-60 rounded-[14px] bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] shadow-2xl overflow-hidden animate-scale-in">
                  <p className="px-3 py-2 text-[10px] font-semibold text-[rgba(255,255,255,0.35)] uppercase tracking-wider border-b border-[rgba(255,255,255,0.06)]">
                    Your garage
                  </p>
                  {cars.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCarId(c.id); setShowCarPicker(false); }}
                      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-[#222222] transition-colors cursor-pointer ${
                        c.id === selectedCarId ? "text-[#60A5FA]" : "text-[rgba(255,255,255,0.55)]"
                      }`}
                    >
                      <Car size={13} className={c.id === selectedCarId ? "text-[#3B82F6]" : "text-[rgba(255,255,255,0.28)]"} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{c.year} {c.make} {c.model}</p>
                        {c.modCount > 0 && (
                          <p className="text-[10px] text-[rgba(255,255,255,0.28)]">{c.modCount} mod{c.modCount > 1 ? "s" : ""} installed</p>
                        )}
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => { setSelectedCarId(""); setShowCarPicker(false); }}
                    className="w-full text-left flex items-center gap-3 px-3 py-2.5 text-xs text-[rgba(255,255,255,0.3)] hover:bg-[#222222] transition-colors cursor-pointer border-t border-[rgba(255,255,255,0.06)]"
                  >
                    General (no car context)
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 space-y-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-5">
            {/* Welcome message */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[#3B82F6] flex items-center justify-center flex-shrink-0">
                <Bot size={14} className="text-white" />
              </div>
              <div className="chat-bubble-ai px-4 py-3 max-w-[88%]">
                <p className="text-sm leading-relaxed">
                  {selectedCar
                    ? `Hey! I've got your ${selectedCar.year} ${selectedCar.make} ${selectedCar.model} loaded up${selectedCar.modCount > 0 ? ` with your ${selectedCar.modCount} mods` : ""}. What do you want to know?`
                    : "Hey! I'm VAULT AI — your expert automotive advisor. Ask me anything about mods, performance, maintenance, or builds."}
                </p>
              </div>
            </div>

            {/* Suggested prompts */}
            <div className="space-y-2 pl-11">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={11} className="text-[#3B82F6]" />
                <p className="text-[10px] font-semibold text-[rgba(255,255,255,0.35)] uppercase tracking-wider">
                  {selectedCar ? `Suggested for your ${selectedCar.make} ${selectedCar.model}` : "Suggested questions"}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                {suggestedPrompts.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-left text-xs px-3.5 py-2.5 rounded-[12px] bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] hover:border-[rgba(59,130,246,0.4)] hover:bg-[rgba(59,130,246,0.06)] transition-all text-[rgba(255,255,255,0.55)] cursor-pointer"
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
                  ? "bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)]"
                  : "bg-[#3B82F6]"
              }`}
            >
              {msg.role === "user" ? (
                <User size={12} className="text-[rgba(255,255,255,0.55)]" />
              ) : (
                <Bot size={12} className="text-white" />
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
                      className="w-1.5 h-1.5 rounded-full bg-[rgba(255,255,255,0.3)]"
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
      <div className="px-4 py-3 flex-shrink-0 border-t border-[rgba(255,255,255,0.05)]">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedCar
                  ? `Ask about your ${selectedCar.make} ${selectedCar.model}…`
                  : "Ask about mods, performance, builds…"
              }
              rows={1}
              disabled={streaming}
              className="w-full resize-none rounded-[14px] bg-[#1a1a1a] border border-[rgba(255,255,255,0.07)] focus:border-[#3B82F6] px-4 py-3 text-sm text-white placeholder-[rgba(255,255,255,0.25)] outline-none transition-all disabled:opacity-50 max-h-32 overflow-y-auto"
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
            className="w-11 h-11 rounded-[12px] bg-[#3B82F6] flex items-center justify-center disabled:opacity-35 disabled:pointer-events-none hover:bg-[#60A5FA] transition-all active:scale-95 flex-shrink-0 cursor-pointer"
            aria-label="Send message"
          >
            <Send size={15} className="text-white" />
          </button>
        </div>
        <p className="text-[10px] text-[rgba(255,255,255,0.2)] text-center mt-1.5">
          Enter to send · Shift+Enter for new line
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
