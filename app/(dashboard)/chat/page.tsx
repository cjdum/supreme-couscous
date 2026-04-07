"use client";

import { useState, useRef, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Send,
  Bot,
  User as UserIcon,
  Car as CarIcon,
  ChevronDown,
  Sparkles,
  Plus,
  Menu,
  X,
  Trash2,
  MessageCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { haptic } from "@/lib/haptics";
import { Markdown } from "@/components/ui/markdown";
import type { Car as CarType, Mod } from "@/lib/supabase/types";

interface Message {
  role: "user" | "assistant";
  content: string;
  quickReplies?: string[];
}

interface CarWithMods extends CarType {
  modCount: number;
  latestMod: string | null;
}

interface StoredConversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

const CONVERSATIONS_KEY = "modvault.chat.conversations.v1";
const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES_PER_CONVERSATION = 60;

function generateId(): string {
  return `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadConversations(): StoredConversation[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_CONVERSATIONS);
  } catch {
    return [];
  }
}

function saveConversations(list: StoredConversation[]) {
  try {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(list.slice(0, MAX_CONVERSATIONS)));
  } catch {
    // ignore quota errors
  }
}

function titleFromMessages(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New conversation";
  const trimmed = firstUser.content.trim().replace(/\s+/g, " ");
  return trimmed.length > 42 ? trimmed.slice(0, 42) + "…" : trimmed;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const d = Math.floor(diff / 86400000);
  if (d === 0) {
    const h = Math.floor(diff / 3600000);
    if (h === 0) {
      const m = Math.floor(diff / 60000);
      return m <= 0 ? "just now" : `${m}m ago`;
    }
    return `${h}h ago`;
  }
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function getSuggestedPrompts(car: CarWithMods | null): string[] {
  if (!car) {
    return [
      "What's the best first mod for track days?",
      "How much would a full exhaust build cost?",
      "Recommend a beginner-friendly horsepower upgrade",
      "What should I look for when buying a project car?",
    ];
  }
  const carName = `${car.year} ${car.make} ${car.model}`;
  const makeModel = `${car.make} ${car.model}`;
  return [
    `What should I add to my ${carName} next?`,
    `How much HP does my current build make?`,
    `What's the best mod under $500 for a ${makeModel}?`,
    `Roast my ${carName} build`,
  ];
}

function ChatContent() {
  const searchParams = useSearchParams();
  const preselectedCarId = searchParams.get("carId");

  const [cars, setCars] = useState<CarWithMods[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string>(preselectedCarId ?? "");
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showCarPicker, setShowCarPicker] = useState(false);
  const [loadingCars, setLoadingCars] = useState(true);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const userScrolledUpRef = useRef(false);

  // Load persisted conversations
  useEffect(() => {
    const list = loadConversations();
    setConversations(list);
    if (list.length > 0) {
      setActiveConversationId(list[0].id);
      setMessages(list[0].messages);
    } else {
      setActiveConversationId(generateId());
    }
    setHistoryLoaded(true);
  }, []);

  // Persist current conversation
  useEffect(() => {
    if (!historyLoaded || !activeConversationId) return;
    if (messages.length === 0) return;

    setConversations((prev) => {
      const trimmed = messages.slice(-MAX_MESSAGES_PER_CONVERSATION);
      const existingIdx = prev.findIndex((c) => c.id === activeConversationId);
      const updated: StoredConversation = {
        id: activeConversationId,
        title: titleFromMessages(trimmed),
        messages: trimmed,
        updatedAt: Date.now(),
      };
      const next = existingIdx >= 0
        ? [updated, ...prev.filter((c) => c.id !== activeConversationId)]
        : [updated, ...prev];
      saveConversations(next);
      return next;
    });
  }, [messages, activeConversationId, historyLoaded]);

  // Load user cars
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
          const installed = (modsRaw ?? []) as Pick<
            Mod,
            "name" | "status" | "install_date" | "created_at"
          >[];
          const sorted = [...installed].sort((a, b) => {
            const aDate = new Date(a.install_date ?? a.created_at).getTime();
            const bDate = new Date(b.install_date ?? b.created_at).getTime();
            return bDate - aDate;
          });
          return {
            ...car,
            modCount: installed.length,
            latestMod: sorted[0]?.name ?? null,
          };
        })
      );

      carsWithMods.sort((a, b) => (a.is_primary ? -1 : b.is_primary ? 1 : 0));

      setCars(carsWithMods);
      if (!selectedCarId && carsWithMods[0]) {
        setSelectedCarId(carsWithMods[0].id);
      }
      setLoadingCars(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll — but only if the user hasn't scrolled up. This is the fix
  // for "can't scroll while AI is responding": previously every streamed token
  // yanked the viewport back down. Now we track whether the user is near the
  // bottom and only auto-scroll in that case, so they're free to scroll up
  // and read prior context while a response streams in.
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      userScrolledUpRef.current = distanceFromBottom > 120;
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (userScrolledUpRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // When the user submits a new message, snap them back to the bottom regardless
  function snapToBottom() {
    userScrolledUpRef.current = false;
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }

  // Auto-grow textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 22;
    const maxHeight = lineHeight * 4 + 28;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [input]);

  const selectedCar = cars.find((c) => c.id === selectedCarId) ?? null;

  const fetchQuickReplies = useCallback(async (assistantReply: string): Promise<string[]> => {
    try {
      const res = await fetch("/api/ai/chat/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistant_reply: assistantReply }),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json.suggestions) ? json.suggestions : [];
    } catch {
      return [];
    }
  }, []);

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;

    haptic("light");
    snapToBottom();
    const userMessage: Message = { role: "user", content: text.trim() };
    // Strip any previous quick replies — we only want them on the most recent message
    const cleanedMessages: Message[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const newMessages = [...cleanedMessages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    setSidebarOpen(false);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          car_id: selectedCarId || undefined,
          history: cleanedMessages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            role: "assistant",
            content: json.error ?? "Something went wrong. Please try again.",
          },
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

      // Fetch quick-reply suggestions (fire-and-forget — don't block the UI)
      if (fullText.length > 40) {
        const quickReplies = await fetchQuickReplies(fullText);
        if (quickReplies.length > 0) {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            return [...prev.slice(0, -1), { ...last, quickReplies }];
          });
        }
      }
    } catch {
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

  function startNewConversation() {
    haptic("light");
    const id = generateId();
    setActiveConversationId(id);
    setMessages([]);
    setSidebarOpen(false);
    inputRef.current?.focus();
  }

  function loadConversation(id: string) {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    setActiveConversationId(id);
    setMessages(conv.messages);
    setSidebarOpen(false);
  }

  function deleteConversation(id: string) {
    if (!confirm("Delete this conversation?")) return;
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveConversations(next);
      return next;
    });
    if (activeConversationId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        loadConversation(remaining[0].id);
      } else {
        startNewConversation();
      }
    }
  }

  const suggestedPrompts = getSuggestedPrompts(selectedCar);
  const showSuggested = messages.length === 0;

  return (
    <div className="flex h-[calc(100dvh-152px)] lg:h-[calc(100dvh-32px)] -mt-px relative">
      {/* ── Sidebar (conversations) ── */}
      <ChatSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={loadConversation}
        onNew={startNewConversation}
        onDelete={deleteConversation}
      />

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex-shrink-0 border-b border-[var(--color-border)] glass">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between max-w-4xl mx-auto w-full gap-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden min-w-[44px] min-h-[44px] w-10 h-10 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] cursor-pointer"
                aria-label="Open conversations"
              >
                <Menu size={16} />
              </button>
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] flex items-center justify-center glow-accent-sm flex-shrink-0">
                <Bot size={17} className="text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base font-bold truncate">VAULT AI</h1>
                <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                  {messages.length > 0 ? `${messages.length} messages` : "Automotive advisor"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {!loadingCars && cars.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCarPicker((v) => !v)}
                    className="flex items-center gap-2 min-h-[44px] h-10 px-3.5 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-border-bright)] transition-colors text-xs font-medium cursor-pointer"
                    aria-haspopup="listbox"
                    aria-expanded={showCarPicker}
                  >
                    {selectedCar?.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedCar.cover_image_url}
                        alt=""
                        loading="lazy"
                        className="w-5 h-5 rounded-md object-cover"
                      />
                    ) : (
                      <CarIcon size={13} className="text-[var(--color-accent)]" />
                    )}
                    <span className="max-w-[90px] truncate text-[var(--color-text-secondary)]">
                      {selectedCar ? `${selectedCar.year} ${selectedCar.make}` : "Select"}
                    </span>
                    <ChevronDown size={11} className="text-[var(--color-text-muted)]" />
                  </button>

                  {showCarPicker && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowCarPicker(false)}
                        aria-hidden="true"
                      />
                      <div className="absolute right-0 top-12 z-20 w-64 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-[0_16px_64px_rgba(0,0,0,0.5)] overflow-hidden animate-scale-in">
                        <p className="px-4 py-2.5 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider border-b border-[var(--color-border)]">
                          Your garage
                        </p>
                        {cars.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedCarId(c.id);
                              setShowCarPicker(false);
                            }}
                            className={`w-full text-left flex items-center gap-3 px-4 py-3 min-h-[44px] hover:bg-[var(--color-bg-elevated)] transition-colors cursor-pointer ${
                              c.id === selectedCarId
                                ? "text-[#60A5FA]"
                                : "text-[var(--color-text-secondary)]"
                            }`}
                          >
                            {c.cover_image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={c.cover_image_url}
                                alt=""
                                loading="lazy"
                                className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                              />
                            ) : (
                              <CarIcon
                                size={14}
                                className={
                                  c.id === selectedCarId
                                    ? "text-[var(--color-accent)]"
                                    : "text-[var(--color-text-muted)]"
                                }
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">
                                {c.year} {c.make} {c.model}
                              </p>
                              {c.modCount > 0 && (
                                <p className="text-[10px] text-[var(--color-text-muted)]">
                                  {c.modCount} mod{c.modCount > 1 ? "s" : ""}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCarId("");
                            setShowCarPicker(false);
                          }}
                          className="w-full text-left flex items-center gap-3 px-4 py-3 min-h-[44px] text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] transition-colors cursor-pointer border-t border-[var(--color-border)]"
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
        </header>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-4xl mx-auto w-full space-y-5">
            {showSuggested ? (
              <EmptyChatState
                car={selectedCar}
                suggestions={suggestedPrompts}
                onPick={(p) => sendMessage(p)}
              />
            ) : (
              messages.map((msg, i) => (
                <ChatBubble
                  key={i}
                  msg={msg}
                  isLast={i === messages.length - 1}
                  onQuickReply={(text) => sendMessage(text)}
                  streaming={streaming && i === messages.length - 1}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Fixed input bar */}
        <footer className="flex-shrink-0 border-t border-[var(--color-border)] glass">
          <div className="px-4 sm:px-6 lg:px-8 py-3 max-w-4xl mx-auto w-full">
            <div className="flex items-end gap-2">
              <div className="flex-1 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] focus-within:border-[var(--color-accent)] focus-within:ring-2 focus-within:ring-[rgba(59,130,246,0.15)] transition-all">
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
                  aria-label="Message"
                  className="w-full resize-none bg-transparent border-0 px-5 py-3.5 text-sm text-white placeholder-[var(--color-text-muted)] outline-none disabled:opacity-50 leading-relaxed"
                  style={{ minHeight: "52px", maxHeight: "116px" }}
                />
              </div>
              <button
                type="button"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || streaming}
                aria-label="Send message"
                className={`min-w-[52px] min-h-[52px] rounded-2xl flex items-center justify-center transition-all active:scale-95 flex-shrink-0 cursor-pointer ${
                  input.trim() && !streaming
                    ? "bg-[var(--color-accent)] glow-accent-sm hover:brightness-110"
                    : "bg-[var(--color-bg-card)] border border-[var(--color-border)]"
                } disabled:opacity-40 disabled:pointer-events-none`}
                style={{ width: "52px", height: "52px" }}
              >
                <Send size={16} className="text-white" />
              </button>
            </div>
            <p className="text-[10px] text-[var(--color-text-disabled)] text-center mt-2">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

function ChatSidebar({
  open,
  onClose,
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  conversations: StoredConversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/70 z-30 animate-fade"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-dvh z-40 w-72 bg-[var(--color-bg-card)] border-r border-[var(--color-border)] flex flex-col
          transition-transform duration-300 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:static lg:translate-x-0 lg:w-64 lg:flex-shrink-0
        `}
      >
        <div className="flex-shrink-0 p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
              Conversations
            </p>
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden min-w-[36px] min-h-[36px] w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] cursor-pointer"
              aria-label="Close sidebar"
            >
              <X size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={onNew}
            className="w-full flex items-center justify-center gap-2 min-h-[44px] h-11 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold hover:brightness-110 transition-all cursor-pointer"
          >
            <Plus size={13} />
            New conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <MessageCircle size={22} className="mx-auto text-[var(--color-text-disabled)] mb-2" />
              <p className="text-xs text-[var(--color-text-muted)]">No conversations yet</p>
            </div>
          ) : (
            <ul className="space-y-0.5 px-2">
              {conversations.map((c) => (
                <li key={c.id}>
                  <div
                    className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 min-h-[48px] cursor-pointer transition-colors ${
                      activeId === c.id
                        ? "bg-[var(--color-accent-muted)] text-white"
                        : "hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]"
                    }`}
                    onClick={() => onSelect(c.id)}
                  >
                    <MessageCircle size={12} className="flex-shrink-0 text-[var(--color-text-muted)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">{c.title}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)] truncate">{relativeTime(c.updatedAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(c.id);
                      }}
                      className="min-w-[28px] min-h-[28px] w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[#f87171] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 cursor-pointer"
                      aria-label="Delete conversation"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}

function ChatBubble({
  msg,
  isLast,
  onQuickReply,
  streaming,
}: {
  msg: Message;
  isLast: boolean;
  onQuickReply: (text: string) => void;
  streaming: boolean;
}) {
  const isUser = msg.role === "user";
  const isEmpty = !msg.content;

  return (
    <div>
      <div
        className={`flex gap-3 animate-in-fast ${isUser ? "flex-row-reverse" : ""}`}
      >
        <div
          className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
            isUser
              ? "bg-[var(--color-bg-card)] border border-[var(--color-border)]"
              : "bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)]"
          }`}
        >
          {isUser ? (
            <UserIcon size={14} className="text-[var(--color-text-secondary)]" />
          ) : (
            <Bot size={14} className="text-white" />
          )}
        </div>
        <div
          className={`max-w-[78%] px-5 py-3.5 text-sm leading-relaxed rounded-2xl break-words ${
            isUser
              ? "bg-[var(--color-accent)] text-white rounded-tr-md"
              : "bg-[#1C1C1E] text-white rounded-tl-md border border-white/5"
          }`}
        >
          {isEmpty ? (
            <TypingIndicator />
          ) : isUser ? (
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          ) : (
            <Markdown text={msg.content} />
          )}
        </div>
      </div>

      {/* Quick-reply buttons — show only on the most recent assistant message */}
      {!isUser && !streaming && isLast && msg.quickReplies && msg.quickReplies.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 ml-12 animate-in-fast">
          {msg.quickReplies.map((reply, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onQuickReply(reply)}
              className="flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[11px] font-bold text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] transition-all cursor-pointer"
            >
              <Sparkles size={9} className="text-[var(--color-accent-bright)]" />
              {reply}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 h-5" aria-label="AI is typing">
      {[0, 1, 2].map((j) => (
        <span
          key={j}
          className="w-2 h-2 rounded-full bg-white/45"
          style={{ animation: `typingPulse 1.2s ease-in-out ${j * 0.18}s infinite` }}
        />
      ))}
      <style jsx>{`
        @keyframes typingPulse {
          0%,
          60%,
          100% {
            opacity: 0.3;
            transform: translateY(0);
          }
          30% {
            opacity: 1;
            transform: translateY(-3px);
          }
        }
      `}</style>
    </span>
  );
}

function EmptyChatState({
  car,
  suggestions,
  onPick,
}: {
  car: CarWithMods | null;
  suggestions: string[];
  onPick: (s: string) => void;
}) {
  const greeting = car
    ? car.modCount === 0
      ? `Your ${car.year} ${car.make} ${car.model} is a clean canvas. What are you thinking of building?`
      : car.latestMod
      ? `Looking at your ${car.year} ${car.make} ${car.model} — most recently added the ${car.latestMod}. What's on your mind?`
      : `Got your ${car.year} ${car.make} ${car.model} loaded with all ${car.modCount} mod${car.modCount > 1 ? "s" : ""}. Ask me anything.`
    : "Hey — I'm VAULT AI, your automotive advisor. Add a car to your garage and I'll know your build inside and out.";

  return (
    <div className="flex flex-col items-center justify-center min-h-[55dvh] text-center">
      <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] flex items-center justify-center glow-accent mb-5">
        <Bot size={26} className="text-white" />
      </div>
      <h2 className="text-2xl font-black tracking-tight mb-2">VAULT AI</h2>
      <p className="text-sm text-[var(--color-text-secondary)] max-w-md leading-relaxed px-4">{greeting}</p>

      <div className="mt-8 w-full max-w-2xl">
        <div className="flex items-center justify-center gap-2 mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
          <Sparkles size={11} className="text-[var(--color-accent)]" />
          Suggested prompts
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {suggestions.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className="text-left text-xs min-h-[56px] px-4 py-3.5 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[var(--color-border-bright)] hover:bg-[var(--color-bg-elevated)] transition-all cursor-pointer text-[var(--color-text-secondary)] hover:text-white leading-relaxed break-words"
              style={{
                animation: `fadeInUp 350ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 60}ms both`,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <ChatContent />
    </Suspense>
  );
}
