"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X, Undo2 } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  description?: string;
  variant: ToastVariant;
  /** Auto-dismiss after N ms. Default 4000. 0 = never. */
  duration?: number;
  /** Optional undo action — if provided, shows an Undo button. */
  undo?: () => void | Promise<void>;
}

interface ToastContextValue {
  push: (toast: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
  success: (message: string, opts?: Partial<Toast>) => string;
  error: (message: string, opts?: Partial<Toast>) => string;
  info: (message: string, opts?: Partial<Toast>) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const full: Toast = { id, duration: 4000, ...toast };
      setToasts((prev) => [...prev, full]);
      if (full.duration && full.duration > 0) {
        const timer = setTimeout(() => dismiss(id), full.duration);
        timersRef.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  const success = useCallback(
    (message: string, opts?: Partial<Toast>) => push({ message, variant: "success", ...opts }),
    [push],
  );
  const error = useCallback(
    (message: string, opts?: Partial<Toast>) => push({ message, variant: "error", ...opts }),
    [push],
  );
  const info = useCallback(
    (message: string, opts?: Partial<Toast>) => push({ message, variant: "info", ...opts }),
    [push],
  );

  // Cleanup all timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ push, dismiss, success, error, info }}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 lg:left-auto lg:right-6 lg:translate-x-0 z-[10000] flex flex-col gap-2 pointer-events-none max-w-sm w-[calc(100%-2rem)]"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
    >
      <style>{`
        @keyframes tPop {
          0%   { opacity: 0; transform: translateY(14px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const colors = {
    success: { border: "rgba(48,209,88,0.55)",  bg: "rgba(48,209,88,0.12)",  icon: "#30d158", Icon: CheckCircle2 },
    error:   { border: "rgba(255,69,58,0.55)",  bg: "rgba(255,69,58,0.12)",  icon: "#ff453a", Icon: AlertCircle },
    info:    { border: "rgba(168,85,247,0.55)", bg: "rgba(168,85,247,0.12)", icon: "#c084fc", Icon: Info },
  }[toast.variant];
  const Icon = colors.Icon;

  return (
    <div
      role="status"
      className="pointer-events-auto flex items-start gap-3 p-4 rounded-2xl backdrop-blur-xl"
      style={{
        background: `linear-gradient(135deg, rgba(12,10,22,0.92) 0%, rgba(18,15,30,0.92) 100%), ${colors.bg}`,
        border: `1px solid ${colors.border}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset",
        animation: "tPop 260ms cubic-bezier(0.34,1.56,0.64,1)",
      }}
    >
      <Icon size={18} style={{ color: colors.icon, flexShrink: 0, marginTop: 1 }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white leading-snug">{toast.message}</p>
        {toast.description && (
          <p className="text-xs text-[rgba(220,210,250,0.7)] mt-0.5 leading-snug">{toast.description}</p>
        )}
      </div>
      {toast.undo && (
        <button
          onClick={async () => {
            try { await toast.undo?.(); } catch {}
            onDismiss();
          }}
          className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider"
          style={{
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.1em",
            background: "rgba(168,85,247,0.2)",
            border: "1px solid rgba(168,85,247,0.5)",
            color: "#e9d5ff",
            cursor: "pointer",
          }}
        >
          <Undo2 size={11} />
          Undo
        </button>
      )}
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex-shrink-0 text-[rgba(200,180,240,0.5)] hover:text-white transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
