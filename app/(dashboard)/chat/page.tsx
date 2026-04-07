"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Bot, User, Car, ChevronDown, Sparkles, Stethoscope, Wrench, Flame, Lightbulb, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { haptic } from "@/lib/haptics";
import type { Car as CarType, Mod } from "@/lib/supabase/types";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface CarWithMods extends CarType {
  modCount: number;
  topMods: { name: string; install_date: string | null; created_at: string }[];
  latestMod: string | null;
}

const HISTORY_KEY = "modvault.chat.history.v1";
const MAX_PERSISTED_MESSAGES = 50;

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  prompt: (car: CarWithMods | null) => string;
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: <Stethoscope size={13} />,
    label: "Diagnose an issue",
    prompt: (car) =>
      car
        ? `My ${car.year} ${car.make} ${car.model} has been making a strange noise. Help me think through what could be causing it — ask me follow-up questions to narrow it down.`
        : "Help me diagnose a strange noise on my car. Ask me follow-up questions to narrow down the cause.",
    color: "#30d158",
  },
  {
    icon: <Wrench size={13} />,
    label: "Plan my next mod",
    prompt: (car) =>
      car
        ? `Look at my ${car.year} ${car.make} ${car.model} build. What's the single best mod I should do next, and why? Be specific with brand names and rough cost.`
        : "What's the best first mod for someone getting into modding? Give me a clear next step.",
    color: "#60A5FA",
  },
  {
    icon: <Flame size={13} />,
    label: "Roast my build",
    prompt: (car) =>
      car
        ? `Roast my ${car.year} ${car.make} ${car.model} build. Be savage but funny — call out anything questionable, anything missing, anything overspent. I can take it.`
        : "Roast me — I haven't even logged my car yet. Be savage but funny.",
    color: "#ff453a",
  },
  {
    icon: <Lightbulb size={13} />,
    label: "What should I upgrade first?",
    prompt: (car) =>
      car
        ? `Given my current ${car.year} ${car.make} ${car.model} mods, what's the highest-impact upgrade I should prioritize for the next $1000? Explain your reasoning.`
        : "I just got my first car. What's the highest-impact upgrade I should make for under $1000?",
    color: "#fbbf24",
  },
];

function getPersonalizedGreeting(car: CarWithMods | null): string {
  if (!car) {
    return "Hey! I'm VAULT AI — your personal automotive advisor. Add a car to your garage and I'll know your build inside and out. In the meantime, ask me anything about mods, performance, or builds.";
  }
  const carName = `${car.year} ${car.make} ${car.model}`;
  if (car.modCount === 0) {
    return `Hey! I see your ${carName} in the garage but no mods logged yet. That's a clean canvas — what are you thinking of doing first?`;
  }
  if (car.latestMod) {
    return `Hey! Looking at your ${carName} — I see you most recently added the ${car.latestMod}. Nice. ${car.modCount} mod${car.modCount > 1 ? "s" : ""} on the build so far. What do you want to know?`;
  }
  return `Hey! Got your ${carName} loaded with all ${car.modCount} mod${car.modCount > 1 ? "s" : ""}. What's on your mind?`;
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
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load persisted history
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Message[];
        if (Array.isArray(parsed)) setMessages(parsed.slice(-MAX_PERSISTED_MESSAGES));
      }
    } catch {
      // ignore
    }
    setHistoryLoaded(true);
  }, []);

  // Persist history
  useEffect(() => {
    if (!historyLoaded) return;
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-MAX_PERSISTED_MESSAGES)));
    } catch {
      // ignore
    }
  }, [messages, historyLoaded]);

  // Load user cars + most recent mod
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

      const carsWithMods: CarWithMods[] = await Promise.all(
        carList.map(async (car) => {
          const { data: modsRaw } = await supabase
            .from("mods")
            .select("name, status, install_date, created_at")
            .eq("car_id", car.id)
            .eq("status", "installed")
            .order("install_date", { ascending: false, nullsFirst: false });
          const installed = (modsRaw ?? []) as Pick<Mod, "name" | "status" | "install_date" | "created_at">[];
          const sorted = [...installed].sort((a, b) => {
            const aDate = new Date(a.install_date ?? a.created_at).getTime();
            const bDate = new Date(b.install_date ?? b.created_at).getTime();
            return bDate - aDate;
          });
          return {
            ...car,
            modCount: installed.length,
            topMods: sorted.slice(0, 3).map((m) => ({ name: m.name, install_date: m.install_date, created_at: m.created_at })),
            latestMod: sorted[0]?.name ?? null,
          };
        })
      );

      // Sort: primary first
      carsWithMods.sort((a, b) => (a.is_primary ? -1 : b.is_primary ? 1 : 0));

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

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;

    haptic("light");
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
        setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content: fullText }]);
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

  function clearHistory() {
    if (!confirm("Clear all chat history?")) return;
    setMessages([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // ignore
    }
  }

  const greeting = getPersonalizedGreeting(selectedCar);

  return (
    <div className="flex flex-col h-[calc(100dvh-140px)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="px-5 sm:px-8 pt-5 pb-4 flex items-center justify-between flex-shrink-0 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] flex items-center justify-center glow-accent-sm">
            <Bot size={19} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold">VAULT AI</h1>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {messages.length > 0 ? `${messages.length} messages` : "Automotive advisor"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="w-9 h-9 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:border-[rgba(255,69,58,0.2)] transition-colors cursor-pointer"
              aria-label="Clear chat"
              title="Clear history"
            >
              <Trash2 size={13} />
            </button>
          )}

          {!loadingCars && cars.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowCarPicker((v) => !v)}
                className="flex items-center gap-2.5 h-9 px-3.5 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-border-bright)] transition-colors text-xs font-medium cursor-pointer"
              >
                {selectedCar?.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedCar.cover_image_url} alt="" className="w-5 h-5 rounded-md object-cover" />
                ) : (
                  <Car size={13} className="text-[var(--color-accent)]" />
                )}
                <span className="max-w-[80px] truncate text-[var(--color-text-secondary)]">
                  {selectedCar ? `${selectedCar.year} ${selectedCar.make}` : "Select car"}
                </span>
                <ChevronDown size={11} className="text-[var(--color-text-muted)]" />
              </button>

              {showCarPicker && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowCarPicker(false)} />
                  <div className="absolute right-0 top-11 z-20 w-64 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-[0_16px_64px_rgba(0,0,0,0.5)] overflow-hidden animate-scale-in">
                    <p className="px-4 py-2.5 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider border-b border-[var(--color-border)]">
                      Your garage
                    </p>
                    {cars.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedCarId(c.id); setShowCarPicker(false); }}
                        className={`w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-bg-elevated)] transition-colors cursor-pointer ${
                          c.id === selectedCarId ? "text-[#60A5FA]" : "text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {c.cover_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.cover_image_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <Car size={14} className={c.id === selectedCarId ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"} />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{c.year} {c.make} {c.model}</p>
                          {c.modCount > 0 && (
                            <p className="text-[10px] text-[var(--color-text-muted)]">{c.modCount} mod{c.modCount > 1 ? "s" : ""}</p>
                          )}
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={() => { setSelectedCarId(""); setShowCarPicker(false); }}
                      className="w-full text-left flex items-center gap-3 px-4 py-3 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] transition-colors cursor-pointer border-t border-[var(--color-border)]"
                    >
                      General (no car context)
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 space-y-5 py-5">
        {messages.length === 0 && (
          <div className="space-y-6">
            {/* Personalized greeting */}
            <div className="flex gap-3.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] flex items-center justify-center flex-shrink-0">
                <Bot size={15} className="text-white" />
              </div>
              <div className="chat-bubble-ai px-5 py-4 max-w-[88%]">
                <p className="text-sm leading-relaxed">{greeting}</p>
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="space-y-3 pl-[52px]">
              <div className="flex items-center gap-2">
                <Sparkles size={12} className="text-[var(--color-accent)]" />
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                  Quick start
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => sendMessage(action.prompt(selectedCar))}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-border-bright)] transition-all cursor-pointer text-left group"
                    style={{ animation: "fadeInUp 350ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform"
                      style={{ background: `${action.color}15`, color: action.color }}
                    >
                      {action.icon}
                    </div>
                    <span className="text-xs font-bold text-white">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3.5 animate-in-fast ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                msg.role === "user"
                  ? "bg-[var(--color-bg-card)] border border-[var(--color-border)]"
                  : "bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)]"
              }`}
            >
              {msg.role === "user" ? (
                <User size={14} className="text-[var(--color-text-secondary)]" />
              ) : (
                <Bot size={14} className="text-white" />
              )}
            </div>
            <div
              className={`max-w-[82%] px-5 py-3.5 text-sm leading-relaxed ${
                msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"
              }`}
            >
              {msg.content ? (
                <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
              ) : (
                <span className="flex gap-1.5 items-center h-4">
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
      <div className="px-5 sm:px-8 py-4 flex-shrink-0 border-t border-[var(--color-border)] glass">
        <div className="flex items-end gap-2.5">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedCar
                  ? `Ask about your ${selectedCar.make} ${selectedCar.model}...`
                  : "Ask about mods, performance, builds..."
              }
              rows={1}
              disabled={streaming}
              className="w-full resize-none rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] focus:border-[var(--color-accent)] px-5 py-3.5 text-sm text-white placeholder-[var(--color-text-muted)] outline-none transition-all disabled:opacity-50 max-h-32 overflow-y-auto"
              style={{ minHeight: "52px" }}
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
            className={`w-13 h-13 rounded-2xl flex items-center justify-center transition-all active:scale-95 flex-shrink-0 cursor-pointer ${
              input.trim() ? "bg-[var(--color-accent)] glow-accent-sm" : "bg-[var(--color-bg-card)] border border-[var(--color-border)]"
            } disabled:opacity-35 disabled:pointer-events-none`}
            style={{ width: "52px", height: "52px" }}
            aria-label="Send message"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
        <p className="text-[10px] text-[var(--color-text-disabled)] text-center mt-2">
          Enter to send · Shift+Enter for new line · History saved locally
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
